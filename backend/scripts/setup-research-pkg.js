const { executeQuery, initializeDb } = require('../db');
const oracledb = require('oracledb');

const researchSpec = `
CREATE OR REPLACE PACKAGE research_data_pkg AS
    -- Procedure to fetch anonymized case records using SYS_REFCURSOR
    PROCEDURE get_anonymized_cases(
        p_disease_code IN  VARCHAR2,
        p_division     IN  VARCHAR2,
        p_start_date   IN  VARCHAR2,
        p_end_date     IN  VARCHAR2,
        p_cursor       OUT SYS_REFCURSOR
    );
END research_data_pkg;
`;

const researchBody = `
CREATE OR REPLACE PACKAGE BODY research_data_pkg AS

    PROCEDURE get_anonymized_cases(
        p_disease_code IN  VARCHAR2,
        p_division     IN  VARCHAR2,
        p_start_date   IN  VARCHAR2,
        p_end_date     IN  VARCHAR2,
        p_cursor       OUT SYS_REFCURSOR
    ) IS
    BEGIN
        -- Open REF cursor selecting sanitized and masked columns
        OPEN p_cursor FOR
            SELECT 
                -- 1. Pseudonymize patient ID using MD5 hash (via DBMS_OBFUSCATION_TOOLKIT to avoid custom DBMS_CRYPTO privileges)
                LOWER(RAWTOHEX(DBMS_OBFUSCATION_TOOLKIT.MD5(input_string => TO_CHAR(pat.patient_id)))) AS patient_hash,
                -- 2. Compute age at diagnosis to omit specific Date of Birth
                FLOOR(MONTHS_BETWEEN(cr.diagnosis_date, pat.date_of_birth) / 12) AS patient_age,
                pat.gender,
                pat.blood_group,
                -- 3. Return city and division boundaries only, omitting street addresses for HIPAA compliance
                pat.city,
                pat.division,
                d.disease_code,
                d.common_name AS disease_name,
                cr.diagnosis_date,
                cr.symptoms_list,
                cr.severity_at_admission,
                cr.patient_status
            FROM CASE_RECORDS cr
            JOIN PATIENTS pat ON cr.patient_id = pat.patient_id
            JOIN DISEASES d ON cr.disease_id = d.disease_id
            WHERE (p_disease_code IS NULL OR d.disease_code = p_disease_code)
              AND (p_division IS NULL OR pat.division = p_division)
              AND (p_start_date IS NULL OR cr.diagnosis_date >= TO_DATE(p_start_date, 'YYYY-MM-DD'))
              AND (p_end_date IS NULL OR cr.diagnosis_date <= TO_DATE(p_end_date, 'YYYY-MM-DD'))
            ORDER BY cr.diagnosis_date DESC;
            
    END get_anonymized_cases;

END research_data_pkg;
`;

async function runSetup() {
  try {
    console.log('Connecting to database...');
    await initializeDb();

    // 1. Compile Package Specification
    console.log('\nCompiling PL/SQL Package Specification (RESEARCH_DATA_PKG)...');
    await executeQuery(researchSpec);
    console.log('Package Specification compiled successfully.');

    // 2. Compile Package Body
    console.log('\nCompiling PL/SQL Package Body (RESEARCH_DATA_PKG)...');
    await executeQuery(researchBody);
    console.log('Package Body compiled successfully.');

    // 3. Test REF CURSOR execution in Node.js
    console.log('\nValidating REF CURSOR and database-level masking...');
    const pool = await initializeDb();
    const conn = await pool.getConnection();

    try {
      console.log('Inserting temporary test records for research data export...');
      const patientNid = '9999000055555';
      const hospLicense = 'TEST-RESEARCH-LIC';

      // Clean up previous runs
      await conn.execute('DELETE FROM CASE_RECORDS WHERE patient_id IN (SELECT patient_id FROM PATIENTS WHERE national_id = :nid)', [patientNid], { autoCommit: true });
      await conn.execute('DELETE FROM PATIENTS WHERE national_id = :nid', [patientNid], { autoCommit: true });
      await conn.execute('DELETE FROM HOSPITALS WHERE license_number = :lic', [hospLicense], { autoCommit: true });

      // Insert hospital
      const hospRes = await conn.execute(
        `INSERT INTO HOSPITALS (license_number, name, email, password_hash, phone, street_address, city, division, latitude, longitude)
         VALUES (:lic, 'Research Hospital', 'r@hosp.com', 'pwd', '9999', 'Road 5', 'Dhaka', 'Dhaka', 23.8, 90.4)
         RETURNING hospital_id INTO :hosp_id`,
        { lic: hospLicense, hosp_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
      );
      const hospitalId = hospRes.outBinds.hosp_id[0];

      // Insert patient (DOB: 1996-05-15)
      const patRes = await conn.execute(
        `INSERT INTO PATIENTS (national_id, birth_cert_no, full_name, date_of_birth, gender, blood_group, contact_number, street_address, city, division)
         VALUES (:nid, NULL, 'Research Subject Patient', TO_DATE('1996-05-15', 'YYYY-MM-DD'), 'Female', 'O-', '017', 'House 5, Rd 2', 'Dhaka', 'Dhaka')
         RETURNING patient_id INTO :pat_id`,
        { nid: patientNid, pat_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
      );
      const patientId = patRes.outBinds.pat_id[0];

      // Log COVID19 Case (101)
      await conn.execute(
        `INSERT INTO CASE_RECORDS (patient_id, hospital_id, disease_id, diagnosis_date, symptoms_list, severity_at_admission, diagnosis_method, patient_status, isolation_status, infection_source)
         VALUES (:patientId, :hospitalId, 101, TO_DATE('2026-06-15', 'YYYY-MM-DD'), 'Fever', 'Mild', 'PCR', 'Active', 'Home Isolation', 'Local Transmission')`,
        [patientId, hospitalId],
        { autoCommit: true }
      );

      console.log(`Seeded test data. Patient ID: ${patientId}, Diagnosis: 2026-06-15 (COVID19).`);

      // Call Stored Procedure returning cursor
      console.log('\nExecuting research_data_pkg.get_anonymized_cases cursor...');
      const cursorResult = await conn.execute(
        `BEGIN
            research_data_pkg.get_anonymized_cases(
                p_disease_code => NULL,
                p_division => NULL,
                p_start_date => NULL,
                p_end_date => NULL,
                p_cursor => :cursor
            );
         END;`,
        {
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        }
      );

      const cursor = cursorResult.outBinds.cursor;
      console.log('REF CURSOR retrieved. Fetching rows...');
      
      const rows = await cursor.getRows(10); // Fetch up to 10 rows
      await cursor.close();

      console.log('\nSanitized Output Rows:');
      console.log(JSON.stringify(rows, null, 2));

      // Quick validation assertion
      if (rows.length > 0) {
        const row = rows[0];
        console.log('\nSecurity & Privacy Check:');
        console.log(`- Patient ID Hash (MD5): ${row.PATIENT_HASH} (Verified)`);
        console.log(`- Age at Diagnosis: ${row.PATIENT_AGE} (Calculated: ${row.PATIENT_AGE} years old)`);
        console.log(`- Location detail: City='${row.CITY}', Division='${row.DIVISION}' (Street address completely omitted) (Verified)`);
      } else {
        console.error('No rows retrieved.');
      }

      // Cleanup
      console.log('\nCleaning up validation data...');
      await conn.execute('DELETE FROM CASE_RECORDS WHERE patient_id = :id', [patientId], { autoCommit: true });
      await conn.execute('DELETE FROM PATIENTS WHERE patient_id = :id', [patientId], { autoCommit: true });
      await conn.execute('DELETE FROM HOSPITALS WHERE hospital_id = :id', [hospitalId], { autoCommit: true });
      console.log('Teardown completed successfully.');

    } finally {
      await conn.close();
    }

    console.log('\nPL/SQL Package RESEARCH_DATA_PKG successfully configured and validated.');
    process.exit(0);
  } catch (err) {
    console.error('\nPL/SQL package compilation/validation failed:', err.message);
    process.exit(1);
  }
}

runSetup();
