/**
 * Migrates DISEASES for multi-specialty taxonomy and seeds an enriched disease list.
 * Safe to re-run (upsert by disease_code).
 */
const oracledb = require('oracledb');
const { initializeDb } = require('../db');
const { FIELD_CATALOG } = require('../field-catalog');
const {
  TRANSMISSION_MODES,
  ENRICHED_DISEASES,
  formKeysForDisease
} = require('../disease-catalog');

async function ensureColumn(conn, ddl, alreadyMsg) {
  try {
    await conn.execute(ddl);
    console.log('Applied:', ddl.slice(0, 80) + '...');
  } catch (err) {
    if (err.message.includes('ORA-01430') || err.message.includes('ORA-00955')) {
      console.log(alreadyMsg);
    } else {
      throw err;
    }
  }
}

async function run() {
  let conn;
  try {
    const pool = await initializeDb();
    conn = await pool.getConnection();

    console.log('--- Schema migration ---');
    await ensureColumn(
      conn,
      `ALTER TABLE DISEASES ADD (category VARCHAR2(50))`,
      'category column already exists.'
    );
    await ensureColumn(
      conn,
      `ALTER TABLE DISEASES ADD (subcategory VARCHAR2(80))`,
      'subcategory column already exists.'
    );
    await ensureColumn(
      conn,
      `ALTER TABLE DISEASES ADD (is_active CHAR(1) DEFAULT 'Y' NOT NULL)`,
      'is_active column already exists.'
    );

    // Widen disease_code if needed for longer codes
    try {
      await conn.execute(`ALTER TABLE DISEASES MODIFY (disease_code VARCHAR2(40))`);
      console.log('Widened disease_code to VARCHAR2(40).');
    } catch (err) {
      console.log('disease_code width OK or skipped:', err.message.slice(0, 60));
    }

    // Expand transmission modes for non-communicable diseases
    try {
      await conn.execute(`ALTER TABLE DISEASES DROP CONSTRAINT chk_disease_transmission`);
      console.log('Dropped old transmission check.');
    } catch (err) {
      if (!err.message.includes('ORA-02443')) throw err;
      console.log('Transmission constraint already dropped or renamed.');
    }

    const modesList = TRANSMISSION_MODES.map((m) => `'${m}'`).join(', ');
    try {
      await conn.execute(
        `ALTER TABLE DISEASES ADD CONSTRAINT chk_disease_transmission
         CHECK (transmission_mode IN (${modesList}))`
      );
      console.log('Added expanded transmission check.');
    } catch (err) {
      if (err.message.includes('ORA-02264') || err.message.includes('ORA-02261')) {
        console.log('Transmission check already present.');
      } else {
        throw err;
      }
    }

    // Tag existing epidemic diseases if columns were just empty
    await conn.execute(`
      UPDATE DISEASES SET
        category = NVL(category, 'Infectious'),
        subcategory = NVL(subcategory,
          CASE disease_code
            WHEN 'COVID19' THEN 'Respiratory Infection'
            WHEN 'TB' THEN 'Respiratory Infection'
            WHEN 'DENGUE' THEN 'Vector-borne'
            WHEN 'CHOLERA' THEN 'Waterborne Infection'
            ELSE 'General'
          END
        ),
        is_active = NVL(is_active, 'Y')
    `);

    console.log('\n--- Seeding enriched diseases ---');
    let inserted = 0;
    let updated = 0;

    for (const d of ENRICHED_DISEASES) {
      const existing = await conn.execute(
        `SELECT disease_id FROM DISEASES WHERE disease_code = :code`,
        { code: d.code }
      );

      let diseaseId;
      if (existing.rows.length) {
        diseaseId = existing.rows[0].DISEASE_ID;
        await conn.execute(
          `UPDATE DISEASES SET
             common_name = :name,
             scientific_name = :sci,
             severity_level = :sev,
             transmission_mode = :trans,
             description = :descr,
             category = :cat,
             subcategory = :sub,
             is_active = 'Y'
           WHERE disease_id = :id`,
          {
            name: d.name,
            sci: d.sci,
            sev: d.severity,
            trans: d.transmission,
            descr: d.desc,
            cat: d.category,
            sub: d.subcategory,
            id: diseaseId
          }
        );
        updated++;
      } else {
        const ins = await conn.execute(
          `INSERT INTO DISEASES (
             disease_code, common_name, scientific_name, severity_level,
             transmission_mode, description, category, subcategory, is_active
           ) VALUES (
             :code, :name, :sci, :sev, :trans, :descr, :cat, :sub, 'Y'
           ) RETURNING disease_id INTO :id`,
          {
            code: d.code,
            name: d.name,
            sci: d.sci,
            sev: d.severity,
            trans: d.transmission,
            descr: d.desc,
            cat: d.category,
            sub: d.subcategory,
            id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
          }
        );
        diseaseId = ins.outBinds.id[0];
        inserted++;
      }

      // Ensure form field rows exist with category-appropriate defaults
      const enabledKeys = formKeysForDisease({ category: d.category, diseaseCode: d.code });
      for (let i = 0; i < FIELD_CATALOG.length; i++) {
        const f = FIELD_CATALOG[i];
        const enabled = enabledKeys.includes(f.key) ? 'Y' : 'N';
        const required = !f.alwaysOptional && (
          ['diagnosis_date', 'symptoms_list', 'severity_at_admission', 'diagnosis_method'].includes(f.key)
          || (d.category === 'Infectious' && ['isolation_status', 'infection_source'].includes(f.key))
        ) ? 'Y' : 'N';

        const row = await conn.execute(
          `SELECT config_id FROM DISEASE_FORM_FIELDS WHERE disease_id = :did AND field_key = :fkey`,
          { did: diseaseId, fkey: f.key }
        );
        if (row.rows.length) {
          await conn.execute(
            `UPDATE DISEASE_FORM_FIELDS
             SET field_label = :label, field_type = :ftype, field_options = :opts,
                 is_required = :req, display_order = :ord, is_enabled = :en
             WHERE disease_id = :did AND field_key = :fkey`,
            {
              label: f.label,
              ftype: f.type,
              opts: f.options ? f.options.join('|') : null,
              req: required,
              ord: i + 1,
              en: enabled,
              did: diseaseId,
              fkey: f.key
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
              did: diseaseId,
              fkey: f.key,
              label: f.label,
              ftype: f.type,
              opts: f.options ? f.options.join('|') : null,
              req: required,
              ord: i + 1,
              en: enabled
            }
          );
        }
      }
    }

    await conn.commit();

    const count = await conn.execute(
      `SELECT category, COUNT(*) AS c FROM DISEASES WHERE NVL(is_active,'Y')='Y' GROUP BY category ORDER BY category`
    );
    console.log(`\nInserted ${inserted}, updated ${updated}.`);
    console.log('Active diseases by category:');
    count.rows.forEach((r) => console.log(`  ${r.CATEGORY}: ${r.C}`));
    console.log('\nDisease taxonomy setup complete.');
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
