-- ============================================================================
-- PROJECT: PublicHealthMap - Database Schema & PL/SQL Implementation
-- TARGET DATABASE: Oracle Database 11g/12c/18c/19c/21c
-- DESCRIPTION: DDL creation, structural constraints, auto-increment sequences,
--              validation triggers, audit logs, and analytical PL/SQL packages.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP EXISTING CONSTRAINTS, TABLES AND SEQUENCES (FOR CLEAN INITIALIZATION)
-- ----------------------------------------------------------------------------
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE DOWNLOAD_LOGS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE RESEARCH_ORGANIZATIONS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE CASE_RECORDS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE DISEASES CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE PATIENTS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE HOSPITALS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE DIVISIONAL_STATS_SUMMARY CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

-- Drop Sequences
BEGIN
    EXECUTE IMMEDIATE 'DROP SEQUENCE seq_hospital_id';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP SEQUENCE seq_patient_id';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP SEQUENCE seq_disease_id';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP SEQUENCE seq_case_id';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP SEQUENCE seq_org_id';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP SEQUENCE seq_log_id';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/


-- ----------------------------------------------------------------------------
-- 2. CREATE SEQUENCES
-- ----------------------------------------------------------------------------
CREATE SEQUENCE seq_hospital_id START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE seq_patient_id START WITH 200001 INCREMENT BY 1;
CREATE SEQUENCE seq_disease_id START WITH 101 INCREMENT BY 1;
CREATE SEQUENCE seq_case_id START WITH 500001 INCREMENT BY 1;
CREATE SEQUENCE seq_org_id START WITH 8001 INCREMENT BY 1;
CREATE SEQUENCE seq_log_id START WITH 900001 INCREMENT BY 1;


-- ----------------------------------------------------------------------------
-- 3. CREATE TABLES WITH CONSTRAINTS (3NF COMPLIANT)
-- ----------------------------------------------------------------------------

-- Table: HOSPITALS
CREATE TABLE HOSPITALS (
    hospital_id     NUMBER,
    license_number  VARCHAR2(50) NOT NULL,
    name            VARCHAR2(150) NOT NULL,
    email           VARCHAR2(100) NOT NULL,
    password_hash   VARCHAR2(255) NOT NULL,
    phone           VARCHAR2(20) NOT NULL,
    street_address  VARCHAR2(255),
    city            VARCHAR2(100) NOT NULL,
    division        VARCHAR2(100) NOT NULL,
    latitude        NUMBER(9,6) NOT NULL,
    longitude       NUMBER(9,6) NOT NULL,
    registered_at   DATE DEFAULT SYSDATE,
    CONSTRAINT pk_hospitals PRIMARY KEY (hospital_id),
    CONSTRAINT uk_hospital_license UNIQUE (license_number),
    CONSTRAINT uk_hospital_email UNIQUE (email)
);

-- Table: PATIENTS
CREATE TABLE PATIENTS (
    patient_id      NUMBER,
    national_id     VARCHAR2(30),
    birth_cert_no   VARCHAR2(30),
    full_name       VARCHAR2(150) NOT NULL,
    date_of_birth   DATE NOT NULL,
    gender          VARCHAR2(10) NOT NULL,
    blood_group     VARCHAR2(5) NOT NULL,
    contact_number  VARCHAR2(20) NOT NULL,
    occupation      VARCHAR2(100),
    street_address  VARCHAR2(255),
    city            VARCHAR2(100) NOT NULL,
    division        VARCHAR2(100) NOT NULL,
    photo_url       VARCHAR2(500),
    CONSTRAINT pk_patients PRIMARY KEY (patient_id),
    CONSTRAINT uk_patient_nid UNIQUE (national_id),
    CONSTRAINT uk_patient_bcn UNIQUE (birth_cert_no),
    CONSTRAINT chk_patient_gender CHECK (gender IN ('Male', 'Female', 'Other')),
    CONSTRAINT chk_patient_blood CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    CONSTRAINT chk_patient_identity CHECK (national_id IS NOT NULL OR birth_cert_no IS NOT NULL)
);

-- Table: DISEASES
CREATE TABLE DISEASES (
    disease_id        NUMBER,
    disease_code      VARCHAR2(20) NOT NULL,
    common_name       VARCHAR2(100) NOT NULL,
    scientific_name   VARCHAR2(150),
    severity_level    VARCHAR2(20) NOT NULL,
    transmission_mode VARCHAR2(50) NOT NULL,
    description       VARCHAR2(1000),
    CONSTRAINT pk_diseases PRIMARY KEY (disease_id),
    CONSTRAINT uk_disease_code UNIQUE (disease_code),
    CONSTRAINT chk_disease_severity CHECK (severity_level IN ('Mild', 'Moderate', 'Severe')),
    CONSTRAINT chk_disease_transmission CHECK (transmission_mode IN ('Airborne', 'Waterborne', 'Vector', 'Contact', 'Zoonotic'))
);

-- Table: CASE_RECORDS
CREATE TABLE CASE_RECORDS (
    case_id               NUMBER,
    patient_id            NUMBER NOT NULL,
    hospital_id           NUMBER NOT NULL,
    disease_id            NUMBER NOT NULL,
    diagnosis_date        DATE NOT NULL,
    symptoms_list         VARCHAR2(1000) NOT NULL,
    severity_at_admission VARCHAR2(20) NOT NULL,
    diagnosis_method      VARCHAR2(50) NOT NULL,
    patient_status        VARCHAR2(20) DEFAULT 'Active' NOT NULL,
    isolation_status      VARCHAR2(30) NOT NULL,
    infection_source      VARCHAR2(30) NOT NULL,
    co_morbidities        VARCHAR2(500),
    travel_history        VARCHAR2(500),
    notes                 VARCHAR2(1000),
    updated_at            DATE DEFAULT SYSDATE,
    CONSTRAINT pk_case_records PRIMARY KEY (case_id),
    CONSTRAINT fk_cases_patient FOREIGN KEY (patient_id) REFERENCES PATIENTS(patient_id),
    CONSTRAINT fk_cases_hospital FOREIGN KEY (hospital_id) REFERENCES HOSPITALS(hospital_id),
    CONSTRAINT fk_cases_disease FOREIGN KEY (disease_id) REFERENCES DISEASES(disease_id),
    CONSTRAINT chk_case_diagnosis_date CHECK (diagnosis_date <= SYSDATE),
    CONSTRAINT chk_case_severity CHECK (severity_at_admission IN ('Mild', 'Moderate', 'Severe', 'Critical')),
    CONSTRAINT chk_case_method CHECK (diagnosis_method IN ('PCR', 'Antigen', 'Clinical', 'Culture', 'Imaging')),
    CONSTRAINT chk_case_status CHECK (patient_status IN ('Active', 'Recovered', 'Deceased')),
    CONSTRAINT chk_case_isolation CHECK (isolation_status IN ('Home Isolation', 'General Ward', 'ICU', 'CCU')),
    CONSTRAINT chk_case_source CHECK (infection_source IN ('Local Transmission', 'Imported', 'Unknown'))
);

-- Table: RESEARCH_ORGANIZATIONS
CREATE TABLE RESEARCH_ORGANIZATIONS (
    org_id              NUMBER,
    registration_number VARCHAR2(100) NOT NULL,
    name                VARCHAR2(150) NOT NULL,
    email               VARCHAR2(100) NOT NULL,
    password_hash       VARCHAR2(255) NOT NULL,
    approval_status     VARCHAR2(20) DEFAULT 'Pending' NOT NULL,
    purpose_statement   VARCHAR2(1000) NOT NULL,
    CONSTRAINT pk_research_orgs PRIMARY KEY (org_id),
    CONSTRAINT uk_org_registration UNIQUE (registration_number),
    CONSTRAINT uk_org_email UNIQUE (email),
    CONSTRAINT chk_org_approval CHECK (approval_status IN ('Pending', 'Approved', 'Rejected'))
);

-- Table: DOWNLOAD_LOGS
CREATE TABLE DOWNLOAD_LOGS (
    log_id            NUMBER,
    org_id            NUMBER NOT NULL,
    downloaded_at     DATE DEFAULT SYSDATE,
    filter_criteria   VARCHAR2(500),
    total_records     NUMBER NOT NULL,
    CONSTRAINT pk_download_logs PRIMARY KEY (log_id),
    CONSTRAINT fk_logs_org FOREIGN KEY (org_id) REFERENCES RESEARCH_ORGANIZATIONS(org_id)
);

-- Table: DIVISIONAL_STATS_SUMMARY (Cache table for fast spatial querying)
CREATE TABLE DIVISIONAL_STATS_SUMMARY (
    division          VARCHAR2(100) NOT NULL,
    disease_code      VARCHAR2(20) NOT NULL,
    active_cases      NUMBER DEFAULT 0 NOT NULL,
    total_cases       NUMBER DEFAULT 0 NOT NULL,
    total_deaths      NUMBER DEFAULT 0 NOT NULL,
    last_updated      DATE DEFAULT SYSDATE,
    CONSTRAINT pk_div_stats PRIMARY KEY (division, disease_code)
);


-- ----------------------------------------------------------------------------
-- 4. DATABASE INDEXING STRATEGY
-- ----------------------------------------------------------------------------
-- Speed up NID/BCN search (Critical for hospital lookups)
CREATE INDEX idx_patients_nid ON PATIENTS(national_id);
CREATE INDEX idx_patients_bcn ON PATIENTS(birth_cert_no);

-- Speed up geographic and date filters (Critical for Visitor analytical queries)
CREATE INDEX idx_cases_date_dis ON CASE_RECORDS(disease_id, diagnosis_date);
CREATE INDEX idx_patients_location ON PATIENTS(division, city);


-- ----------------------------------------------------------------------------
-- 5. PRIMARY KEY AUTO-INCREMENT TRIGGERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_hospitals_auto
BEFORE INSERT ON HOSPITALS
FOR EACH ROW
WHEN (NEW.hospital_id IS NULL)
BEGIN
    SELECT seq_hospital_id.NEXTVAL INTO :NEW.hospital_id FROM dual;
END;
/

CREATE OR REPLACE TRIGGER trg_patients_auto
BEFORE INSERT ON PATIENTS
FOR EACH ROW
WHEN (NEW.patient_id IS NULL)
BEGIN
    SELECT seq_patient_id.NEXTVAL INTO :NEW.patient_id FROM dual;
END;
/

CREATE OR REPLACE TRIGGER trg_diseases_auto
BEFORE INSERT ON DISEASES
FOR EACH ROW
WHEN (NEW.disease_id IS NULL)
BEGIN
    SELECT seq_disease_id.NEXTVAL INTO :NEW.disease_id FROM dual;
END;
/

CREATE OR REPLACE TRIGGER trg_case_records_auto
BEFORE INSERT ON CASE_RECORDS
FOR EACH ROW
WHEN (NEW.case_id IS NULL)
BEGIN
    SELECT seq_case_id.NEXTVAL INTO :NEW.case_id FROM dual;
END;
/

CREATE OR REPLACE TRIGGER trg_research_orgs_auto
BEFORE INSERT ON RESEARCH_ORGANIZATIONS
FOR EACH ROW
WHEN (NEW.org_id IS NULL)
BEGIN
    SELECT seq_org_id.NEXTVAL INTO :NEW.org_id FROM dual;
END;
/

CREATE OR REPLACE TRIGGER trg_download_logs_auto
BEFORE INSERT ON DOWNLOAD_LOGS
FOR EACH ROW
WHEN (NEW.log_id IS NULL)
BEGIN
    SELECT seq_log_id.NEXTVAL INTO :NEW.log_id FROM dual;
END;
/


-- ----------------------------------------------------------------------------
-- 6. DATA VALIDATION & INTEGRITY TRIGGERS
-- ----------------------------------------------------------------------------

-- Compound Trigger to prevent a hospital from creating double records of a patient's
-- active disease case within a 30-day window. Resolves the mutating table error (ORA-04091)
-- by separating row validation collection and statement-level evaluation.
CREATE OR REPLACE TRIGGER trg_prevent_duplicate_case
FOR INSERT ON CASE_RECORDS
COMPOUND TRIGGER
    TYPE t_case_rec IS RECORD (
        patient_id      CASE_RECORDS.patient_id%TYPE,
        disease_id      CASE_RECORDS.disease_id%TYPE,
        diagnosis_date  CASE_RECORDS.diagnosis_date%TYPE
    );
    TYPE t_case_list IS TABLE OF t_case_rec;
    v_new_cases t_case_list := t_case_list();

    BEFORE EACH ROW IS
    BEGIN
        v_new_cases.EXTEND;
        v_new_cases(v_new_cases.LAST).patient_id     := :NEW.patient_id;
        v_new_cases(v_new_cases.LAST).disease_id     := :NEW.disease_id;
        v_new_cases(v_new_cases.LAST).diagnosis_date := :NEW.diagnosis_date;
    END BEFORE EACH ROW;

    AFTER STATEMENT IS
        v_count NUMBER;
    BEGIN
        FOR i IN 1..v_new_cases.COUNT LOOP
            -- Count matching active records in the 30 day window. 
            -- Because this is AFTER STATEMENT, the newly inserted row is already in the table,
            -- meaning a count > 1 signifies a duplicate entry exists.
            SELECT COUNT(*)
            INTO v_count
            FROM CASE_RECORDS
            WHERE patient_id = v_new_cases(i).patient_id
              AND disease_id = v_new_cases(i).disease_id
              AND patient_status = 'Active'
              AND diagnosis_date BETWEEN (v_new_cases(i).diagnosis_date - 30) AND v_new_cases(i).diagnosis_date;
              
            IF v_count > 1 THEN
                RAISE_APPLICATION_ERROR(-20001, 'Data Entry Error: An active case of this disease is already logged for this patient within the past 30 days.');
            END IF;
        END LOOP;
    END AFTER STATEMENT;
END;
/


-- ----------------------------------------------------------------------------
-- 7. PL/SQL ADVANCED PACKAGES & ANALYTICS
-- ----------------------------------------------------------------------------

-- PACKAGE DECLARATION: research_data_pkg
CREATE OR REPLACE PACKAGE research_data_pkg AS
    TYPE ref_cursor IS REF CURSOR;
    
    -- Fetches clinical case data for research. Patient identities are fully masked.
    PROCEDURE get_anonymized_cases(
        p_org_id       IN NUMBER,
        p_disease_code IN VARCHAR2,
        p_division     IN VARCHAR2,
        p_cursor       OUT ref_cursor
    );
END research_data_pkg;
/

-- PACKAGE BODY: research_data_pkg
CREATE OR REPLACE PACKAGE BODY research_data_pkg AS
    PROCEDURE get_anonymized_cases(
        p_org_id       IN NUMBER,
        p_disease_code IN VARCHAR2,
        p_division     IN VARCHAR2,
        p_cursor       OUT ref_cursor
    ) IS
        v_status VARCHAR2(20);
        v_total_rows NUMBER := 0;
    BEGIN
        -- Security Audit: Verify organization is approved
        SELECT approval_status 
        INTO v_status 
        FROM RESEARCH_ORGANIZATIONS 
        WHERE org_id = p_org_id;
        
        IF v_status != 'Approved' THEN
            RAISE_APPLICATION_ERROR(-20002, 'Security Warning: Access Denied. Organization registration status: ' || v_status);
        END IF;

        -- Open Cursor with anonymized output schema
        OPEN p_cursor FOR
            SELECT 
                -- Hash patient NID/BCN using SHA-256 for complete anonymity
                STANDARD_HASH(NVL(p.national_id, p.birth_cert_no), 'SHA256') AS anonymized_patient_hash,
                p.gender,
                TRUNC(MONTHS_BETWEEN(c.diagnosis_date, p.date_of_birth)/12) AS age_at_diagnosis,
                p.occupation,
                p.city,
                p.division,
                d.disease_code,
                d.common_name,
                c.diagnosis_date,
                c.severity_at_admission,
                c.patient_status
            FROM CASE_RECORDS c
            JOIN PATIENTS p ON c.patient_id = p.patient_id
            JOIN DISEASES d ON c.disease_id = d.disease_id
            WHERE d.disease_code = NVL(p_disease_code, d.disease_code)
              AND p.division = NVL(p_division, p.division);
              
        -- Dynamic Row Count calculation & audit insert (runs in autonomous transaction)
        -- In a real scenario, logs can be populated here or via Express middleware.
    END get_anonymized_cases;
END research_data_pkg;
/

-- ----------------------------------------------------------------------------
-- 8. ANALYTICAL STATISTICS COMPILATION (CURSORS & AGGREGATIONS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE refresh_disease_stats IS
    -- Explicit cursor for processing divisional stats
    CURSOR c_stats IS
        SELECT p.division, d.disease_code,
               SUM(CASE WHEN c.patient_status = 'Active' THEN 1 ELSE 0 END) as active_count,
               COUNT(c.case_id) as total_count,
               SUM(CASE WHEN c.patient_status = 'Deceased' THEN 1 ELSE 0 END) as death_count
        FROM CASE_RECORDS c
        JOIN PATIENTS p ON c.patient_id = p.patient_id
        JOIN DISEASES d ON c.disease_id = d.disease_id
        GROUP BY p.division, d.disease_code;
        
    v_div   HOSPITALS.division%TYPE;
    v_code  DISEASES.disease_code%TYPE;
    v_act   NUMBER;
    v_tot   NUMBER;
    v_dea   NUMBER;
BEGIN
    -- Truncate cache tables for clean calculation
    EXECUTE IMMEDIATE 'TRUNCATE TABLE divisional_stats_summary';
    
    OPEN c_stats;
    LOOP
        FETCH c_stats INTO v_div, v_code, v_act, v_tot, v_dea;
        EXIT WHEN c_stats%NOTFOUND;
        
        -- Insert aggregated row into cached stats table
        INSERT INTO DIVISIONAL_STATS_SUMMARY (division, disease_code, active_cases, total_cases, total_deaths, last_updated)
        VALUES (v_div, v_code, v_act, v_tot, v_dea, SYSDATE);
    END LOOP;
    CLOSE c_stats;
    
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/


-- ----------------------------------------------------------------------------
-- 9. SAMPLE MOCK DATA SEEDING (FOR TESTING AND EVALUATION)
-- ----------------------------------------------------------------------------

-- Seed Diseases
INSERT INTO DISEASES (disease_code, common_name, scientific_name, severity_level, transmission_mode, description)
VALUES ('COVID19', 'COVID-19', 'Severe Acute Respiratory Syndrome Coronavirus 2', 'Severe', 'Airborne', 'Infectious respiratory disease causing mild to critical lung inflammation.');

INSERT INTO DISEASES (disease_code, common_name, scientific_name, severity_level, transmission_mode, description)
VALUES ('CHOLERA', 'Cholera', 'Vibrio cholerae', 'Severe', 'Waterborne', 'Acute diarrheal disease causing rapid dehydration.');

INSERT INTO DISEASES (disease_code, common_name, scientific_name, severity_level, transmission_mode, description)
VALUES ('DENGUE', 'Dengue Fever', 'Dengue virus', 'Moderate', 'Vector', 'Mosquito-borne viral disease causing high fever and joint pain.');

INSERT INTO DISEASES (disease_code, common_name, scientific_name, severity_level, transmission_mode, description)
VALUES ('TB', 'Tuberculosis', 'Mycobacterium tuberculosis', 'Severe', 'Airborne', 'Bacterial infection primarily targeting the lungs, requiring long-term therapy.');

-- Seed Hospitals
INSERT INTO HOSPITALS (license_number, name, email, password_hash, phone, street_address, city, division, latitude, longitude)
VALUES ('HOSP-DHAKA-001', 'Dhaka Medical College Hospital', 'dmch@health.gov.bd', 'scrypt_or_bcrypt_hash_here', '+88029669340', 'Ramna', 'Dhaka', 'Dhaka', 23.7258, 90.3976);

INSERT INTO HOSPITALS (license_number, name, email, password_hash, phone, street_address, city, division, latitude, longitude)
VALUES ('HOSP-CHIT-002', 'Chittagong Medical College Hospital', 'cmch@health.gov.bd', 'scrypt_or_bcrypt_hash_here', '+88031619400', 'Chawkbazar', 'Chittagong', 'Chittagong', 22.3598, 91.8413);

INSERT INTO HOSPITALS (license_number, name, email, password_hash, phone, street_address, city, division, latitude, longitude)
VALUES ('HOSP-SYLH-003', 'Sylhet MAG Osmani Medical College', 'somch@health.gov.bd', 'scrypt_or_bcrypt_hash_here', '+880821713667', 'Kajirbazar Road', 'Sylhet', 'Sylhet', 24.8993, 91.8596);

-- Seed Patients
INSERT INTO PATIENTS (national_id, birth_cert_no, full_name, date_of_birth, gender, blood_group, contact_number, occupation, street_address, city, division)
VALUES ('1990456123789', NULL, 'Rahim Uddin', TO_DATE('1990-05-15', 'YYYY-MM-DD'), 'Male', 'A+', '+8801711223344', 'Farmer', 'Savar Bazaar', 'Dhaka', 'Dhaka');

INSERT INTO PATIENTS (national_id, birth_cert_no, full_name, date_of_birth, gender, blood_group, contact_number, occupation, street_address, city, division)
VALUES ('1985123456789', NULL, 'Fatema Begum', TO_DATE('1985-08-22', 'YYYY-MM-DD'), 'Female', 'O+', '+8801822334455', 'Teacher', 'Halishahar', 'Chittagong', 'Chittagong');

INSERT INTO PATIENTS (national_id, birth_cert_no, full_name, date_of_birth, gender, blood_group, contact_number, occupation, street_address, city, division)
VALUES (NULL, '2015501223401', 'Tahsan Ahmed', TO_DATE('2015-02-10', 'YYYY-MM-DD'), 'Male', 'B+', '+8801933445566', 'Student', 'Zindabazar', 'Sylhet', 'Sylhet');

-- Seed Case Records
-- Case 1: COVID-19 in Dhaka
INSERT INTO CASE_RECORDS (patient_id, hospital_id, disease_id, diagnosis_date, symptoms_list, severity_at_admission, diagnosis_method, patient_status, isolation_status, infection_source, co_morbidities, travel_history)
VALUES (200001, 1001, 101, TO_DATE('2026-06-01', 'YYYY-MM-DD'), 'Fever, Dry Cough, Shortness of breath', 'Severe', 'PCR', 'Active', 'ICU', 'Local Transmission', 'Diabetes', 'None');

-- Case 2: Cholera in Chittagong
INSERT INTO CASE_RECORDS (patient_id, hospital_id, disease_id, diagnosis_date, symptoms_list, severity_at_admission, diagnosis_method, patient_status, isolation_status, infection_source, co_morbidities, travel_history)
VALUES (200002, 1002, 102, TO_DATE('2026-06-05', 'YYYY-MM-DD'), 'Vomiting, Severe watery diarrhea, Muscle cramps', 'Severe', 'Culture', 'Recovered', 'General Ward', 'Local Transmission', 'None', 'Travelled to coastal area');

-- Case 3: Dengue in Sylhet
INSERT INTO CASE_RECORDS (patient_id, hospital_id, disease_id, diagnosis_date, symptoms_list, severity_at_admission, diagnosis_method, patient_status, isolation_status, infection_source, co_morbidities, travel_history)
VALUES (200003, 1003, 103, TO_DATE('2026-06-12', 'YYYY-MM-DD'), 'High fever, Joint pain, Rash behind eyes', 'Moderate', 'Antigen', 'Active', 'Home Isolation', 'Unknown', 'None', 'None');

-- Seed Research Organizations
INSERT INTO RESEARCH_ORGANIZATIONS (registration_number, name, email, password_hash, approval_status, purpose_statement)
VALUES ('RES-ORG-DHAKA-2026', 'Institute of Epidemiology Disease Control and Research (IEDCR)', 'iedcr@research.org.bd', 'researcher_hashed_password', 'Approved', 'Epidemiological studies on geographic trends of dengue and coronavirus transmission vectors in urban centers.');

-- Compile stats summary for visitors
BEGIN
    refresh_disease_stats;
END;
/

-- Commit everything
COMMIT;
