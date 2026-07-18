/**
 * Adds disease sample images + per-case affected-body-part image support.
 * Enables the case photo field only for diseases that can show a body-part sample.
 * Safe to re-run.
 */
const { executeQuery, initializeDb } = require('../db');
const { FIELD_CATALOG } = require('../field-catalog');
const { diseaseAllowsBodyPartImage } = require('../disease-catalog');

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

  console.log('Migrating body-part image columns...');
  await addColumn(
    `ALTER TABLE DISEASES ADD (
       sample_image_url     VARCHAR2(500),
       sample_image_caption VARCHAR2(200)
     )`,
    'DISEASES.sample_image_url / sample_image_caption'
  );
  await addColumn(
    `ALTER TABLE CASE_RECORDS ADD (affected_part_image_url VARCHAR2(500))`,
    'CASE_RECORDS.affected_part_image_url'
  );

  console.log('Allowing field_type = image on DISEASE_FORM_FIELDS...');
  try {
    await executeQuery(
      `ALTER TABLE DISEASE_FORM_FIELDS DROP CONSTRAINT chk_dff_type`,
      {},
      { autoCommit: true }
    );
  } catch (err) {
    if (!err.message.includes('ORA-02443')) throw err;
  }
  try {
    await executeQuery(
      `ALTER TABLE DISEASE_FORM_FIELDS ADD CONSTRAINT chk_dff_type
       CHECK (field_type IN ('text', 'textarea', 'select', 'date', 'number', 'image'))`,
      {},
      { autoCommit: true }
    );
    console.log('Updated chk_dff_type.');
  } catch (err) {
    if (err.message.includes('ORA-02264') || err.message.includes('ORA-02275')) {
      console.log('chk_dff_type already updated.');
    } else throw err;
  }

  const imageField = FIELD_CATALOG.find((f) => f.key === 'affected_part_image');
  if (!imageField) throw new Error('affected_part_image missing from field-catalog.js');

  const diseases = await executeQuery(
    `SELECT disease_id, disease_code, category FROM DISEASES`
  );
  let inserted = 0;
  let updated = 0;
  let enabledCount = 0;

  for (const row of diseases.rows) {
    const diseaseId = row.DISEASE_ID;
    const enabled = diseaseAllowsBodyPartImage(row.DISEASE_CODE) ? 'Y' : 'N';
    if (enabled === 'Y') enabledCount++;

    const existing = await executeQuery(
      `SELECT config_id FROM DISEASE_FORM_FIELDS
       WHERE disease_id = :did AND field_key = :fkey`,
      { did: diseaseId, fkey: imageField.key }
    );
    if (existing.rows.length) {
      await executeQuery(
        `UPDATE DISEASE_FORM_FIELDS
         SET field_label = :label, field_type = :ftype, field_options = NULL,
             is_required = 'N', display_order = :ord, is_enabled = :en
         WHERE disease_id = :did AND field_key = :fkey`,
        {
          label: imageField.label,
          ftype: imageField.type,
          ord: FIELD_CATALOG.length,
          en: enabled,
          did: diseaseId,
          fkey: imageField.key
        },
        { autoCommit: true }
      );
      updated++;
    } else {
      await executeQuery(
        `INSERT INTO DISEASE_FORM_FIELDS (
           disease_id, field_key, field_label, field_type, field_options,
           is_required, display_order, is_enabled
         ) VALUES (
           :did, :fkey, :label, :ftype, NULL, 'N', :ord, :en
         )`,
        {
          did: diseaseId,
          fkey: imageField.key,
          label: imageField.label,
          ftype: imageField.type,
          ord: FIELD_CATALOG.length,
          en: enabled
        },
        { autoCommit: true }
      );
      inserted++;
    }
  }

  console.log(
    `Form field affected_part_image: inserted=${inserted}, updated=${updated}, enabled on ${enabledCount} diseases.`
  );
  console.log('Body-part image migration complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
