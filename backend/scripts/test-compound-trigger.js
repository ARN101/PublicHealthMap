const { executeQuery, initializeDb } = require('../db');
const oracledb = require('oracledb');

async function runTest() {
  let conn;
  try {
    console.log('Connecting to database...');
    const pool = await initializeDb();
    conn = await pool.getConnection();

    // 1. Ensure we have a test disease (using the seeded COVID19 (101))
    const diseaseId = 101; // COVID-19

    // 2. Ensure we have a test hospital. We will temporarily insert one.
    console.log('\nInserting test hospital...');
    const hospLicense = 'TEST-HOSP-LIC-123';
    
    // Check if test hospital already exists (clean up first if it does)
    await conn.execute(
      `DELETE FROM HOSPITALS WHERE license_number = :lic`,
      [hospLicense],
      { autoCommit: true }
    );

    const hospResult = await conn.execute(
      `INSERT INTO HOSPITALS (license_number, name, email, password_hash, phone, street_address, city, division, latitude, longitude)
       VALUES (:lic, 'Test General Hospital', 'test@hosp.com', 'hash', '123456', 'Test Street', 'Dhaka', 'Dhaka', 23.811, 90.412)
       RETURNING hospital_id INTO :hosp_id`,
      {
        lic: hospLicense,
        hosp_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );
    const hospitalId = hospResult.outBinds.hosp_id[0];
    console.log(`Test hospital inserted with ID: ${hospitalId}`);

    // 3. Ensure we have a test patient.
    console.log('\nInserting test patient...');
    const patientNid = '99990000111';
    
    // Clean up patient if they already exist
    await conn.execute(
      `DELETE FROM PATIENTS WHERE national_id = :nid`,
      [patientNid],
      { autoCommit: true }
    );

    const patientResult = await conn.execute(
      `INSERT INTO PATIENTS (national_id, birth_cert_no, full_name, date_of_birth, gender, blood_group, contact_number, occupation, street_address, city, division)
       VALUES (:nid, NULL, 'John Compound Test', TO_DATE('1990-01-01', 'YYYY-MM-DD'), 'Male', 'O+', '01711111111', 'Tester', 'Mirpur', 'Dhaka', 'Dhaka')
       RETURNING patient_id INTO :pat_id`,
      {
        nid: patientNid,
        pat_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );
    const patientId = patientResult.outBinds.pat_id[0];
    console.log(`Test patient inserted with ID: ${patientId}`);

    // 4. Log the first disease case record.
    console.log('\nLogging first case record (should succeed)...');
    const caseResult1 = await conn.execute(
      `INSERT INTO CASE_RECORDS (patient_id, hospital_id, disease_id, diagnosis_date, symptoms_list, severity_at_admission, diagnosis_method, patient_status, isolation_status, infection_source)
       VALUES (:patientId, :hospitalId, :diseaseId, SYSDATE, 'Fever, Cough', 'Moderate', 'PCR', 'Active', 'Home Isolation', 'Local Transmission')
       RETURNING case_id INTO :case_id`,
      {
        patientId,
        hospitalId,
        diseaseId,
        case_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );
    const caseId1 = caseResult1.outBinds.case_id[0];
    console.log(`First case logged successfully. Case ID: ${caseId1}`);

    // 5. Try logging the second case record for the same patient and same disease within 30 days.
    console.log('\nLogging second case record (should fail with ORA-20201)...');
    try {
      await conn.execute(
        `INSERT INTO CASE_RECORDS (patient_id, hospital_id, disease_id, diagnosis_date, symptoms_list, severity_at_admission, diagnosis_method, patient_status, isolation_status, infection_source)
         VALUES (:patientId, :hospitalId, :diseaseId, SYSDATE + 5, 'Fever, Headaches', 'Mild', 'Antigen', 'Active', 'Home Isolation', 'Local Transmission')`,
        {
          patientId,
          hospitalId,
          diseaseId
        },
        { autoCommit: true }
      );
      console.error('ERROR: Second case insert unexpectedly succeeded! The compound trigger did not block it.');
    } catch (err) {
      if (err.message.includes('ORA-20201')) {
        console.log('SUCCESS: Compound trigger successfully intercepted duplicate case!');
        console.log(`Database Error caught correctly: ${err.message.trim()}`);
      } else {
        console.error('FAIL: Unexpected database error returned:', err.message);
      }
    }

    // 6. Cleanup records
    console.log('\nCleaning up database records...');
    await conn.execute(`DELETE FROM CASE_RECORDS WHERE patient_id = :id`, [patientId], { autoCommit: true });
    await conn.execute(`DELETE FROM PATIENTS WHERE patient_id = :id`, [patientId], { autoCommit: true });
    await conn.execute(`DELETE FROM HOSPITALS WHERE hospital_id = :id`, [hospitalId], { autoCommit: true });
    console.log('Cleanup completed successfully.');

  } catch (err) {
    console.error('Test run failed:', err.message);
  } finally {
    if (conn) {
      await conn.close();
    }
    process.exit(0);
  }
}

runTest();
