const { executeQuery, initializeDb } = require('../db');

async function run() {
  try {
    await initializeDb();
    console.log('Adding HOSPITALS.approval_status if missing...');

    try {
      await executeQuery(
        `ALTER TABLE HOSPITALS ADD (
           approval_status VARCHAR2(20) DEFAULT 'Approved' NOT NULL
         )`
      );
      console.log('Column approval_status added.');
    } catch (err) {
      if (err.message.includes('ORA-01430')) {
        console.log('Column approval_status already exists. Skipping add.');
      } else {
        throw err;
      }
    }

    try {
      await executeQuery(
        `ALTER TABLE HOSPITALS ADD CONSTRAINT chk_hospital_approval
         CHECK (approval_status IN ('Pending', 'Approved', 'Rejected'))`
      );
      console.log('Check constraint chk_hospital_approval added.');
    } catch (err) {
      if (err.message.includes('ORA-02264') || err.message.includes('ORA-02261') || err.message.includes('ORA-02436')) {
        console.log('Constraint already present or equivalent. Skipping.');
      } else if (err.message.includes('ORA-02260') || err.message.includes('ORA-02275')) {
        console.log('Constraint already present. Skipping.');
      } else {
        // Some Oracle versions report duplicate differently
        if (err.message.includes('ORA-02264') || err.message.toLowerCase().includes('already')) {
          console.log('Constraint already present. Skipping.');
        } else {
          console.warn('Constraint note:', err.message.split('\n')[0]);
        }
      }
    }

    await executeQuery(
      `UPDATE HOSPITALS
       SET approval_status = 'Approved'
       WHERE approval_status IS NULL OR approval_status = 'Approved'`,
      [],
      { autoCommit: true }
    );

    const check = await executeQuery(
      `SELECT approval_status, COUNT(*) AS c FROM HOSPITALS GROUP BY approval_status`
    );
    console.table(check.rows);
    console.log('Hospital approval migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
