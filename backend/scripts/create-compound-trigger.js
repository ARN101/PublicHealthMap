const { executeQuery, initializeDb } = require('../db');

const compoundTriggerSql = `
CREATE OR REPLACE TRIGGER trg_prevent_duplicate_case
FOR INSERT ON CASE_RECORDS
COMPOUND TRIGGER

    -- Record structure to track the rows currently being inserted in the statement
    TYPE t_case_info IS RECORD (
        patient_id  CASE_RECORDS.patient_id%TYPE,
        disease_id  CASE_RECORDS.disease_id%TYPE,
        diag_date   CASE_RECORDS.diagnosis_date%TYPE
    );
    
    TYPE t_case_list IS TABLE OF t_case_info INDEX BY PLS_INTEGER;
    g_cases t_case_list;

    -- Before execution of the insert statement, clear the temporary collection
    BEFORE STATEMENT IS
    BEGIN
        g_cases.DELETE;
    END BEFORE STATEMENT;

    -- For each row inserted, record the values to validate later
    AFTER EACH ROW IS
    BEGIN
        g_cases(g_cases.COUNT + 1).patient_id := :new.patient_id;
        g_cases(g_cases.COUNT).disease_id := :new.disease_id;
        g_cases(g_cases.COUNT).diag_date := :new.diagnosis_date;
    END AFTER EACH ROW;

    -- After the statement finishes inserting all rows, query the full table (no mutating table error occurs)
    AFTER STATEMENT IS
        v_dup_count NUMBER;
    BEGIN
        FOR i IN 1..g_cases.COUNT LOOP
            SELECT COUNT(*)
            INTO v_dup_count
            FROM CASE_RECORDS
            WHERE patient_id = g_cases(i).patient_id
              AND disease_id = g_cases(i).disease_id
              AND ABS(diagnosis_date - g_cases(i).diag_date) <= 30;
              
            IF v_dup_count > 1 THEN
                raise_application_error(-20201, 'Duplicate Case Error: A record for this patient and disease has already been registered within the last 30 days.');
            END IF;
        END LOOP;
    END AFTER STATEMENT;

END trg_prevent_duplicate_case;
`;

async function runSetup() {
  try {
    console.log('Connecting to database...');
    await initializeDb();

    console.log('Compiling PL/SQL Compound Trigger (trg_prevent_duplicate_case)...');
    await executeQuery(compoundTriggerSql);
    console.log('Compound Trigger compiled successfully.');

    process.exit(0);
  } catch (err) {
    console.error('Compound trigger creation failed:', err.message);
    process.exit(1);
  }
}

runSetup();
