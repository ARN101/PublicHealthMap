const { executeQuery, initializeDb } = require('../db');
const oracledb = require('oracledb');

const statsProcSql = `
CREATE OR REPLACE PROCEDURE refresh_disease_stats IS
    -- Explicit cursor to find all unique combinations of patient division and disease
    CURSOR c_stats IS
        SELECT DISTINCT pat.division, d.disease_code, d.disease_id
        FROM PATIENTS pat
        CROSS JOIN DISEASES d
        WHERE pat.division IS NOT NULL;

    v_active_count  NUMBER;
    v_total_count   NUMBER;
    v_death_count   NUMBER;
BEGIN
    -- Loop through each combination in the explicit cursor
    FOR r IN c_stats LOOP
        
        -- Aggregate active, total, and deceased cases for this division + disease
        SELECT 
            COUNT(CASE WHEN cr.patient_status = 'Active' THEN 1 END),
            COUNT(cr.case_id),
            COUNT(CASE WHEN cr.patient_status = 'Deceased' THEN 1 END)
        INTO 
            v_active_count,
            v_total_count,
            v_death_count
        FROM CASE_RECORDS cr
        JOIN PATIENTS pat ON cr.patient_id = pat.patient_id
        WHERE pat.division = r.division
          AND cr.disease_id = r.disease_id;

        -- Perform upsert using MERGE statement to refresh cache summary table
        MERGE INTO DIVISIONAL_STATS_SUMMARY dest
        USING (
            SELECT r.division AS division, r.disease_code AS disease_code FROM dual
        ) src
        ON (dest.division = src.division AND dest.disease_code = src.disease_code)
        WHEN MATCHED THEN
            UPDATE SET 
                dest.active_cases = v_active_count,
                dest.total_cases  = v_total_count,
                dest.total_deaths = v_death_count,
                dest.last_updated = SYSDATE
        WHEN NOT MATCHED THEN
            INSERT (division, disease_code, active_cases, total_cases, total_deaths, last_updated)
            VALUES (src.division, src.disease_code, v_active_count, v_total_count, v_death_count, SYSDATE);
            
    END LOOP;
    
    COMMIT;
END refresh_disease_stats;
`;

async function runSetup() {
  try {
    console.log('Connecting to database...');
    await initializeDb();

    console.log('\nCompiling PL/SQL Stored Procedure (refresh_disease_stats)...');
    await executeQuery(statsProcSql);
    console.log('Procedure compiled successfully.');

    // Test the statistics aggregation procedure with a test patient case
    const pool = await initializeDb();
    const conn = await pool.getConnection();

    try {
      console.log('\nSetting up test patient data for stats validation...');
      const testNid = '99990000444';
      const hospLicense = 'TEST-STATS-LIC';

      // Clean up previous runs
      await conn.execute('DELETE FROM CASE_RECORDS WHERE patient_id IN (SELECT patient_id FROM PATIENTS WHERE national_id = :nid)', [testNid], { autoCommit: true });
      await conn.execute('DELETE FROM DIVISIONAL_STATS_SUMMARY WHERE division = \'Dhaka\'');
      await conn.execute('DELETE FROM PATIENTS WHERE national_id = :nid', [testNid], { autoCommit: true });
      await conn.execute('DELETE FROM HOSPITALS WHERE license_number = :lic', [hospLicense], { autoCommit: true });

      // Insert hospital in Dhaka division
      const hospRes = await conn.execute(
        `INSERT INTO HOSPITALS (license_number, name, email, password_hash, phone, street_address, city, division, latitude, longitude)
         VALUES (:lic, 'Stats Test Hospital', 'stats@hosp.com', 'pwd', '9999', 'Road 10', 'Dhaka', 'Dhaka', 23.8, 90.4)
         RETURNING hospital_id INTO :hosp_id`,
        { lic: hospLicense, hosp_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
      );
      const hospitalId = hospRes.outBinds.hosp_id[0];

      // Insert patient in Dhaka division
      const patRes = await conn.execute(
        `INSERT INTO PATIENTS (national_id, birth_cert_no, full_name, date_of_birth, gender, blood_group, contact_number, city, division)
         VALUES (:nid, NULL, 'Stats Tester Patient', TO_DATE('1990-01-01', 'YYYY-MM-DD'), 'Male', 'A+', '123', 'Dhaka', 'Dhaka')
         RETURNING patient_id INTO :pat_id`,
        { nid: testNid, pat_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
      );
      const patientId = patRes.outBinds.pat_id[0];

      // Insert 1 Active Case (COVID19 - 101)
      await conn.execute(
        `INSERT INTO CASE_RECORDS (patient_id, hospital_id, disease_id, diagnosis_date, symptoms_list, severity_at_admission, diagnosis_method, patient_status, isolation_status, infection_source)
         VALUES (:patientId, :hospitalId, 101, SYSDATE, 'Cough', 'Mild', 'PCR', 'Active', 'Home Isolation', 'Local Transmission')`,
        [patientId, hospitalId],
        { autoCommit: true }
      );

      // Insert 1 Deceased Case (Cholera - 102)
      await conn.execute(
        `INSERT INTO CASE_RECORDS (patient_id, hospital_id, disease_id, diagnosis_date, symptoms_list, severity_at_admission, diagnosis_method, patient_status, isolation_status, infection_source)
         VALUES (:patientId, :hospitalId, 102, SYSDATE, 'Dehydration', 'Severe', 'Clinical', 'Deceased', 'General Ward', 'Local Transmission')`,
        [patientId, hospitalId],
        { autoCommit: true }
      );

      console.log('Seeded: 1 Active COVID19 (Dhaka) and 1 Deceased Cholera (Dhaka).');

      // Execute Stored Procedure
      console.log('\nExecuting refresh_disease_stats stored procedure...');
      await conn.execute('BEGIN refresh_disease_stats; END;');
      console.log('Procedure execution completed.');

      // Verify stats table DIVISIONAL_STATS_SUMMARY
      console.log('\nQuerying stats summary table...');
      const checkStats = await conn.execute(
        'SELECT division, disease_code, active_cases, total_cases, total_deaths FROM DIVISIONAL_STATS_SUMMARY'
      );
      console.table(checkStats.rows);

      // Clean up test entries
      console.log('\nCleaning up stats validation data...');
      await conn.execute('DELETE FROM CASE_RECORDS WHERE patient_id = :id', [patientId], { autoCommit: true });
      await conn.execute('DELETE FROM DIVISIONAL_STATS_SUMMARY WHERE division = \'Dhaka\'');
      await conn.execute('DELETE FROM PATIENTS WHERE patient_id = :id', [patientId], { autoCommit: true });
      await conn.execute('DELETE FROM HOSPITALS WHERE hospital_id = :id', [hospitalId], { autoCommit: true });
      console.log('Cleanup completed successfully.');

    } finally {
      await conn.close();
    }

    console.log('\nPL/SQL stored procedure setup and verification complete.');
    process.exit(0);
  } catch (err) {
    console.error('\nPL/SQL procedure setup/test failed:', err.message);
    process.exit(1);
  }
}

runSetup();
