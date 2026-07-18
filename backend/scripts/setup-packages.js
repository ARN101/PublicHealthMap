const { executeQuery, initializeDb } = require('../db');
const oracledb = require('oracledb');

const packageSpec = `
CREATE OR REPLACE PACKAGE patient_reg_pkg AS
    -- Procedure to search for a patient by National ID or Birth Certificate Number
    PROCEDURE find_patient(
        p_identity       IN  VARCHAR2,
        p_found          OUT NUMBER,
        p_patient_id     OUT NUMBER,
        p_full_name      OUT VARCHAR2,
        p_date_of_birth  OUT DATE,
        p_gender         OUT VARCHAR2,
        p_blood_group    OUT VARCHAR2,
        p_contact_number OUT VARCHAR2,
        p_occupation     OUT VARCHAR2,
        p_street_address OUT VARCHAR2,
        p_city           OUT VARCHAR2,
        p_division       OUT VARCHAR2,
        p_photo_url      OUT VARCHAR2
    );

    -- Procedure to register a new patient and return the generated patient_id
    PROCEDURE register_patient(
        p_national_id     IN  VARCHAR2,
        p_birth_cert_no   IN  VARCHAR2,
        p_full_name       IN  VARCHAR2,
        p_date_of_birth   IN  DATE,
        p_gender          IN  VARCHAR2,
        p_blood_group     IN  VARCHAR2,
        p_contact_number  IN  VARCHAR2,
        p_occupation      IN  VARCHAR2,
        p_street_address  IN  VARCHAR2,
        p_city            IN  VARCHAR2,
        p_division        IN  VARCHAR2,
        p_photo_url       IN  VARCHAR2,
        p_patient_id      OUT NUMBER
    );
END patient_reg_pkg;
`;

const packageBody = `
CREATE OR REPLACE PACKAGE BODY patient_reg_pkg AS

    PROCEDURE find_patient(
        p_identity       IN  VARCHAR2,
        p_found          OUT NUMBER,
        p_patient_id     OUT NUMBER,
        p_full_name      OUT VARCHAR2,
        p_date_of_birth  OUT DATE,
        p_gender         OUT VARCHAR2,
        p_blood_group    OUT VARCHAR2,
        p_contact_number OUT VARCHAR2,
        p_occupation     OUT VARCHAR2,
        p_street_address OUT VARCHAR2,
        p_city           OUT VARCHAR2,
        p_division       OUT VARCHAR2,
        p_photo_url      OUT VARCHAR2
    ) IS
    BEGIN
        SELECT patient_id, full_name, date_of_birth, gender, blood_group, 
               contact_number, occupation, street_address, city, division, photo_url
        INTO p_patient_id, p_full_name, p_date_of_birth, p_gender, p_blood_group, 
             p_contact_number, p_occupation, p_street_address, p_city, p_division, p_photo_url
        FROM PATIENTS
        WHERE national_id = p_identity OR birth_cert_no = p_identity;
        
        p_found := 1; -- Found
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            p_found := 0; -- Not found
            p_patient_id := NULL;
            p_full_name := NULL;
            p_date_of_birth := NULL;
            p_gender := NULL;
            p_blood_group := NULL;
            p_contact_number := NULL;
            p_occupation := NULL;
            p_street_address := NULL;
            p_city := NULL;
            p_division := NULL;
            p_photo_url := NULL;
        WHEN OTHERS THEN
            RAISE;
    END find_patient;

    PROCEDURE register_patient(
        p_national_id     IN  VARCHAR2,
        p_birth_cert_no   IN  VARCHAR2,
        p_full_name       IN  VARCHAR2,
        p_date_of_birth   IN  DATE,
        p_gender          IN  VARCHAR2,
        p_blood_group     IN  VARCHAR2,
        p_contact_number  IN  VARCHAR2,
        p_occupation      IN  VARCHAR2,
        p_street_address  IN  VARCHAR2,
        p_city            IN  VARCHAR2,
        p_division        IN  VARCHAR2,
        p_photo_url       IN  VARCHAR2,
        p_patient_id      OUT NUMBER
    ) IS
        v_count NUMBER;
    BEGIN
        -- 1. Input Validation: Check that NID or BCN is provided
        IF p_national_id IS NULL AND p_birth_cert_no IS NULL THEN
            raise_application_error(-20101, 'Identity Error: Either National ID or Birth Certificate Number must be provided.');
        END IF;

        -- 1b. National ID: digits only, length 11
        IF p_national_id IS NOT NULL THEN
            IF NOT REGEXP_LIKE(p_national_id, '^[0-9]+$') THEN
                raise_application_error(-20105, 'Validation Error: National ID must contain digits only.');
            END IF;
            IF LENGTH(p_national_id) != 11 THEN
                raise_application_error(-20106, 'Validation Error: National ID must be exactly 11 digits.');
            END IF;
        END IF;

        -- 1c. Birth Certificate: digits only, length 17
        IF p_birth_cert_no IS NOT NULL THEN
            IF NOT REGEXP_LIKE(p_birth_cert_no, '^[0-9]+$') THEN
                raise_application_error(-20107, 'Validation Error: Birth Certificate Number must contain digits only.');
            END IF;
            IF LENGTH(p_birth_cert_no) <> 17 THEN
                raise_application_error(-20108, 'Validation Error: Birth Certificate Number must be exactly 17 digits.');
            END IF;
        END IF;

        -- 1d. Contact: BD mobile 01[3-9]XXXXXXXX
        IF p_contact_number IS NULL OR NOT REGEXP_LIKE(p_contact_number, '^01[3-9][0-9]{8}$') THEN
            raise_application_error(-20109, 'Validation Error: Contact number must be a valid BD mobile (11 digits, 013-019...).');
        END IF;

        -- 2. Validate Gender
        IF p_gender NOT IN ('Male', 'Female', 'Other') THEN
            raise_application_error(-20102, 'Validation Error: Invalid value for Gender. Must be Male, Female, or Other.');
        END IF;

        -- 3. Validate Duplicate NID/BCN
        IF p_national_id IS NOT NULL THEN
            SELECT COUNT(*) INTO v_count FROM PATIENTS WHERE national_id = p_national_id;
            IF v_count > 0 THEN
                raise_application_error(-20103, 'Validation Error: A patient with this National ID is already registered.');
            END IF;
        END IF;

        IF p_birth_cert_no IS NOT NULL THEN
            SELECT COUNT(*) INTO v_count FROM PATIENTS WHERE birth_cert_no = p_birth_cert_no;
            IF v_count > 0 THEN
                raise_application_error(-20104, 'Validation Error: A patient with this Birth Certificate Number is already registered.');
            END IF;
        END IF;

        -- 4. Insert patient record (patient_id is handled by the pre-insert trigger seq_patients_auto)
        INSERT INTO PATIENTS (
            national_id, birth_cert_no, full_name, date_of_birth, gender, 
            blood_group, contact_number, occupation, street_address, city, division, photo_url
        ) VALUES (
            p_national_id, p_birth_cert_no, p_full_name, p_date_of_birth, p_gender, 
            p_blood_group, p_contact_number, p_occupation, p_street_address, p_city, p_division, p_photo_url
        )
        RETURNING patient_id INTO p_patient_id;

    END register_patient;

END patient_reg_pkg;
`;

async function runSetup() {
  try {
    console.log('Connecting to database...');
    await initializeDb();

    // 1. Compile Package Specification
    console.log('\nCompiling PL/SQL Package Specification (PATIENT_REG_PKG)...');
    await executeQuery(packageSpec);
    console.log('Package Specification compiled successfully.');

    // 2. Compile Package Body
    console.log('\nCompiling PL/SQL Package Body (PATIENT_REG_PKG)...');
    await executeQuery(packageBody);
    console.log('Package Body compiled successfully.');

    // 3. Test Package Call (DML requires connection to verify transaction commits)
    console.log('\nTesting PL/SQL package procedures...');
    const testNid = '99998888777'; // 11-digit NID for package smoke test

    
    // We get connection from pool manually to perform a transactional PL/SQL execution
    const pool = await initializeDb();
    const conn = await pool.getConnection();

    try {
      console.log(`\nRegistering test patient via PL/SQL (NID: ${testNid})...`);
      
      const regResult = await conn.execute(
        `BEGIN
            patient_reg_pkg.register_patient(
                p_national_id => :nid,
                p_birth_cert_no => NULL,
                p_full_name => :name,
                p_date_of_birth => TO_DATE(:dob, 'YYYY-MM-DD'),
                p_gender => :gender,
                p_blood_group => :blood,
                p_contact_number => :phone,
                p_occupation => :occupation,
                p_street_address => :address,
                p_city => :city,
                p_division => :division,
                p_photo_url => NULL,
                p_patient_id => :patient_id
            );
         END;`,
        {
          nid: testNid,
          name: 'Jane Doe Test',
          dob: '1995-04-12',
          gender: 'Female',
          blood: 'O-',
          phone: '01999999999',
          occupation: 'Engineer',
          address: 'Mirpur DOHS',
          city: 'Dhaka',
          division: 'Dhaka',
          patient_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        },
        { autoCommit: true }
      );

      const newId = regResult.outBinds.patient_id;
      console.log(`Patient registered successfully! Auto-assigned Patient ID: ${newId}`);

      // 4. Test Search
      console.log(`\nTesting lookup for registered patient (Identity: ${testNid})...`);
      const searchResult = await conn.execute(
        `BEGIN
            patient_reg_pkg.find_patient(
                p_identity => :identity,
                p_found => :found,
                p_patient_id => :patient_id,
                p_full_name => :full_name,
                p_date_of_birth => :date_of_birth,
                p_gender => :gender,
                p_blood_group => :blood_group,
                p_contact_number => :contact_number,
                p_occupation => :occupation,
                p_street_address => :street_address,
                p_city => :city,
                p_division => :division,
                p_photo_url => :photo_url
            );
         END;`,
        {
          identity: testNid,
          found: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
          patient_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
          full_name: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
          date_of_birth: { type: oracledb.DATE, dir: oracledb.BIND_OUT },
          gender: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
          blood_group: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
          contact_number: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
          occupation: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
          street_address: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
          city: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
          division: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
          photo_url: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
        }
      );

      if (searchResult.outBinds.found === 1) {
        console.log('Search Verification: Patient found successfully!');
        console.log(`- Name: ${searchResult.outBinds.full_name}`);
        console.log(`- DOB: ${searchResult.outBinds.date_of_birth}`);
        console.log(`- Gender: ${searchResult.outBinds.gender}`);
        console.log(`- Blood Group: ${searchResult.outBinds.blood_group}`);
      } else {
        console.error('Search Verification Failed: Patient not found.');
      }

      // Cleanup test patient so test remains idempotent
      console.log('\nCleaning up test patient record...');
      await conn.execute('DELETE FROM PATIENTS WHERE patient_id = :id', [newId], { autoCommit: true });
      console.log('Test patient record deleted successfully.');

    } finally {
      await conn.close();
    }

    console.log('\nPL/SQL Package creation and validation completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('\nPL/SQL package compilation/test failed:', err.message);
    process.exit(1);
  }
}

runSetup();
