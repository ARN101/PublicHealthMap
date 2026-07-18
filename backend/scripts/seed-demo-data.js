/**
 * Realistic Bangladesh demo seed:
 * - 64 district hospitals (city = district HQ, division = parent division)
 * - Diverse research orgs (university / medical / doctor / pharma)
 * - ~100 patients + epidemiologically skewed cases
 */
const { initializeDb } = require('../db');
const { hashPassword } = require('../auth');
const oracledb = require('oracledb');
const districts = require('./bd-districts');

const DIV_CODE = {
  Dhaka: 'DHK',
  Chittagong: 'CTG',
  Rajshahi: 'RAJ',
  Khulna: 'KHN',
  Barisal: 'BAR',
  Sylhet: 'SYL',
  Rangpur: 'RGP',
  Mymensingh: 'MYM'
};

const FIRST = ['Abul', 'Fatema', 'Tariqul', 'Nusrat', 'Kamrul', 'Moushumi', 'Zahid', 'Farzana', 'Saiful', 'Dilruba', 'Imran', 'Rashed', 'Nasrin', 'Jahid', 'Shirin', 'Hasan', 'Ruma', 'Karim', 'Ayesha', 'Mahbub'];
const LAST = ['Kalam', 'Begum', 'Islam', 'Jahan', 'Hasan', 'Akter', 'Rahman', 'Chowdhury', 'Ahmed', 'Yasmin', 'Hossain', 'Sultana', 'Khan', 'Mia', 'Parvin'];
const BLOODS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female'];
const JOBS = ['Teacher', 'Farmer', 'Student', 'Nurse', 'Driver', 'Shopkeeper', 'Garment Worker', 'Housewife', 'Engineer', 'Doctor', 'Rickshaw Puller', 'Banker'];

function buildHospitals() {
  const byDiv = {};
  const out = [];
  for (const d of districts) {
    byDiv[d.division] = (byDiv[d.division] || 0) + 1;
    const n = byDiv[d.division];
    const code = DIV_CODE[d.division] || 'XX';
    const license = d.flagship || `HOSP-${code}-${String(n).padStart(2, '0')}`;
    const name = d.flagshipName || `${d.district} District Sadar Hospital`;
    const email = `${license.toLowerCase()}@health.gov.bd`;
    out.push({
      license,
      name,
      email,
      division: d.division,
      city: d.district,
      lat: d.lat,
      lng: d.lng,
      phone: `0171${String(1000000 + out.length).slice(-7)}`
    });
  }
  return out;
}

const researchOrgs = [
  {
    reg: 'RES-ORG-DHAKA-2026',
    name: 'Institute of Epidemiology Disease Control and Research (IEDCR)',
    email: 'iedcr@research.org.bd',
    purpose: 'National surveillance research on dengue, TB, and emerging infections across Bangladesh divisions.'
  },
  {
    reg: 'RES-DU-EPI-2026',
    name: 'University of Dhaka — Institute of Statistical Research',
    email: 'epi.research@du.ac.bd',
    purpose: 'Spatial statistics of critical disease burden for public-health policy analysis.'
  },
  {
    reg: 'RES-BUET-PH-2026',
    name: 'BUET Public Health Informatics Lab',
    email: 'phlab@buet.ac.bd',
    purpose: 'Data-driven modelling of hospital case loads and outbreak early-warning signals.'
  },
  {
    reg: 'RES-CU-MED-2026',
    name: 'University of Chittagong — Faculty of Medicine Research Cell',
    email: 'medresearch@cu.ac.bd',
    purpose: 'Coastal and hill-tract epidemiology of TB and vector-borne disease.'
  },
  {
    reg: 'RES-RU-SCI-2026',
    name: 'University of Rajshahi — Health Sciences Research Unit',
    email: 'healthsci@ru.ac.bd',
    purpose: 'Northern Bangladesh chronic disease and infectious disease cohort studies.'
  },
  {
    reg: 'RES-BSMMU-2026',
    name: 'Bangabandhu Sheikh Mujib Medical University (BSMMU) Research Wing',
    email: 'research@bsmmu.edu.bd',
    purpose: 'Hospital-based registries for oncology, neurology, and cardiology critical cases.'
  },
  {
    reg: 'RES-ICDDRB-2026',
    name: 'icddr,b Collaborating Research Desk (Demo)',
    email: 'dataaccess@icddrb.org',
    purpose: 'Anonymized diarrheal and enteric disease pattern analysis for coastal divisions.'
  },
  {
    reg: 'RES-BMDC-2026',
    name: 'Bangladesh Medical Association Research Committee',
    email: 'research@bma.org.bd',
    purpose: 'Physician-led audit of case severity and outcomes by division.'
  },
  {
    reg: 'RES-DOC-NET-2026',
    name: 'National Doctors Network for Critical Care Studies',
    email: 'criticalcare@doctorsnet.bd',
    purpose: 'ICU and CCU critical case outcome research using masked hospital extracts.'
  },
  {
    reg: 'RES-SQUARE-2026',
    name: 'Square Pharmaceuticals — Medical Affairs Research Liaison',
    email: 'medaffairs@squarepharma.com.bd',
    purpose: 'Pharmacoepidemiology of treated infectious and chronic cases (anonymized).'
  },
  {
    reg: 'RES-BEXIMCO-2026',
    name: 'Beximco Pharma — Clinical Insights Unit',
    email: 'clinicalinsights@beximco.com',
    purpose: 'Real-world evidence studies on disease volume trends by specialty.'
  },
  {
    reg: 'RES-INCEPTA-2026',
    name: 'Incepta Pharmaceuticals — Epidemiology Partnership Desk',
    email: 'epipartner@inceptapharma.com',
    purpose: 'Collaborative research on vaccine-preventable and treatable disease patterns.'
  }
];

/** Disease weights by division (BD-context skew). */
const DISEASE_WEIGHTS = {
  Dhaka: { DENGUE: 35, COVID19: 12, TB: 10, CHOLERA: 3, THALASSEMIA: 6, BRAIN_CANCER: 4, LUNG_CANCER: 4, STROKE: 8, CAD: 10, CIRRHOSIS: 5, AKI: 3 },
  Chittagong: { DENGUE: 30, COVID19: 10, TB: 12, CHOLERA: 5, STROKE: 6, CAD: 8, LUNG_CANCER: 5, THALASSEMIA: 4, CIRRHOSIS: 4 },
  Sylhet: { TB: 25, DENGUE: 15, COVID19: 8, LUNG_CANCER: 8, STROKE: 8, CAD: 8, THALASSEMIA: 5 },
  Khulna: { CHOLERA: 22, DENGUE: 18, TB: 12, COVID19: 8, CIRRHOSIS: 8, CAD: 8, STROKE: 6 },
  Barisal: { CHOLERA: 20, DENGUE: 20, TB: 10, COVID19: 8, STROKE: 6, CAD: 6 },
  Rangpur: { TB: 22, DENGUE: 12, STROKE: 12, CAD: 10, COVID19: 8, CIRRHOSIS: 6 },
  Mymensingh: { TB: 20, DENGUE: 15, COVID19: 10, STROKE: 8, CAD: 8, THALASSEMIA: 5 },
  Rajshahi: { DENGUE: 18, TB: 16, COVID19: 10, STROKE: 10, CAD: 10, CIRRHOSIS: 6 }
};

const SYMPTOMS = {
  DENGUE: 'High fever, headache, myalgia',
  COVID19: 'Fever, cough, fatigue',
  TB: 'Chronic cough, night sweats, weight loss',
  CHOLERA: 'Watery diarrhea, dehydration',
  THALASSEMIA: 'Pallor, fatigue',
  BRAIN_CANCER: 'Headache, seizures',
  LUNG_CANCER: 'Chronic cough, hemoptysis',
  STROKE: 'Sudden weakness, speech difficulty',
  CAD: 'Chest pain, dyspnea',
  CIRRHOSIS: 'Ascites, jaundice',
  AKI: 'Oliguria, edema'
};

function pickWeighted(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [code, w] of entries) {
    r -= w;
    if (r <= 0) return code;
  }
  return entries[0][0];
}

function padNid(n) {
  return String(11000000000 + n).slice(0, 11);
}

function buildPatientsAndCases(hospitals) {
  const patients = [];
  const cases = [];
  // Keep classic demo NIDs 10000000001+ for e2e / docs
  const classic = [
    { nid: '10000000001', name: 'Abul Kalam', dob: '1985-05-12', gender: 'Male', blood: 'A+', phone: '01711223344', occupation: 'Teacher', address: 'Dhanmondi Rd 5', city: 'Dhaka', division: 'Dhaka' },
    { nid: '10000000002', name: 'Fatema Begum', dob: '1992-09-18', gender: 'Female', blood: 'O+', phone: '01822334455', occupation: 'Housewife', address: 'Mirpur Sec 10', city: 'Dhaka', division: 'Dhaka' },
    { nid: '10000000003', name: 'Tariqul Islam', dob: '2005-02-14', gender: 'Male', blood: 'B+', phone: '01933445566', occupation: 'Student', address: 'Halishahar Rd 2', city: 'Chattogram', division: 'Chittagong' }
  ];
  classic.forEach((p) => patients.push(p));

  let nidSeq = 1;
  const byDivision = {};
  hospitals.forEach((h) => {
    if (!byDivision[h.division]) byDivision[h.division] = [];
    byDivision[h.division].push(h);
  });

  // ~100 additional patients distributed across districts
  for (let i = 0; i < 100; i++) {
    const h = hospitals[i % hospitals.length];
    const gender = GENDERS[i % 2];
    const name = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`;
    const year = 1960 + (i % 45);
    const month = String((i % 12) + 1).padStart(2, '0');
    const day = String((i % 28) + 1).padStart(2, '0');
    const nid = padNid(nidSeq++);
    patients.push({
      nid,
      name,
      dob: `${year}-${month}-${day}`,
      gender,
      blood: BLOODS[i % BLOODS.length],
      phone: `018${String(10000000 + i).slice(-8)}`,
      occupation: JOBS[i % JOBS.length],
      address: `${h.city} Ward ${(i % 12) + 1}`,
      city: h.city,
      division: h.division,
      _hosp: h.license
    });
  }

  // Classic demo cases (preserve e2e expectations)
  const flagshipDhaka = hospitals.find((h) => h.license === 'HOSP-1001-DHK');
  const flagshipCtg = hospitals.find((h) => h.license === 'HOSP-1002-CTG');
  cases.push(
    { patientNid: '10000000001', hospLicense: flagshipDhaka.license, diseaseCode: 'COVID19', diagDate: '2026-07-10', symptoms: SYMPTOMS.COVID19, severity: 'Mild', method: 'PCR', status: 'Active', isolation: 'Home Isolation', source: 'Local Transmission' },
    { patientNid: '10000000002', hospLicense: flagshipDhaka.license, diseaseCode: 'DENGUE', diagDate: '2026-07-14', symptoms: SYMPTOMS.DENGUE, severity: 'Moderate', method: 'Antigen', status: 'Active', isolation: 'General Ward', source: 'Local Transmission' },
    { patientNid: '10000000003', hospLicense: flagshipCtg.license, diseaseCode: 'DENGUE', diagDate: '2026-07-12', symptoms: SYMPTOMS.DENGUE, severity: 'Severe', method: 'Antigen', status: 'Active', isolation: 'General Ward', source: 'Local Transmission' },
    { patientNid: '10000000001', hospLicense: flagshipDhaka.license, diseaseCode: 'THALASSEMIA', diagDate: '2026-07-02', symptoms: SYMPTOMS.THALASSEMIA, severity: 'Severe', method: 'Clinical', status: 'Active', isolation: 'General Ward', source: 'Unknown' }
  );

  // One case per generated patient (skewed)
  const statuses = ['Active', 'Active', 'Active', 'Recovered', 'Recovered'];
  const severities = ['Mild', 'Mild', 'Moderate', 'Severe', 'Critical'];
  patients.slice(classic.length).forEach((p, idx) => {
    const weights = DISEASE_WEIGHTS[p.division] || DISEASE_WEIGHTS.Dhaka;
    const diseaseCode = pickWeighted(weights);
    const day = 1 + (idx % 28);
    const month = idx % 3 === 0 ? 6 : 7;
    cases.push({
      patientNid: p.nid,
      hospLicense: p._hosp,
      diseaseCode,
      diagDate: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      symptoms: SYMPTOMS[diseaseCode] || 'Clinical presentation',
      severity: severities[idx % severities.length],
      method: diseaseCode === 'DENGUE' || diseaseCode === 'COVID19' ? 'Antigen' : 'Clinical',
      status: statuses[idx % statuses.length],
      isolation: severities[idx % severities.length] === 'Critical' ? 'ICU' : 'General Ward',
      source: ['CHOLERA', 'DENGUE', 'TB', 'COVID19'].includes(diseaseCode) ? 'Local Transmission' : 'Unknown'
    });
  });

  // Extra dengue surge in Dhaka / Chittagong urban hospitals
  const surgeHospitals = hospitals.filter((h) =>
    ['Dhaka', 'Gazipur', 'Narayanganj', 'Chattogram', 'Cumilla'].includes(h.city)
  );
  for (let i = 0; i < 40; i++) {
    const p = patients[classic.length + (i % 80)];
    const h = surgeHospitals[i % surgeHospitals.length];
    // skip if would duplicate same disease for same patient in seed (compound trigger cares about recent active)
    cases.push({
      patientNid: p.nid,
      hospLicense: h.license,
      diseaseCode: i % 5 === 0 ? 'COVID19' : 'DENGUE',
      diagDate: `2026-05-${String(1 + (i % 20)).padStart(2, '0')}`,
      symptoms: i % 5 === 0 ? SYMPTOMS.COVID19 : SYMPTOMS.DENGUE,
      severity: 'Mild',
      method: 'Clinical',
      status: 'Recovered',
      isolation: 'Home Isolation',
      source: 'Local Transmission'
    });
  }

  return { patients: patients.map(({ _hosp, ...rest }) => rest), cases };
}

async function seed() {
  let conn;
  try {
    console.log('Connecting to database...');
    const pool = await initializeDb();
    conn = await pool.getConnection();

    const hospitals = buildHospitals();
    if (hospitals.length !== 64) {
      throw new Error(`Expected 64 district hospitals, got ${hospitals.length}`);
    }
    const { patients, cases } = buildPatientsAndCases(hospitals);

    console.log('\n--- 1. CLEANING PREVIOUS DEMO DATA ---');
    await conn.execute('DELETE FROM CASE_RECORDS');
    await conn.execute('DELETE FROM DOWNLOAD_LOGS');
    await conn.execute(`DELETE FROM PATIENTS WHERE national_id LIKE '100000000%' OR national_id LIKE '11%'`);
    await conn.execute(`DELETE FROM HOSPITALS WHERE license_number LIKE 'HOSP-%'`);
    await conn.execute(`DELETE FROM RESEARCH_ORGANIZATIONS WHERE registration_number LIKE 'RES-%'`);
    await conn.execute('DELETE FROM DIVISIONAL_STATS_SUMMARY');
    console.log('Cleared prior demo rows.');

    console.log('\n--- 2. SEEDING 64 DISTRICT HOSPITALS ---');
    const hospitalPasswordHash = await hashPassword('hospital123');
    for (const h of hospitals) {
      await conn.execute(
        `INSERT INTO HOSPITALS (license_number, name, email, password_hash, phone, street_address, city, division, latitude, longitude, approval_status)
         VALUES (:license, :name, :email, :pwd, :phone, :address, :city, :division, :lat, :lng, 'Approved')`,
        {
          license: h.license,
          name: h.name,
          email: h.email,
          pwd: hospitalPasswordHash,
          phone: h.phone,
          address: `${h.city} Hospital Road`,
          city: h.city,
          division: h.division,
          lat: h.lat,
          lng: h.lng
        }
      );
    }
    console.log(`Inserted ${hospitals.length} hospitals (Approved).`);

    console.log('\n--- 3. SEEDING PATIENTS ---');
    for (const p of patients) {
      await conn.execute(
        `INSERT INTO PATIENTS (national_id, birth_cert_no, full_name, date_of_birth, gender, blood_group, contact_number, occupation, street_address, city, division)
         VALUES (:nid, NULL, :name, TO_DATE(:dob, 'YYYY-MM-DD'), :gender, :blood, :phone, :occupation, :address, :city, :division)`,
        {
          nid: p.nid,
          name: p.name,
          dob: p.dob,
          gender: p.gender,
          blood: p.blood,
          phone: p.phone,
          occupation: p.occupation,
          address: p.address,
          city: p.city,
          division: p.division
        }
      );
    }
    console.log(`Inserted ${patients.length} patients.`);

    console.log('\n--- 4. SEEDING CASE RECORDS ---');
    const hospMapping = {};
    (await conn.execute('SELECT hospital_id, license_number FROM HOSPITALS')).rows
      .forEach((r) => { hospMapping[r.LICENSE_NUMBER] = r.HOSPITAL_ID; });
    const patientMapping = {};
    (await conn.execute('SELECT patient_id, national_id FROM PATIENTS')).rows
      .forEach((r) => { patientMapping[r.NATIONAL_ID] = r.PATIENT_ID; });
    const diseaseMapping = {};
    (await conn.execute('SELECT disease_id, disease_code FROM DISEASES')).rows
      .forEach((r) => { diseaseMapping[r.DISEASE_CODE] = r.DISEASE_ID; });

    let caseOk = 0;
    let caseSkip = 0;
    for (const c of cases) {
      const patientId = patientMapping[c.patientNid];
      const hospitalId = hospMapping[c.hospLicense];
      const diseaseId = diseaseMapping[c.diseaseCode];
      if (!patientId || !hospitalId || !diseaseId) {
        caseSkip += 1;
        continue;
      }
      try {
      await conn.execute(
        `INSERT INTO CASE_RECORDS (patient_id, hospital_id, disease_id, diagnosis_date, symptoms_list, severity_at_admission, diagnosis_method, patient_status, isolation_status, infection_source)
           VALUES (:patientId, :hospitalId, :diseaseId, TO_DATE(:diagDate, 'YYYY-MM-DD'), :symptoms, :severity, :method, :status, :isolation, :source)`,
        {
          patientId,
          hospitalId,
          diseaseId,
          diagDate: c.diagDate,
          symptoms: c.symptoms,
          severity: c.severity,
          method: c.method,
          status: c.status,
          isolation: c.isolation,
          source: c.source
        }
      );
        caseOk += 1;
      } catch (err) {
        // Skip duplicate-prevention / missing disease codes
        caseSkip += 1;
      }
    }
    console.log(`Inserted ${caseOk} cases (${caseSkip} skipped).`);

    console.log('\n--- 5. SEEDING RESEARCH ORGANIZATIONS ---');
    const researcherPasswordHash = await hashPassword('research123');
    for (const org of researchOrgs) {
      await conn.execute(
        `INSERT INTO RESEARCH_ORGANIZATIONS (
           registration_number, name, email, password_hash, approval_status, purpose_statement
         ) VALUES (:reg, :name, :email, :pwd, 'Approved', :purpose)`,
        {
          reg: org.reg,
          name: org.name,
          email: org.email,
          pwd: researcherPasswordHash,
          purpose: org.purpose
        }
      );
    }
    console.log(`Inserted ${researchOrgs.length} approved research orgs.`);

    console.log('\n--- 6. REFRESH STATS ---');
    await conn.execute('BEGIN refresh_disease_stats; END;');
    await conn.commit();

    console.log('\nSeed completed.');
    console.log(`  Hospitals : ${hospitals.length} (password hospital123)`);
    console.log(`  Patients  : ${patients.length}`);
    console.log(`  Cases     : ${caseOk}`);
    console.log(`  Research  : ${researchOrgs.length} (password research123)`);
    console.log('Primary demos:');
    console.log('  Hospital  : hosp-1001-dhk@health.gov.bd / hospital123');
    console.log('  Researcher: iedcr@research.org.bd / research123');
    console.log('  Admin     : admin@health.gov.bd / admin123');
    process.exit(0);
  } catch (err) {
    console.error('\nSeed failed:', err.message);
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

seed();
