const { initializeDb } = require('../db');
const { hashPassword } = require('../auth');
const oracledb = require('oracledb');

const DEMO_HOSPITAL_PASSWORD = 'hospital123';
const DEMO_RESEARCHER_PASSWORD = 'research123';

async function runSetup() {
  let conn;
  try {
    console.log('Connecting to database...');
    const pool = await initializeDb();
    conn = await pool.getConnection();

    const hospitalHash = await hashPassword(DEMO_HOSPITAL_PASSWORD);
    const researcherHash = await hashPassword(DEMO_RESEARCHER_PASSWORD);

    console.log('\nUpdating hospital password hashes...');
    const hospUpdate = await conn.execute(
      `UPDATE HOSPITALS
       SET password_hash = :hash
       WHERE license_number LIKE 'HOSP-%'`,
      { hash: hospitalHash },
      { autoCommit: true }
    );
    console.log(`Updated ${hospUpdate.rowsAffected} hospital credential(s).`);

    console.log('\nSeeding approved research organization (IEDCR)...');
    await conn.execute(
      `DELETE FROM DOWNLOAD_LOGS
       WHERE org_id IN (
         SELECT org_id FROM RESEARCH_ORGANIZATIONS
         WHERE registration_number = 'RES-ORG-DHAKA-2026' OR email = 'iedcr@research.org.bd'
       )`,
      [],
      { autoCommit: true }
    );
    await conn.execute(
      `DELETE FROM RESEARCH_ORGANIZATIONS
       WHERE registration_number = 'RES-ORG-DHAKA-2026' OR email = 'iedcr@research.org.bd'`,
      [],
      { autoCommit: true }
    );

    const orgRes = await conn.execute(
      `INSERT INTO RESEARCH_ORGANIZATIONS (
         registration_number, name, email, password_hash, approval_status, purpose_statement
       ) VALUES (
         :reg, :name, :email, :pwd, 'Approved', :purpose
       ) RETURNING org_id INTO :org_id`,
      {
        reg: 'RES-ORG-DHAKA-2026',
        name: 'Institute of Epidemiology Disease Control and Research (IEDCR)',
        email: 'iedcr@research.org.bd',
        pwd: researcherHash,
        purpose: 'Epidemiological studies on geographic trends of dengue and coronavirus transmission vectors in urban centers.',
        org_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );

    console.log(`Approved research org created. ORG_ID=${orgRes.outBinds.org_id[0]}`);
    console.log('\nDemo credentials:');
    console.log(`  Hospital login : hosp-1001-dhk@health.gov.bd / ${DEMO_HOSPITAL_PASSWORD}`);
    console.log(`  Researcher login: iedcr@research.org.bd / ${DEMO_RESEARCHER_PASSWORD}`);
    console.log('\nAuth credential setup completed.');
    process.exit(0);
  } catch (err) {
    console.error('\nAuth credential setup failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) {
      try { await conn.close(); } catch (_) { /* ignore */ }
    }
  }
}

runSetup();
