const { executeQuery, initializeDb } = require('../db');

const dropQueries = [
  'DROP TABLE DOWNLOAD_LOGS CASCADE CONSTRAINTS',
  'DROP TABLE RESEARCH_ORGANIZATIONS CASCADE CONSTRAINTS',
  'DROP TABLE CASE_RECORDS CASCADE CONSTRAINTS',
  'DROP TABLE DISEASES CASCADE CONSTRAINTS',
  'DROP TABLE PATIENTS CASCADE CONSTRAINTS',
  'DROP TABLE HOSPITALS CASCADE CONSTRAINTS',
  'DROP TABLE DIVISIONAL_STATS_SUMMARY CASCADE CONSTRAINTS'
];

const createQueries = [
  // Table: HOSPITALS
  `CREATE TABLE HOSPITALS (
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
  )`,

  // Table: PATIENTS
  `CREATE TABLE PATIENTS (
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
  )`,

  // Table: DISEASES
  `CREATE TABLE DISEASES (
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
  )`,

  // Table: CASE_RECORDS
  `CREATE TABLE CASE_RECORDS (
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
      CONSTRAINT chk_case_severity CHECK (severity_at_admission IN ('Mild', 'Moderate', 'Severe', 'Critical')),
      CONSTRAINT chk_case_method CHECK (diagnosis_method IN ('PCR', 'Antigen', 'Clinical', 'Culture', 'Imaging')),
      CONSTRAINT chk_case_status CHECK (patient_status IN ('Active', 'Recovered', 'Deceased')),
      CONSTRAINT chk_case_isolation CHECK (isolation_status IN ('Home Isolation', 'General Ward', 'ICU', 'CCU')),
      CONSTRAINT chk_case_source CHECK (infection_source IN ('Local Transmission', 'Imported', 'Unknown'))
  )`,

  // Table: RESEARCH_ORGANIZATIONS
  `CREATE TABLE RESEARCH_ORGANIZATIONS (
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
  )`,

  // Table: DOWNLOAD_LOGS
  `CREATE TABLE DOWNLOAD_LOGS (
      log_id            NUMBER,
      org_id            NUMBER NOT NULL,
      downloaded_at     DATE DEFAULT SYSDATE,
      filter_criteria   VARCHAR2(500),
      total_records     NUMBER NOT NULL,
      CONSTRAINT pk_download_logs PRIMARY KEY (log_id),
      CONSTRAINT fk_logs_org FOREIGN KEY (org_id) REFERENCES RESEARCH_ORGANIZATIONS(org_id)
  )`,

  // Table: DIVISIONAL_STATS_SUMMARY
  `CREATE TABLE DIVISIONAL_STATS_SUMMARY (
      division          VARCHAR2(100) NOT NULL,
      disease_code      VARCHAR2(20) NOT NULL,
      active_cases      NUMBER DEFAULT 0 NOT NULL,
      total_cases       NUMBER DEFAULT 0 NOT NULL,
      total_deaths      NUMBER DEFAULT 0 NOT NULL,
      last_updated      DATE DEFAULT SYSDATE,
      CONSTRAINT pk_div_stats PRIMARY KEY (division, disease_code)
  )`
];

async function runSetup() {
  try {
    console.log('Initializing connection to Oracle Database...');
    await initializeDb();
    
    // Execute Drops (ignore failures if tables don't exist yet)
    console.log('\nExecuting Drop Table queries...');
    for (const q of dropQueries) {
      try {
        await executeQuery(q);
        console.log(`Successfully executed: ${q.split(' ')[2]}`);
      } catch (err) {
        // Table doesn't exist, ignore
        if (err.message.includes('ORA-00942')) {
          console.log(`Table ${q.split(' ')[2]} does not exist. Skipping drop.`);
        } else {
          console.warn(`Warning on drop: ${err.message}`);
        }
      }
    }

    // Execute Create Tables
    console.log('\nExecuting Create Table queries...');
    for (const q of createQueries) {
      // Extract table name from DDL string
      const tableName = q.match(/CREATE TABLE (\w+)/)[1];
      try {
        await executeQuery(q);
        console.log(`Successfully created table: ${tableName}`);
      } catch (err) {
        console.error(`Failed to create table ${tableName}:`, err.message);
        throw err;
      }
    }

    console.log('\nDatabase Schema created successfully in local Oracle DB.');
    process.exit(0);
  } catch (err) {
    console.error('\nDatabase setup failed:', err.message);
    process.exit(1);
  }
}

runSetup();
