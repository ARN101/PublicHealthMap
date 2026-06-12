const { executeQuery, initializeDb } = require('../db');
const oracledb = require('oracledb');

const packageSpec = `
CREATE OR REPLACE PACKAGE case_entry_pkg AS
    -- Custom collection types for batch binding
    TYPE t_num_array IS TABLE OF NUMBER INDEX BY PLS_INTEGER;
    TYPE t_varchar_array IS TABLE OF VARCHAR2(1000) INDEX BY PLS_INTEGER;

    PROCEDURE log_case_batch(
        p_patient_ids      IN  t_num_array,
        p_hospital_ids     IN  t_num_array,
        p_disease_ids      IN  t_num_array,
        p_diag_dates       IN  t_varchar_array,
        p_symptoms         IN  t_varchar_array,
        p_severities       IN  t_varchar_array,
        p_methods          IN  t_varchar_array,
        p_isolations       IN  t_varchar_array,
        p_sources          IN  t_varchar_array,
        p_travels          IN  t_varchar_array,
        p_comorbidities    IN  t_varchar_array,
        p_notes            IN  t_varchar_array,
        p_size             IN  NUMBER,
        p_success_count    OUT NUMBER,
        p_fail_count       OUT NUMBER,
        p_results          OUT t_varchar_array
    );
END case_entry_pkg;
`;

const packageBody = `
CREATE OR REPLACE PACKAGE BODY case_entry_pkg AS
    PROCEDURE log_case_batch(
        p_patient_ids      IN  t_num_array,
        p_hospital_ids     IN  t_num_array,
        p_disease_ids      IN  t_num_array,
        p_diag_dates       IN  t_varchar_array,
        p_symptoms         IN  t_varchar_array,
        p_severities       IN  t_varchar_array,
        p_methods          IN  t_varchar_array,
        p_isolations       IN  t_varchar_array,
        p_sources          IN  t_varchar_array,
        p_travels          IN  t_varchar_array,
        p_comorbidities    IN  t_varchar_array,
        p_notes            IN  t_varchar_array,
        p_size             IN  NUMBER,
        p_success_count    OUT NUMBER,
        p_fail_count       OUT NUMBER,
        p_results          OUT t_varchar_array
    ) IS
    BEGIN
        p_success_count := 0;
        p_fail_count := 0;

        FOR i IN 1..p_size LOOP
            DECLARE
                v_case_id NUMBER;
            BEGIN
                -- Set savepoint for this specific case log to allow partial commits
                SAVEPOINT case_sp;

                -- Insert record into CASE_RECORDS (case_id auto-assigned by pre-insert trigger)
                INSERT INTO CASE_RECORDS (
                    patient_id, hospital_id, disease_id, diagnosis_date,
                    symptoms_list, severity_at_admission, diagnosis_method,
                    patient_status, isolation_status, infection_source,
                    travel_history, co_morbidities, notes
                ) VALUES (
                    p_patient_ids(i),
                    p_hospital_ids(i),
                    p_disease_ids(i),
                    TO_DATE(p_diag_dates(i), 'YYYY-MM-DD'),
                    p_symptoms(i),
                    p_severities(i),
                    p_methods(i),
                    'Active',
                    p_isolations(i),
                    p_sources(i),
                    p_travels(i),
                    p_comorbidities(i),
                    p_notes(i)
                )
                RETURNING case_id INTO v_case_id;

                p_success_count := p_success_count + 1;
                p_results(i) := 'SUCCESS: Case ID ' || v_case_id;
            EXCEPTION
                WHEN OTHERS THEN
                    -- Rollback to individual savepoint to prevent failing the entire batch
                    ROLLBACK TO case_sp;
                    p_fail_count := p_fail_count + 1;
                    
                    -- Extract custom duplicate error or format default ORA message
                    IF SQLCODE = -20201 THEN
                        p_results(i) := 'ERROR: Duplicate Case Detected (patient logged for this disease within 30 days).';
                    ELSE
                        p_results(i) := 'ERROR: ' || SUBSTR(SQLERRM, 1, 150);
                    END IF;
            END;
        END LOOP;
    END log_case_batch;
END case_entry_pkg;
`;

async function runSetup() {
  try {
    console.log('Connecting to database...');
    await initializeDb();

    // 1. Compile Package Spec
    console.log('\nCompiling PL/SQL Package Specification (CASE_ENTRY_PKG)...');
    await executeQuery(packageSpec);
    console.log('Package Specification compiled successfully.');

    // 2. Compile Package Body
    console.log('\nCompiling PL/SQL Package Body (CASE_ENTRY_PKG)...');
    await executeQuery(packageBody);
    console.log('Package Body compiled successfully.');

    // 3. Test Package Call (DML requires active transactional connection)
    console.log('\nTesting PL/SQL batch logging with Savepoints...');
    const pool = await initializeDb();
    const conn = await pool.getConnection();

    try {
      // Create test resources
      console.log('Setting up temporary test patient and hospital...');
      const patientNid = '9999000033333';
      const hospLicense = 'TEST-BATCH-LIC';

      // Clean up previous test runs if any
      await conn.execute('DELETE FROM CASE_RECORDS WHERE patient_id IN (SELECT patient_id FROM PATIENTS WHERE national_id = :nid)', [patientNid], { autoCommit: true });
      await conn.execute('DELETE FROM PATIENTS WHERE national_id = :nid', [patientNid], { autoCommit: true });
      await conn.execute('DELETE FROM HOSPITALS WHERE license_number = :lic', [hospLicense], { autoCommit: true });

      // Insert test hospital
      const hospResult = await conn.execute(
        `INSERT INTO HOSPITALS (license_number, name, email, password_hash, phone, street_address, city, division, latitude, longitude)
         VALUES (:lic, 'Batch Test Hospital', 'batch@test.com', 'pwd', '9999', 'Road 1', 'Dhaka', 'Dhaka', 23.8, 90.4)
         RETURNING hospital_id INTO :hosp_id`,
        { lic: hospLicense, hosp_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
      );
      const hospitalId = hospResult.outBinds.hosp_id[0];

      // Insert test patient
      const patientResult = await conn.execute(
        `INSERT INTO PATIENTS (national_id, birth_cert_no, full_name, date_of_birth, gender, blood_group, contact_number, city, division)
         VALUES (:nid, NULL, 'Batch Tester Patient', TO_DATE('1990-01-01', 'YYYY-MM-DD'), 'Male', 'A+', '123', 'Dhaka', 'Dhaka')
         RETURNING patient_id INTO :pat_id`,
        { nid: patientNid, pat_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
      );
      const patientId = patientResult.outBinds.pat_id[0];

      console.log(`Setup complete. Hospital ID: ${hospitalId}, Patient ID: ${patientId}`);

      // Prepare batch data of 3 cases:
      // Case 1: Valid COVID19 case -> should succeed
      // Case 2: Duplicate COVID19 case within 30 days -> should fail via Compound Trigger / Savepoint rollback
      // Case 3: Invalid Patient ID -> should fail via DB Foreign Key constraint / Savepoint rollback
      const patientIds = [patientId, patientId, 999999]; // 999999 is invalid
      const hospitalIds = [hospitalId, hospitalId, hospitalId];
      const diseaseIds = [101, 101, 101]; // COVID19
      const diagDates = ['2026-06-01', '2026-06-05', '2026-06-10'];
      const symptoms = ['Fever', 'Cough', 'Shortness of breath'];
      const severities = ['Mild', 'Moderate', 'Severe'];
      const methods = ['PCR', 'PCR', 'PCR'];
      const isolations = ['Home Isolation', 'Home Isolation', 'General Ward'];
      const sources = ['Local Transmission', 'Local Transmission', 'Local Transmission'];
      const travels = ['None', 'None', 'None'];
      const comorbidities = ['None', 'None', 'None'];
      const notes = ['Batch test case 1', 'Batch test case 2', 'Batch test case 3'];

      const size = patientIds.length;

      console.log('\nExecuting case_entry_pkg.log_case_batch stored procedure...');
      const batchResult = await conn.execute(
        `BEGIN
            case_entry_pkg.log_case_batch(
                p_patient_ids => :patientIds,
                p_hospital_ids => :hospitalIds,
                p_disease_ids => :diseaseIds,
                p_diag_dates => :diagDates,
                p_symptoms => :symptoms,
                p_severities => :severities,
                p_methods => :methods,
                p_isolations => :isolations,
                p_sources => :sources,
                p_travels => :travels,
                p_comorbidities => :comorbidities,
                p_notes => :notes,
                p_size => :size,
                p_success_count => :successCount,
                p_fail_count => :failCount,
                p_results => :results
            );
         END;`,
        {
          patientIds: { type: oracledb.DB_TYPE_NUMBER, dir: oracledb.BIND_IN, val: patientIds },
          hospitalIds: { type: oracledb.DB_TYPE_NUMBER, dir: oracledb.BIND_IN, val: hospitalIds },
          diseaseIds: { type: oracledb.DB_TYPE_NUMBER, dir: oracledb.BIND_IN, val: diseaseIds },
          diagDates: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: diagDates },
          symptoms: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: symptoms },
          severities: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: severities },
          methods: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: methods },
          isolations: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: isolations },
          sources: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: sources },
          travels: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: travels },
          comorbidities: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: comorbidities },
          notes: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: notes },
          size: size,
          successCount: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
          failCount: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
          results: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_OUT, maxArraySize: size }
        },
        { autoCommit: true }
      );

      console.log('\nBatch execution summary:');
      console.log(`- Success Count: ${batchResult.outBinds.successCount}`);
      console.log(`- Fail Count: ${batchResult.outBinds.failCount}`);
      console.log('- Details per index:');
      batchResult.outBinds.results.forEach((msg, idx) => {
        console.log(`  Row [${idx + 1}]: ${msg}`);
      });

      // Cleanup test records
      console.log('\nCleaning up batch test records...');
      await conn.execute('DELETE FROM CASE_RECORDS WHERE patient_id = :id', [patientId], { autoCommit: true });
      await conn.execute('DELETE FROM PATIENTS WHERE patient_id = :id', [patientId], { autoCommit: true });
      await conn.execute('DELETE FROM HOSPITALS WHERE hospital_id = :id', [hospitalId], { autoCommit: true });
      console.log('Cleanup completed successfully.');

    } finally {
      await conn.close();
    }

    console.log('\nPL/SQL Package CASE_ENTRY_PKG compiled and validated successfully.');
    process.exit(0);
  } catch (err) {
    console.error('\nPL/SQL package setup failed:', err.message);
    process.exit(1);
  }
}

runSetup();
