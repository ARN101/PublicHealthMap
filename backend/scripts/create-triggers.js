const { executeQuery, initializeDb } = require('../db');

const dropSequences = [
  'DROP SEQUENCE seq_hospital_id',
  'DROP SEQUENCE seq_patient_id',
  'DROP SEQUENCE seq_disease_id',
  'DROP SEQUENCE seq_case_id',
  'DROP SEQUENCE seq_org_id',
  'DROP SEQUENCE seq_log_id'
];

const createSequences = [
  'CREATE SEQUENCE seq_hospital_id START WITH 1001 INCREMENT BY 1',
  'CREATE SEQUENCE seq_patient_id START WITH 200001 INCREMENT BY 1',
  'CREATE SEQUENCE seq_disease_id START WITH 101 INCREMENT BY 1',
  'CREATE SEQUENCE seq_case_id START WITH 500001 INCREMENT BY 1',
  'CREATE SEQUENCE seq_org_id START WITH 8001 INCREMENT BY 1',
  'CREATE SEQUENCE seq_log_id START WITH 900001 INCREMENT BY 1'
];

const triggers = [
  {
    name: 'trg_hospitals_auto',
    sql: `
      CREATE OR REPLACE TRIGGER trg_hospitals_auto
      BEFORE INSERT ON HOSPITALS
      FOR EACH ROW
      WHEN (NEW.hospital_id IS NULL)
      BEGIN
          SELECT seq_hospital_id.NEXTVAL INTO :NEW.hospital_id FROM dual;
      END;
    `
  },
  {
    name: 'trg_patients_auto',
    sql: `
      CREATE OR REPLACE TRIGGER trg_patients_auto
      BEFORE INSERT ON PATIENTS
      FOR EACH ROW
      WHEN (NEW.patient_id IS NULL)
      BEGIN
          SELECT seq_patient_id.NEXTVAL INTO :NEW.patient_id FROM dual;
      END;
    `
  },
  {
    name: 'trg_diseases_auto',
    sql: `
      CREATE OR REPLACE TRIGGER trg_diseases_auto
      BEFORE INSERT ON DISEASES
      FOR EACH ROW
      WHEN (NEW.disease_id IS NULL)
      BEGIN
          SELECT seq_disease_id.NEXTVAL INTO :NEW.disease_id FROM dual;
      END;
    `
  },
  {
    name: 'trg_case_records_auto',
    sql: `
      CREATE OR REPLACE TRIGGER trg_case_records_auto
      BEFORE INSERT ON CASE_RECORDS
      FOR EACH ROW
      WHEN (NEW.case_id IS NULL)
      BEGIN
          SELECT seq_case_id.NEXTVAL INTO :NEW.case_id FROM dual;
      END;
    `
  },
  {
    name: 'trg_research_orgs_auto',
    sql: `
      CREATE OR REPLACE TRIGGER trg_research_orgs_auto
      BEFORE INSERT ON RESEARCH_ORGANIZATIONS
      FOR EACH ROW
      WHEN (NEW.org_id IS NULL)
      BEGIN
          SELECT seq_org_id.NEXTVAL INTO :NEW.org_id FROM dual;
      END;
    `
  },
  {
    name: 'trg_download_logs_auto',
    sql: `
      CREATE OR REPLACE TRIGGER trg_download_logs_auto
      BEFORE INSERT ON DOWNLOAD_LOGS
      FOR EACH ROW
      WHEN (NEW.log_id IS NULL)
      BEGIN
          SELECT seq_log_id.NEXTVAL INTO :NEW.log_id FROM dual;
      END;
    `
  }
];

const seedDiseases = [
  {
    code: 'COVID19',
    name: 'COVID-19',
    scientific: 'Severe Acute Respiratory Syndrome Coronavirus 2',
    severity: 'Severe',
    transmission: 'Airborne',
    desc: 'Infectious respiratory disease causing mild to critical lung inflammation.'
  },
  {
    code: 'CHOLERA',
    name: 'Cholera',
    scientific: 'Vibrio cholerae',
    severity: 'Severe',
    transmission: 'Waterborne',
    desc: 'Acute diarrheal disease causing rapid dehydration.'
  },
  {
    code: 'DENGUE',
    name: 'Dengue Fever',
    scientific: 'Dengue virus',
    severity: 'Moderate',
    transmission: 'Vector',
    desc: 'Mosquito-borne viral disease causing high fever and joint pain.'
  },
  {
    code: 'TB',
    name: 'Tuberculosis',
    scientific: 'Mycobacterium tuberculosis',
    severity: 'Severe',
    transmission: 'Airborne',
    desc: 'Bacterial infection primarily targeting the lungs, requiring long-term therapy.'
  }
];

async function runSetup() {
  try {
    console.log('Connecting to database...');
    await initializeDb();

    // 1. Drop sequences (ignore if not existing)
    console.log('\nCleaning up old sequences...');
    for (const q of dropSequences) {
      const seqName = q.split(' ')[2];
      try {
        await executeQuery(q);
        console.log(`Dropped sequence: ${seqName}`);
      } catch (err) {
        if (err.message.includes('ORA-02289')) {
          console.log(`Sequence ${seqName} does not exist. Skipping.`);
        } else {
          console.warn(`Warning dropping sequence ${seqName}:`, err.message);
        }
      }
    }

    // 2. Create sequences
    console.log('\nCreating sequences...');
    for (const q of createSequences) {
      const seqName = q.split(' ')[2];
      try {
        await executeQuery(q);
        console.log(`Created sequence: ${seqName}`);
      } catch (err) {
        console.error(`Failed to create sequence ${seqName}:`, err.message);
        throw err;
      }
    }

    // 3. Create auto-increment triggers (PL/SQL blocks)
    console.log('\nCreating PL/SQL auto-increment triggers...');
    for (const trig of triggers) {
      try {
        await executeQuery(trig.sql);
        console.log(`Created trigger: ${trig.name}`);
      } catch (err) {
        console.error(`Failed to create trigger ${trig.name}:`, err.message);
        throw err;
      }
    }

    // 4. Seed initial diseases and test auto-increment trigger
    console.log('\nSeeding and testing trigger with initial DISEASES...');
    for (const d of seedDiseases) {
      try {
        // Run INSERT statement without specifying disease_id to let PL/SQL trigger handle it
        await executeQuery(
          `INSERT INTO DISEASES (
             disease_code, common_name, scientific_name, severity_level, transmission_mode,
             description, category, subcategory, is_active
           ) VALUES (
             :code, :name, :scientific, :severity, :transmission, :description,
             'Infectious', 'General', 'Y'
           )`,
          [d.code, d.name, d.scientific, d.severity, d.transmission, d.desc],
          { autoCommit: true }
        );
        console.log(`Successfully seeded disease: ${d.code}`);
      } catch (err) {
        // If already exists, notify and skip
        if (err.message.includes('ORA-00001')) {
          console.log(`Disease ${d.code} already exists. Skipping seed.`);
        } else {
          console.error(`Failed to seed disease ${d.code}:`, err.message);
          throw err;
        }
      }
    }

    // 5. Query and display results to verify auto-increment
    const result = await executeQuery('SELECT disease_id, disease_code, common_name FROM DISEASES ORDER BY disease_id');
    console.log('\nVerification Query - Current Diseases in Database:');
    console.table(result.rows);

    console.log('\nPL/SQL Trigger & Sequence setup completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('\nPL/SQL trigger setup failed:', err.message);
    process.exit(1);
  }
}

runSetup();
