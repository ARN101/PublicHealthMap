const { executeQuery, initializeDb } = require('../db');
const oracledb = require('oracledb');

const FIELD_CATALOG = [
  { key: 'diagnosis_date', label: 'Diagnosis Date', type: 'date', defaultRequired: 'Y', order: 1 },
  { key: 'symptoms_list', label: 'Symptoms List', type: 'textarea', defaultRequired: 'Y', order: 2 },
  { key: 'severity_at_admission', label: 'Severity at Admission', type: 'select', defaultRequired: 'Y', order: 3,
    options: 'Mild|Moderate|Severe|Critical' },
  { key: 'diagnosis_method', label: 'Diagnosis Method', type: 'select', defaultRequired: 'Y', order: 4,
    options: 'PCR|Antigen|Clinical|Culture|Imaging' },
  { key: 'patient_status', label: 'Patient Status', type: 'select', defaultRequired: 'N', order: 5,
    options: 'Active|Recovered|Deceased' },
  { key: 'isolation_status', label: 'Isolation Status', type: 'select', defaultRequired: 'Y', order: 6,
    options: 'Home Isolation|General Ward|ICU|CCU' },
  { key: 'infection_source', label: 'Infection Source', type: 'select', defaultRequired: 'Y', order: 7,
    options: 'Local Transmission|Imported|Unknown' },
  { key: 'co_morbidities', label: 'Co-morbidities', type: 'textarea', defaultRequired: 'N', order: 8 },
  { key: 'travel_history', label: 'Travel History', type: 'textarea', defaultRequired: 'N', order: 9 },
  { key: 'notes', label: 'Clinical Notes', type: 'textarea', defaultRequired: 'N', order: 10 },
  { key: 'affected_part_image', label: 'Affected body part (photo)', type: 'image', defaultRequired: 'N', order: 11 }
];

// Disease-specific recommended defaults (which fields are enabled)
const DISEASE_DEFAULTS = {
  COVID19: ['diagnosis_date', 'symptoms_list', 'severity_at_admission', 'diagnosis_method', 'patient_status', 'isolation_status', 'infection_source', 'co_morbidities', 'travel_history', 'notes'],
  DENGUE: ['diagnosis_date', 'symptoms_list', 'severity_at_admission', 'diagnosis_method', 'patient_status', 'isolation_status', 'infection_source', 'notes'],
  CHOLERA: ['diagnosis_date', 'symptoms_list', 'severity_at_admission', 'diagnosis_method', 'patient_status', 'isolation_status', 'infection_source', 'travel_history', 'notes'],
  TB: ['diagnosis_date', 'symptoms_list', 'severity_at_admission', 'diagnosis_method', 'patient_status', 'isolation_status', 'infection_source', 'co_morbidities', 'notes']
};

async function run() {
  let conn;
  try {
    const pool = await initializeDb();
    conn = await pool.getConnection();

    console.log('Ensuring DISEASES.is_active column...');
    try {
      await conn.execute(`ALTER TABLE DISEASES ADD (is_active CHAR(1) DEFAULT 'Y' NOT NULL)`);
      console.log('Added is_active.');
    } catch (err) {
      if (err.message.includes('ORA-01430')) console.log('is_active already exists.');
      else throw err;
    }

    console.log('Creating DISEASE_FORM_FIELDS table...');
    try {
      await conn.execute(`
        CREATE TABLE DISEASE_FORM_FIELDS (
          config_id       NUMBER,
          disease_id      NUMBER NOT NULL,
          field_key       VARCHAR2(50) NOT NULL,
          field_label     VARCHAR2(100) NOT NULL,
          field_type      VARCHAR2(20) NOT NULL,
          field_options   VARCHAR2(500),
          is_required     CHAR(1) DEFAULT 'N' NOT NULL,
          display_order   NUMBER DEFAULT 1 NOT NULL,
          is_enabled      CHAR(1) DEFAULT 'Y' NOT NULL,
          CONSTRAINT pk_disease_form_fields PRIMARY KEY (config_id),
          CONSTRAINT fk_dff_disease FOREIGN KEY (disease_id) REFERENCES DISEASES(disease_id),
          CONSTRAINT uk_dff_disease_field UNIQUE (disease_id, field_key),
          CONSTRAINT chk_dff_required CHECK (is_required IN ('Y', 'N')),
          CONSTRAINT chk_dff_enabled CHECK (is_enabled IN ('Y', 'N')),
          CONSTRAINT chk_dff_type CHECK (field_type IN ('text', 'textarea', 'select', 'date', 'number', 'image'))
        )
      `);
      console.log('Table created.');
    } catch (err) {
      if (err.message.includes('ORA-00955')) console.log('Table already exists.');
      else throw err;
    }

    try {
      await conn.execute(`CREATE SEQUENCE seq_form_config_id START WITH 1 INCREMENT BY 1`);
      console.log('Sequence created.');
    } catch (err) {
      if (err.message.includes('ORA-00955')) console.log('Sequence already exists.');
      else throw err;
    }

    await conn.execute(`
      CREATE OR REPLACE TRIGGER trg_disease_form_fields_auto
      BEFORE INSERT ON DISEASE_FORM_FIELDS
      FOR EACH ROW
      WHEN (NEW.config_id IS NULL)
      BEGIN
          SELECT seq_form_config_id.NEXTVAL INTO :NEW.config_id FROM dual;
      END;
    `);
    console.log('Trigger compiled.');

    await conn.execute(`UPDATE DISEASES SET is_active = 'Y' WHERE is_active IS NULL`);

    const diseases = await conn.execute(`SELECT disease_id, disease_code FROM DISEASES`);
    for (const d of diseases.rows) {
      const code = d.DISEASE_CODE;
      const enabledKeys = DISEASE_DEFAULTS[code] || FIELD_CATALOG.map((f) => f.key);

      for (const field of FIELD_CATALOG) {
        const enabled = enabledKeys.includes(field.key) ? 'Y' : 'N';
        const existing = await conn.execute(
          `SELECT config_id FROM DISEASE_FORM_FIELDS WHERE disease_id = :did AND field_key = :fkey`,
          { did: d.DISEASE_ID, fkey: field.key }
        );
        if (existing.rows.length) {
          await conn.execute(
            `UPDATE DISEASE_FORM_FIELDS
             SET field_label = :label, field_type = :ftype, field_options = :opts,
                 is_required = :req, display_order = :ord, is_enabled = :en
             WHERE disease_id = :did AND field_key = :fkey`,
            {
              label: field.label,
              ftype: field.type,
              opts: field.options || null,
              req: field.defaultRequired,
              ord: field.order,
              en: enabled,
              did: d.DISEASE_ID,
              fkey: field.key
            }
          );
        } else {
          await conn.execute(
            `INSERT INTO DISEASE_FORM_FIELDS (
               disease_id, field_key, field_label, field_type, field_options,
               is_required, display_order, is_enabled
             ) VALUES (
               :did, :fkey, :label, :ftype, :opts, :req, :ord, :en
             )`,
            {
              did: d.DISEASE_ID,
              fkey: field.key,
              label: field.label,
              ftype: field.type,
              opts: field.options || null,
              req: field.defaultRequired,
              ord: field.order,
              en: enabled
            }
          );
        }
      }
      console.log(`Form config seeded/updated for ${code}`);
    }

    await conn.commit();
    const count = await conn.execute(`SELECT COUNT(*) AS C FROM DISEASE_FORM_FIELDS`);
    console.log(`Total form field configs: ${count.rows[0].C}`);
    console.log('Disease form setup complete.');
    process.exit(0);
  } catch (err) {
    console.error('Setup failed:', err.message);
    if (conn) {
      try { await conn.rollback(); } catch (_) { /* ignore */ }
    }
    process.exit(1);
  } finally {
    if (conn) {
      try { await conn.close(); } catch (_) { /* ignore */ }
    }
  }
}

run();
