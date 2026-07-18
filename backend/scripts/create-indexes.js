const { executeQuery, initializeDb } = require('../db');

const indexes = [
  {
    name: 'idx_patients_nid',
    sql: 'CREATE INDEX idx_patients_nid ON PATIENTS(national_id)'
  },
  {
    name: 'idx_patients_bcn',
    sql: 'CREATE INDEX idx_patients_bcn ON PATIENTS(birth_cert_no)'
  },
  {
    name: 'idx_cases_date_dis',
    sql: 'CREATE INDEX idx_cases_date_dis ON CASE_RECORDS(disease_id, diagnosis_date)'
  },
  {
    name: 'idx_patients_location',
    sql: 'CREATE INDEX idx_patients_location ON PATIENTS(division, city)'
  }
];

async function runSetup() {
  try {
    console.log('Connecting to database...');
    await initializeDb();

    console.log('\nCreating performance indexes...');
    for (const idx of indexes) {
      try {
        await executeQuery(idx.sql);
        console.log(`Created index: ${idx.name}`);
      } catch (err) {
        // ORA-00955: name already used; ORA-01408: column list already indexed (e.g. unique constraints)
        if (err.message.includes('ORA-00955') || err.message.includes('ORA-01408')) {
          console.log(`Index ${idx.name} already covered/exists. Skipping. (${err.message.split('\n')[0]})`);
        } else {
          throw err;
        }
      }
    }

    const result = await executeQuery(
      `SELECT index_name, table_name FROM user_indexes
       WHERE index_name LIKE 'IDX_%'
       ORDER BY index_name`
    );
    console.log('\nVerification - indexes present:');
    console.table(result.rows);

    console.log('\nIndex setup completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('\nIndex setup failed:', err.message);
    process.exit(1);
  }
}

runSetup();
