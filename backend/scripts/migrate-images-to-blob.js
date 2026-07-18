/**
 * Store clinical / sample images as Oracle BLOBs (not disk files).
 * Safe to re-run.
 */
const fs = require('fs');
const path = require('path');
const oracledb = require('oracledb');
const { initializeDb, executeQuery, getPool } = require('../db');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

async function addColumn(sql, label) {
  try {
    await executeQuery(sql, {}, { autoCommit: true });
    console.log(`Added ${label}.`);
  } catch (err) {
    if (err.message.includes('ORA-01430')) console.log(`${label} already exists.`);
    else throw err;
  }
}

async function run() {
  await initializeDb();

  console.log('Adding BLOB columns...');
  await addColumn(
    `ALTER TABLE CASE_RECORDS ADD (
       affected_part_image      BLOB,
       affected_part_image_mime VARCHAR2(100)
     )`,
    'CASE_RECORDS.affected_part_image / mime'
  );
  await addColumn(
    `ALTER TABLE DISEASES ADD (
       sample_image      BLOB,
       sample_image_mime VARCHAR2(100)
     )`,
    'DISEASES.sample_image / mime'
  );

  console.log('Creating PENDING_IMAGE_UPLOADS...');
  try {
    await executeQuery(
      `CREATE TABLE PENDING_IMAGE_UPLOADS (
         upload_id   NUMBER,
         hospital_id NUMBER NOT NULL,
         image_blob  BLOB NOT NULL,
         mime_type   VARCHAR2(100) NOT NULL,
         created_at  DATE DEFAULT SYSDATE,
         CONSTRAINT pk_pending_uploads PRIMARY KEY (upload_id),
         CONSTRAINT fk_pending_hospital FOREIGN KEY (hospital_id) REFERENCES HOSPITALS(hospital_id)
       )`,
      {},
      { autoCommit: true }
    );
    console.log('Table PENDING_IMAGE_UPLOADS created.');
  } catch (err) {
    if (err.message.includes('ORA-00955')) console.log('PENDING_IMAGE_UPLOADS already exists.');
    else throw err;
  }

  try {
    await executeQuery(
      `CREATE SEQUENCE seq_pending_upload_id START WITH 1 INCREMENT BY 1`,
      {},
      { autoCommit: true }
    );
    console.log('Sequence seq_pending_upload_id created.');
  } catch (err) {
    if (err.message.includes('ORA-00955')) console.log('Sequence already exists.');
    else throw err;
  }

  try {
    await executeQuery(
      `CREATE OR REPLACE TRIGGER trg_pending_uploads_auto
         BEFORE INSERT ON PENDING_IMAGE_UPLOADS
         FOR EACH ROW
       BEGIN
         IF :NEW.upload_id IS NULL THEN
           SELECT seq_pending_upload_id.NEXTVAL INTO :NEW.upload_id FROM DUAL;
         END IF;
       END;`,
      {},
      { autoCommit: true }
    );
    console.log('Trigger trg_pending_uploads_auto ready.');
  } catch (err) {
    console.warn('Trigger note:', err.message);
  }

  // Migrate any existing disk-backed URLs into BLOBs
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    const cases = await conn.execute(
      `SELECT case_id, affected_part_image_url
       FROM CASE_RECORDS
       WHERE affected_part_image_url IS NOT NULL
         AND affected_part_image_mime IS NULL`
    );
    let migratedCases = 0;
    for (const row of cases.rows || []) {
      const url = row.AFFECTED_PART_IMAGE_URL;
      const m = String(url || '').match(/^\/uploads\/cases\/([A-Za-z0-9._-]+)$/);
      if (!m) continue;
      const filePath = path.join(UPLOAD_ROOT, 'cases', m[1]);
      if (!fs.existsSync(filePath)) continue;
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(m[1]).toLowerCase();
      const mime =
        ext === '.png' ? 'image/png'
          : ext === '.webp' ? 'image/webp'
            : ext === '.gif' ? 'image/gif'
              : 'image/jpeg';
      await conn.execute(
        `UPDATE CASE_RECORDS SET
           affected_part_image = :blob,
           affected_part_image_mime = :mime
         WHERE case_id = :id`,
        { blob: buf, mime, id: row.CASE_ID },
        { autoCommit: true }
      );
      migratedCases += 1;
    }
    console.log(`Migrated ${migratedCases} case image(s) from disk into BLOBs.`);

    const diseases = await conn.execute(
      `SELECT disease_id, sample_image_url
       FROM DISEASES
       WHERE sample_image_url IS NOT NULL
         AND sample_image_mime IS NULL`
    );
    let migratedDiseases = 0;
    for (const row of diseases.rows || []) {
      const url = row.SAMPLE_IMAGE_URL;
      const m = String(url || '').match(/^\/uploads\/diseases\/([A-Za-z0-9._-]+)$/);
      if (!m) continue;
      const filePath = path.join(UPLOAD_ROOT, 'diseases', m[1]);
      if (!fs.existsSync(filePath)) continue;
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(m[1]).toLowerCase();
      const mime =
        ext === '.png' ? 'image/png'
          : ext === '.webp' ? 'image/webp'
            : ext === '.gif' ? 'image/gif'
              : 'image/jpeg';
      await conn.execute(
        `UPDATE DISEASES SET
           sample_image = :blob,
           sample_image_mime = :mime
         WHERE disease_id = :id`,
        { blob: buf, mime, id: row.DISEASE_ID },
        { autoCommit: true }
      );
      migratedDiseases += 1;
    }
    console.log(`Migrated ${migratedDiseases} disease sample(s) from disk into BLOBs.`);
  } finally {
    await conn.close();
  }

  console.log('BLOB image migration complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
