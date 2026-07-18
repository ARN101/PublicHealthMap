const { executeQuery, initializeDb } = require('../db');
const oracledb = require('oracledb');

const researchSpec = `
CREATE OR REPLACE PACKAGE research_data_pkg AS
    -- Procedure to fetch anonymized case records using SYS_REFCURSOR.
    -- Enforces organization approval and writes an audit row to DOWNLOAD_LOGS.
    -- p_disease_code / p_division accept a single value or comma-separated list (NULL = all).
    PROCEDURE get_anonymized_cases(
        p_org_id       IN  NUMBER,
        p_disease_code IN  VARCHAR2,
        p_division     IN  VARCHAR2,
        p_start_date   IN  VARCHAR2,
        p_end_date     IN  VARCHAR2,
        p_cursor       OUT SYS_REFCURSOR
    );
END research_data_pkg;
`;

const researchBody = `
CREATE OR REPLACE PACKAGE BODY research_data_pkg AS

    PROCEDURE get_anonymized_cases(
        p_org_id       IN  NUMBER,
        p_disease_code IN  VARCHAR2,
        p_division     IN  VARCHAR2,
        p_start_date   IN  VARCHAR2,
        p_end_date     IN  VARCHAR2,
        p_cursor       OUT SYS_REFCURSOR
    ) IS
        v_status       VARCHAR2(20);
        v_total_rows   NUMBER := 0;
        v_filter       VARCHAR2(500);
        v_disease_csv  VARCHAR2(4000);
        v_division_csv VARCHAR2(4000);
    BEGIN
        IF p_org_id IS NULL THEN
            RAISE_APPLICATION_ERROR(-20002, 'Security Warning: Access Denied. Organization ID is required.');
        END IF;

        BEGIN
            SELECT approval_status
            INTO v_status
            FROM RESEARCH_ORGANIZATIONS
            WHERE org_id = p_org_id;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(-20002, 'Security Warning: Access Denied. Organization not found.');
        END;

        IF v_status != 'Approved' THEN
            RAISE_APPLICATION_ERROR(-20002, 'Security Warning: Access Denied. Organization registration status: ' || v_status);
        END IF;

        -- Comma-separated lists (spaces stripped). NULL / empty = all.
        v_disease_csv  := REPLACE(p_disease_code, ' ', '');
        v_division_csv := REPLACE(p_division, ' ', '');

        SELECT COUNT(*)
        INTO v_total_rows
        FROM CASE_RECORDS cr
        JOIN PATIENTS pat ON cr.patient_id = pat.patient_id
        JOIN DISEASES d ON cr.disease_id = d.disease_id
        WHERE (v_disease_csv IS NULL
               OR INSTR(',' || v_disease_csv || ',', ',' || d.disease_code || ',') > 0)
          AND (v_division_csv IS NULL
               OR INSTR(',' || v_division_csv || ',', ',' || pat.division || ',') > 0)
          AND (p_start_date IS NULL OR cr.diagnosis_date >= TO_DATE(p_start_date, 'YYYY-MM-DD'))
          AND (p_end_date IS NULL OR cr.diagnosis_date <= TO_DATE(p_end_date, 'YYYY-MM-DD'));

        v_filter := SUBSTR(
            'disease=' || NVL(v_disease_csv, 'ALL')
            || ';division=' || NVL(v_division_csv, 'ALL')
            || ';start=' || NVL(p_start_date, 'ALL')
            || ';end=' || NVL(p_end_date, 'ALL'),
            1, 500
        );

        INSERT INTO DOWNLOAD_LOGS (org_id, filter_criteria, total_records)
        VALUES (p_org_id, v_filter, v_total_rows);

        OPEN p_cursor FOR
            SELECT
                LOWER(RAWTOHEX(DBMS_OBFUSCATION_TOOLKIT.MD5(input_string => TO_CHAR(pat.patient_id)))) AS patient_hash,
                FLOOR(MONTHS_BETWEEN(cr.diagnosis_date, pat.date_of_birth) / 12) AS patient_age,
                pat.gender,
                pat.blood_group,
                pat.city,
                pat.division,
                d.disease_code,
                d.common_name AS disease_name,
                cr.diagnosis_date,
                cr.symptoms_list,
                cr.severity_at_admission,
                cr.patient_status,
                cr.case_id,
                CASE WHEN cr.affected_part_image_mime IS NOT NULL THEN 'Y' ELSE 'N' END AS has_image,
                cr.affected_part_image_mime
            FROM CASE_RECORDS cr
            JOIN PATIENTS pat ON cr.patient_id = pat.patient_id
            JOIN DISEASES d ON cr.disease_id = d.disease_id
            WHERE (v_disease_csv IS NULL
                   OR INSTR(',' || v_disease_csv || ',', ',' || d.disease_code || ',') > 0)
              AND (v_division_csv IS NULL
                   OR INSTR(',' || v_division_csv || ',', ',' || pat.division || ',') > 0)
              AND (p_start_date IS NULL OR cr.diagnosis_date >= TO_DATE(p_start_date, 'YYYY-MM-DD'))
              AND (p_end_date IS NULL OR cr.diagnosis_date <= TO_DATE(p_end_date, 'YYYY-MM-DD'))
            ORDER BY cr.diagnosis_date DESC;

    END get_anonymized_cases;

END research_data_pkg;
`;

async function runSetup() {
  try {
    console.log('Connecting to database...');
    await initializeDb();

    console.log('\nCompiling PL/SQL Package Specification (RESEARCH_DATA_PKG)...');
    await executeQuery(researchSpec);
    console.log('Package Specification compiled successfully.');

    console.log('\nCompiling PL/SQL Package Body (RESEARCH_DATA_PKG)...');
    await executeQuery(researchBody);
    console.log('Package Body compiled successfully.');

    console.log('\nValidating approval enforcement and DOWNLOAD_LOGS audit...');
    const pool = await initializeDb();
    const conn = await pool.getConnection();

    try {
      const pendingReg = 'TEST-PENDING-ORG';
      const approvedReg = 'TEST-APPROVED-ORG';

      await conn.execute('DELETE FROM DOWNLOAD_LOGS WHERE org_id IN (SELECT org_id FROM RESEARCH_ORGANIZATIONS WHERE registration_number IN (:a, :b))',
        { a: pendingReg, b: approvedReg }, { autoCommit: true });
      await conn.execute('DELETE FROM RESEARCH_ORGANIZATIONS WHERE registration_number IN (:a, :b)',
        { a: pendingReg, b: approvedReg }, { autoCommit: true });

      const pendingRes = await conn.execute(
        `INSERT INTO RESEARCH_ORGANIZATIONS (registration_number, name, email, password_hash, approval_status, purpose_statement)
         VALUES (:reg, 'Pending Org', 'pending@test.org', 'pwd', 'Pending', 'Test pending access denial')
         RETURNING org_id INTO :org_id`,
        { reg: pendingReg, org_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
        { autoCommit: true }
      );
      const pendingOrgId = pendingRes.outBinds.org_id[0];

      let denied = false;
      try {
        await conn.execute(
          `BEGIN
             research_data_pkg.get_anonymized_cases(
                 p_org_id => :orgId,
                 p_disease_code => NULL,
                 p_division => NULL,
                 p_start_date => NULL,
                 p_end_date => NULL,
                 p_cursor => :cursor
             );
           END;`,
          {
            orgId: pendingOrgId,
            cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
          }
        );
      } catch (err) {
        if (err.message.includes('ORA-20002')) {
          denied = true;
          console.log('Pending org correctly denied (ORA-20002).');
        } else {
          throw err;
        }
      }
      if (!denied) {
        throw new Error('Expected ORA-20002 for pending organization, but call succeeded.');
      }

      const approvedRes = await conn.execute(
        `INSERT INTO RESEARCH_ORGANIZATIONS (registration_number, name, email, password_hash, approval_status, purpose_statement)
         VALUES (:reg, 'Approved Org', 'approved@test.org', 'pwd', 'Approved', 'Test approved export pipeline')
         RETURNING org_id INTO :org_id`,
        { reg: approvedReg, org_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
        { autoCommit: true }
      );
      const approvedOrgId = approvedRes.outBinds.org_id[0];

      const cursorResult = await conn.execute(
        `BEGIN
           research_data_pkg.get_anonymized_cases(
               p_org_id => :orgId,
               p_disease_code => NULL,
               p_division => NULL,
               p_start_date => NULL,
               p_end_date => NULL,
               p_cursor => :cursor
           );
         END;`,
        {
          orgId: approvedOrgId,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        },
        { autoCommit: true }
      );

      const cursor = cursorResult.outBinds.cursor;
      const rows = await cursor.getRows(5);
      await cursor.close();
      console.log(`Approved org export returned ${rows.length} sample row(s).`);

      const logCheck = await conn.execute(
        'SELECT total_records, filter_criteria FROM DOWNLOAD_LOGS WHERE org_id = :id ORDER BY log_id DESC FETCH FIRST 1 ROWS ONLY',
        [approvedOrgId]
      ).catch(async () => {
        // Oracle 11g fallback without FETCH FIRST
        return conn.execute(
          `SELECT total_records, filter_criteria FROM (
             SELECT total_records, filter_criteria FROM DOWNLOAD_LOGS WHERE org_id = :id ORDER BY log_id DESC
           ) WHERE ROWNUM = 1`,
          [approvedOrgId]
        );
      });
      console.log('DOWNLOAD_LOGS audit row:', logCheck.rows[0]);

      await conn.execute('DELETE FROM DOWNLOAD_LOGS WHERE org_id IN (:a, :b)', { a: pendingOrgId, b: approvedOrgId }, { autoCommit: true });
      await conn.execute('DELETE FROM RESEARCH_ORGANIZATIONS WHERE org_id IN (:a, :b)', { a: pendingOrgId, b: approvedOrgId }, { autoCommit: true });
      console.log('Validation cleanup completed.');
    } finally {
      await conn.close();
    }

    console.log('\nPL/SQL Package RESEARCH_DATA_PKG successfully configured and validated.');
    process.exit(0);
  } catch (err) {
    console.error('\nPL/SQL package compilation/validation failed:', err.message);
    process.exit(1);
  }
}

runSetup();
