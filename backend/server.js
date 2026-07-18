const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const archiver = require('archiver');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

/** Images are stored as Oracle BLOBs (in-memory multer → DB). */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed.'));
    }
    cb(null, true);
  }
});

function mimeToExt(mime) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '.jpg';
}

function parsePendingUploadRef(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/^pending:(\d+)$/i);
  return m ? Number(m[1]) : null;
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const { initializeDb, executeQuery, getPool } = require('./db');
const {
  signToken,
  hashPassword,
  comparePassword,
  requireAuth
} = require('./auth');
const { FIELD_CATALOG } = require('./field-catalog');
const {
  DISEASE_CATEGORIES,
  TRANSMISSION_MODES,
  formKeysForDisease
} = require('./disease-catalog');
const {
  validateIdentityValue,
  validateNewPatient
} = require('./patient-validation');
const oracledb = require('oracledb');

// Step 1: Basic Hello World Endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the PublicHealthMap Backend!' });
});

// Step 2: Active local DB connection check
app.get('/api/db-check', async (req, res) => {
  try {
    const result = await executeQuery('SELECT 1 AS CHECK_VAL FROM DUAL');
    const checkVal = result.rows[0].CHECK_VAL;
    res.json({
      success: true,
      message: `Local Oracle DB is connected successfully! Query 'SELECT 1 FROM DUAL' returned: ${checkVal}`
    });
  } catch (err) {
    console.error('DB Check API Error:', err.message);
    res.status(500).json({
      success: false,
      error: `Could not connect to Oracle database: ${err.message}`
    });
  }
});

function extractOracleAppError(err) {
  if (!err || !err.message) return err ? String(err) : 'Unknown error';
  if (err.message.includes('ORA-20')) {
    const matches = err.message.match(/ORA-20\d{3}:\s*(.*)/);
    if (matches && matches[1]) {
      return matches[1].split('\n')[0];
    }
  }
  return err.message;
}

// Admin authentication (MoHFW desk — credentials from environment)
app.post('/api/auth/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@health.gov.bd').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  if (email.trim().toLowerCase() !== adminEmail || password !== adminPassword) {
    return res.status(401).json({ success: false, error: 'Invalid administrator credentials.' });
  }

  const token = signToken({
    role: 'admin',
    email: adminEmail,
    name: 'MoHFW System Administrator'
  });

  res.json({
    success: true,
    token,
    admin: { email: adminEmail, name: 'MoHFW System Administrator' }
  });
});

// Hospital registration (Pending until admin approval)
app.post('/api/auth/hospital/register', async (req, res) => {
  const {
    licenseNumber,
    name,
    email,
    password,
    phone,
    streetAddress,
    city,
    division,
    latitude,
    longitude
  } = req.body || {};

  if (!licenseNumber || !name || !email || !password || !phone || !city || !division) {
    return res.status(400).json({
      success: false,
      error: 'licenseNumber, name, email, password, phone, city, and division are required.'
    });
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({
      success: false,
      error: 'Valid latitude and longitude are required for hospital mapping.'
    });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await executeQuery(
      `INSERT INTO HOSPITALS (
         license_number, name, email, password_hash, phone, street_address,
         city, division, latitude, longitude, approval_status
       ) VALUES (
         :license, :name, :email, :pwd, :phone, :address,
         :city, :division, :lat, :lng, 'Pending'
       ) RETURNING hospital_id INTO :hospital_id`,
      {
        license: licenseNumber.trim(),
        name: name.trim(),
        email: email.trim(),
        pwd: passwordHash,
        phone: phone.trim(),
        address: streetAddress || null,
        city: city.trim(),
        division: division.trim(),
        lat,
        lng,
        hospital_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );

    res.status(201).json({
      success: true,
      hospitalId: result.outBinds.hospital_id[0],
      approvalStatus: 'Pending',
      message: 'Hospital registration submitted. An administrator must approve before you can sign in.'
    });
  } catch (err) {
    console.error('Hospital register error:', err.message);
    if (err.message.includes('ORA-00001')) {
      return res.status(400).json({
        success: false,
        error: 'License number or email already registered.'
      });
    }
    res.status(500).json({ success: false, error: `Hospital registration failed: ${err.message}` });
  }
});

// Hospital authentication (Approved facilities only)
app.post('/api/auth/hospital/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  try {
    const result = await executeQuery(
      `SELECT hospital_id, name, email, password_hash, license_number, city, division, approval_status
       FROM HOSPITALS
       WHERE LOWER(email) = LOWER(:email)`,
      { email: email.trim() }
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, error: 'Invalid hospital email or password.' });
    }

    const hospital = result.rows[0];
    const valid = await comparePassword(password, hospital.PASSWORD_HASH);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid hospital email or password.' });
    }

    if (hospital.APPROVAL_STATUS && hospital.APPROVAL_STATUS !== 'Approved') {
      return res.status(403).json({
        success: false,
        error: `Access denied. Hospital registration status is ${hospital.APPROVAL_STATUS}.`
      });
    }

    const token = signToken({
      role: 'hospital',
      hospitalId: Number(hospital.HOSPITAL_ID),
      email: hospital.EMAIL,
      name: hospital.NAME
    });

    res.json({
      success: true,
      token,
      hospital: {
        hospitalId: Number(hospital.HOSPITAL_ID),
        name: hospital.NAME,
        email: hospital.EMAIL,
        licenseNumber: hospital.LICENSE_NUMBER,
        city: hospital.CITY,
        division: hospital.DIVISION,
        approvalStatus: hospital.APPROVAL_STATUS || 'Approved'
      }
    });
  } catch (err) {
    console.error('Hospital login error:', err.message);
    res.status(500).json({ success: false, error: `Hospital login failed: ${err.message}` });
  }
});

// Researcher registration (Pending until approved)
app.post('/api/auth/researcher/register', async (req, res) => {
  const {
    registrationNumber,
    name,
    email,
    password,
    purposeStatement
  } = req.body || {};

  if (!registrationNumber || !name || !email || !password || !purposeStatement) {
    return res.status(400).json({
      success: false,
      error: 'registrationNumber, name, email, password, and purposeStatement are required.'
    });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await executeQuery(
      `INSERT INTO RESEARCH_ORGANIZATIONS (
         registration_number, name, email, password_hash, approval_status, purpose_statement
       ) VALUES (
         :reg, :name, :email, :pwd, 'Pending', :purpose
       ) RETURNING org_id INTO :org_id`,
      {
        reg: registrationNumber.trim(),
        name: name.trim(),
        email: email.trim(),
        pwd: passwordHash,
        purpose: purposeStatement.trim(),
        org_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );

    res.status(201).json({
      success: true,
      orgId: result.outBinds.org_id[0],
      approvalStatus: 'Pending',
      message: 'Registration submitted. Access remains disabled until an administrator sets approval_status to Approved.'
    });
  } catch (err) {
    console.error('Researcher register error:', err.message);
    if (err.message.includes('ORA-00001')) {
      return res.status(400).json({
        success: false,
        error: 'Registration number or email already exists.'
      });
    }
    res.status(500).json({ success: false, error: `Registration failed: ${err.message}` });
  }
});

// Researcher authentication (Approved orgs only)
app.post('/api/auth/researcher/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  try {
    const result = await executeQuery(
      `SELECT org_id, name, email, password_hash, approval_status, registration_number
       FROM RESEARCH_ORGANIZATIONS
       WHERE LOWER(email) = LOWER(:email)`,
      { email: email.trim() }
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, error: 'Invalid researcher email or password.' });
    }

    const org = result.rows[0];
    const valid = await comparePassword(password, org.PASSWORD_HASH);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid researcher email or password.' });
    }

    if (org.APPROVAL_STATUS !== 'Approved') {
      return res.status(403).json({
        success: false,
        error: `Access denied. Organization status is ${org.APPROVAL_STATUS}. Only Approved organizations may export data.`
      });
    }

    const token = signToken({
      role: 'researcher',
      orgId: Number(org.ORG_ID),
      email: org.EMAIL,
      name: org.NAME
    });

    res.json({
      success: true,
      token,
      organization: {
        orgId: Number(org.ORG_ID),
        name: org.NAME,
        email: org.EMAIL,
        registrationNumber: org.REGISTRATION_NUMBER,
        approvalStatus: org.APPROVAL_STATUS
      }
    });
  } catch (err) {
    console.error('Researcher login error:', err.message);
    res.status(500).json({ success: false, error: `Researcher login failed: ${err.message}` });
  }
});

// Step 6: Patient Lookup endpoint using PL/SQL (hospital auth required)
app.get('/api/patients/search', requireAuth('hospital'), async (req, res) => {
  const { identity, identityType } = req.query;
  const idCheck = validateIdentityValue(identityType, identity);
  if (!idCheck.ok) {
    return res.status(400).json({ success: false, error: idCheck.error });
  }

  try {
    const result = await executeQuery(
      `BEGIN
          patient_reg_pkg.find_patient(
              p_identity => :identity,
              p_found => :found,
              p_patient_id => :patient_id,
              p_full_name => :full_name,
              p_date_of_birth => :date_of_birth,
              p_gender => :gender,
              p_blood_group => :blood_group,
              p_contact_number => :contact_number,
              p_occupation => :occupation,
              p_street_address => :street_address,
              p_city => :city,
              p_division => :division,
              p_photo_url => :photo_url
          );
       END;`,
      {
        identity: idCheck.value,
        found: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        patient_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        full_name: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
        date_of_birth: { type: oracledb.DATE, dir: oracledb.BIND_OUT },
        gender: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
        blood_group: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
        contact_number: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
        occupation: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
        street_address: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
        city: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
        division: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
        photo_url: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      }
    );

    const out = result.outBinds;
    if (out.found === 1) {
      const dobDate = out.date_of_birth ? new Date(out.date_of_birth).toISOString().split('T')[0] : null;
      res.json({
        success: true,
        found: true,
        patient: {
          patientId: out.patient_id,
          fullName: out.full_name,
          dateOfBirth: dobDate,
          gender: out.gender,
          bloodGroup: out.blood_group,
          contactNumber: out.contact_number,
          occupation: out.occupation,
          streetAddress: out.street_address,
          city: out.city,
          division: out.division,
          photoUrl: out.photo_url
        }
      });
    } else {
      res.json({
        success: true,
        found: false,
        identityType: idCheck.identityType,
        identity: idCheck.value,
        message: 'No patient record found for the provided identity.'
      });
    }
  } catch (err) {
    console.error('Patient search error:', err.message);
    res.status(500).json({ success: false, error: `Database search failed: ${err.message}` });
  }
});

// Step 6: Patient Registration endpoint executing PL/SQL (hospital auth required)
app.post('/api/patients/register', requireAuth('hospital'), async (req, res) => {
  const check = validateNewPatient(req.body || {});
  if (!check.ok) {
    return res.status(400).json({ success: false, error: check.error });
  }
  const p = check.value;

  try {
    const result = await executeQuery(
      `BEGIN
          patient_reg_pkg.register_patient(
              p_national_id => :nationalId,
              p_birth_cert_no => :birthCertNo,
              p_full_name => :fullName,
              p_date_of_birth => TO_DATE(:dob, 'YYYY-MM-DD'),
              p_gender => :gender,
              p_blood_group => :bloodGroup,
              p_contact_number => :contactNumber,
              p_occupation => :occupation,
              p_street_address => :streetAddress,
              p_city => :city,
              p_division => :division,
              p_photo_url => :photoUrl,
              p_patient_id => :patient_id
          );
       END;`,
      {
        nationalId: p.nationalId,
        birthCertNo: p.birthCertNo,
        fullName: p.fullName,
        dob: p.dob,
        gender: p.gender,
        bloodGroup: p.bloodGroup,
        contactNumber: p.contactNumber,
        occupation: p.occupation,
        streetAddress: p.streetAddress,
        city: p.city,
        division: p.division,
        photoUrl: p.photoUrl,
        patient_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );

    const newPatientId = result.outBinds.patient_id;
    res.status(201).json({
      success: true,
      patientId: newPatientId,
      message: 'Patient registered successfully.'
    });
  } catch (err) {
    console.error('Patient registration error:', err.message);
    res.status(400).json({ success: false, error: extractOracleAppError(err) });
  }
});

// Step 10: Batch Case Submission (hospital auth required; hospitalId forced from JWT)
app.post('/api/cases/batch-submit', requireAuth('hospital'), async (req, res) => {
  const { cases } = req.body;

  if (!cases || !Array.isArray(cases) || cases.length === 0) {
    return res.status(400).json({ success: false, error: 'No cases provided in batch.' });
  }

  const hospitalId = Number(req.user.hospitalId);
  const size = cases.length;

  const patientIds = cases.map(c => Number(c.patientId));
  const hospitalIds = cases.map(() => hospitalId);
  const diseaseIds = cases.map(c => Number(c.diseaseId));
  const diagDates = cases.map(c => c.diagnosisDate || '');
  const symptoms = cases.map(c => c.symptomsList || '');
  const severities = cases.map(c => c.severityAtAdmission || 'Mild');
  const methods = cases.map(c => c.diagnosisMethod || 'Clinical');
  const isolations = cases.map(c => c.isolationStatus || 'Home Isolation');
  const sources = cases.map(c => c.infectionSource || 'Unknown');
  const travels = cases.map(c => c.travelHistory || '');
  const comorbidities = cases.map(c => c.coMorbidities || '');
  const notes = cases.map(c => c.notes || '');

  try {
    const result = await executeQuery(
      `BEGIN
          case_entry_pkg.log_case_batch(
              p_patient_ids => :patientIds,
              p_hospital_ids => :hospitalIds,
              p_disease_ids => :diseaseIds,
              p_diag_dates => :diagDates,
              p_symptoms => :symptoms,
              p_severities => :severities,
              p_methods => :methods,
              p_isolations => :isolations,
              p_sources => :sources,
              p_travels => :travels,
              p_comorbidities => :comorbidities,
              p_notes => :notes,
              p_size => :size,
              p_success_count => :successCount,
              p_fail_count => :failCount,
              p_results => :results
          );
       END;`,
      {
        patientIds: { type: oracledb.DB_TYPE_NUMBER, dir: oracledb.BIND_IN, val: patientIds },
        hospitalIds: { type: oracledb.DB_TYPE_NUMBER, dir: oracledb.BIND_IN, val: hospitalIds },
        diseaseIds: { type: oracledb.DB_TYPE_NUMBER, dir: oracledb.BIND_IN, val: diseaseIds },
        diagDates: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: diagDates },
        symptoms: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: symptoms },
        severities: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: severities },
        methods: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: methods },
        isolations: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: isolations },
        sources: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: sources },
        travels: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: travels },
        comorbidities: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: comorbidities },
        notes: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_IN, val: notes },
        size: size,
        successCount: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        failCount: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        results: { type: oracledb.DB_TYPE_VARCHAR, dir: oracledb.BIND_OUT, maxArraySize: size }
      },
      { autoCommit: true }
    );

    res.json({
      success: true,
      successCount: result.outBinds.successCount,
      failCount: result.outBinds.failCount,
      results: result.outBinds.results
    });
  } catch (err) {
    console.error('Batch submit error:', err.message);
    res.status(500).json({ success: false, error: `Batch processing failed: ${err.message}` });
  }
});

function parseCsvQuery(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

// Admin: list hospitals (optional status filter)
app.get('/api/admin/hospitals', requireAuth('admin'), async (req, res) => {
  try {
    const status = req.query.status || null;
    const result = status
      ? await executeQuery(
        `SELECT hospital_id, license_number, name, email, phone, city, division, approval_status, registered_at
         FROM HOSPITALS WHERE approval_status = :status ORDER BY registered_at DESC`,
        { status }
      )
      : await executeQuery(
        `SELECT hospital_id, license_number, name, email, phone, city, division, approval_status, registered_at
         FROM HOSPITALS ORDER BY registered_at DESC`
      );
    res.json({
      success: true,
      hospitals: result.rows.map((r) => ({
        hospitalId: Number(r.HOSPITAL_ID),
        licenseNumber: r.LICENSE_NUMBER,
        name: r.NAME,
        email: r.EMAIL,
        phone: r.PHONE,
        city: r.CITY,
        division: r.DIVISION,
        approvalStatus: r.APPROVAL_STATUS,
        registeredAt: r.REGISTERED_AT
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: list research organizations
app.get('/api/admin/researchers', requireAuth('admin'), async (req, res) => {
  try {
    const status = req.query.status || null;
    const result = status
      ? await executeQuery(
        `SELECT org_id, registration_number, name, email, approval_status, purpose_statement
         FROM RESEARCH_ORGANIZATIONS WHERE approval_status = :status ORDER BY org_id DESC`,
        { status }
      )
      : await executeQuery(
        `SELECT org_id, registration_number, name, email, approval_status, purpose_statement
         FROM RESEARCH_ORGANIZATIONS ORDER BY org_id DESC`
      );
    res.json({
      success: true,
      organizations: result.rows.map((r) => ({
        orgId: Number(r.ORG_ID),
        registrationNumber: r.REGISTRATION_NUMBER,
        name: r.NAME,
        email: r.EMAIL,
        approvalStatus: r.APPROVAL_STATUS,
        purposeStatement: r.PURPOSE_STATEMENT
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: recent researcher download audit rows
app.get('/api/admin/download-logs', requireAuth('admin'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 3, 1), 50);
    const result = await executeQuery(
      `SELECT * FROM (
         SELECT dl.log_id, dl.org_id, dl.downloaded_at, dl.filter_criteria, dl.total_records,
                ro.name AS org_name, ro.email AS org_email
         FROM DOWNLOAD_LOGS dl
         JOIN RESEARCH_ORGANIZATIONS ro ON ro.org_id = dl.org_id
         ORDER BY dl.downloaded_at DESC, dl.log_id DESC
       ) WHERE ROWNUM <= :lim`,
      { lim: limit }
    );
    res.json({
      success: true,
      logs: result.rows.map((r) => ({
        logId: Number(r.LOG_ID),
        orgId: Number(r.ORG_ID),
        orgName: r.ORG_NAME,
        orgEmail: r.ORG_EMAIL,
        downloadedAt: r.DOWNLOADED_AT,
        filterCriteria: r.FILTER_CRITERIA,
        totalRecords: Number(r.TOTAL_RECORDS)
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: approve/reject hospital
app.patch('/api/admin/hospitals/:id/status', requireAuth('admin'), async (req, res) => {
  const status = req.body?.status;
  if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
    return res.status(400).json({ success: false, error: 'status must be Pending, Approved, or Rejected.' });
  }
  try {
    const result = await executeQuery(
      `UPDATE HOSPITALS SET approval_status = :status WHERE hospital_id = :id`,
      { status, id: Number(req.params.id) },
      { autoCommit: true }
    );
    if (!result.rowsAffected) {
      return res.status(404).json({ success: false, error: 'Hospital not found.' });
    }
    res.json({ success: true, message: `Hospital marked ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: approve/reject researcher
app.patch('/api/admin/researchers/:id/status', requireAuth('admin'), async (req, res) => {
  const status = req.body?.status;
  if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
    return res.status(400).json({ success: false, error: 'status must be Pending, Approved, or Rejected.' });
  }
  try {
    const result = await executeQuery(
      `UPDATE RESEARCH_ORGANIZATIONS SET approval_status = :status WHERE org_id = :id`,
      { status, id: Number(req.params.id) },
      { autoCommit: true }
    );
    if (!result.rowsAffected) {
      return res.status(404).json({ success: false, error: 'Research organization not found.' });
    }
    res.json({ success: true, message: `Organization marked ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function mapDiseaseRow(r) {
  const diseaseId = Number(r.DISEASE_ID);
  const hasSampleBlob = !!(r.SAMPLE_IMAGE_MIME || r.HAS_SAMPLE_IMAGE === 'Y');
  return {
    diseaseId,
    diseaseCode: r.DISEASE_CODE,
    commonName: r.COMMON_NAME,
    scientificName: r.SCIENTIFIC_NAME,
    severityLevel: r.SEVERITY_LEVEL,
    transmissionMode: r.TRANSMISSION_MODE,
    description: r.DESCRIPTION,
    category: r.CATEGORY || 'Infectious',
    subcategory: r.SUBCATEGORY || null,
    sampleImageUrl: hasSampleBlob ? `/api/media/diseases/${diseaseId}` : (r.SAMPLE_IMAGE_URL || null),
    sampleImageCaption: r.SAMPLE_IMAGE_CAPTION || null,
    isActive: (r.IS_ACTIVE || 'Y') === 'Y'
  };
}

/** Expand category / subcategory filters into disease codes for stats queries. */
async function resolveDiseaseCodes(query = {}) {
  const codes = parseCsvQuery(query.diseases || query.diseaseCode);
  const categories = parseCsvQuery(query.categories || query.category);
  const subcategories = parseCsvQuery(query.subcategories || query.subcategory);

  if (codes.length) return { codes, categories, subcategories };

  if (!categories.length && !subcategories.length) {
    return { codes: [], categories, subcategories };
  }

  let sql = `SELECT disease_code FROM DISEASES WHERE NVL(is_active,'Y') = 'Y'`;
  const binds = {};
  if (categories.length) {
    const ph = categories.map((_, i) => `:c${i}`).join(', ');
    sql += ` AND category IN (${ph})`;
    categories.forEach((c, i) => { binds[`c${i}`] = c; });
  }
  if (subcategories.length) {
    const ph = subcategories.map((_, i) => `:s${i}`).join(', ');
    sql += ` AND subcategory IN (${ph})`;
    subcategories.forEach((s, i) => { binds[`s${i}`] = s; });
  }
  const result = await executeQuery(sql, binds);
  return {
    codes: result.rows.map((r) => r.DISEASE_CODE),
    categories,
    subcategories
  };
}

function mapFormFieldRow(r) {
  return {
    configId: Number(r.CONFIG_ID),
    diseaseId: Number(r.DISEASE_ID),
    fieldKey: r.FIELD_KEY,
    fieldLabel: r.FIELD_LABEL,
    fieldType: r.FIELD_TYPE,
    fieldOptions: r.FIELD_OPTIONS ? r.FIELD_OPTIONS.split('|') : [],
    isRequired: r.IS_REQUIRED === 'Y',
    displayOrder: Number(r.DISPLAY_ORDER),
    isEnabled: r.IS_ENABLED === 'Y'
  };
}

// Public / hospital: disease list (optional category / subcategory filter)
app.get('/api/diseases', async (req, res) => {
  try {
    const activeOnly = req.query.all !== '1';
    const categories = parseCsvQuery(req.query.categories || req.query.category);
    const subcategories = parseCsvQuery(req.query.subcategories || req.query.subcategory);

    let sql = `
      SELECT disease_id, disease_code, common_name, scientific_name, severity_level,
             transmission_mode, description, category, subcategory,
             sample_image_url, sample_image_caption, sample_image_mime,
             CASE WHEN sample_image_mime IS NOT NULL THEN 'Y' ELSE 'N' END AS has_sample_image,
             NVL(is_active,'Y') AS is_active
      FROM DISEASES WHERE 1=1`;
    const binds = {};

    if (activeOnly) sql += ` AND NVL(is_active,'Y') = 'Y'`;
    if (categories.length) {
      const ph = categories.map((_, i) => `:c${i}`).join(', ');
      sql += ` AND category IN (${ph})`;
      categories.forEach((c, i) => { binds[`c${i}`] = c; });
    }
    if (subcategories.length) {
      const ph = subcategories.map((_, i) => `:s${i}`).join(', ');
      sql += ` AND subcategory IN (${ph})`;
      subcategories.forEach((s, i) => { binds[`s${i}`] = s; });
    }
    sql += ' ORDER BY category, subcategory, common_name';

    const result = await executeQuery(sql, binds);
    res.json({
      success: true,
      diseases: result.rows.map(mapDiseaseRow),
      categories: DISEASE_CATEGORIES,
      transmissionModes: TRANSMISSION_MODES
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Enabled form fields for a disease (hospital intake)
app.get('/api/diseases/:id/form', async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT config_id, disease_id, field_key, field_label, field_type, field_options,
              is_required, display_order, is_enabled
       FROM DISEASE_FORM_FIELDS
       WHERE disease_id = :id AND is_enabled = 'Y'
       ORDER BY display_order, field_key`,
      { id: Number(req.params.id) }
    );
    res.json({ success: true, fields: result.rows.map(mapFormFieldRow) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: field catalog (all possible clinical fields)
app.get('/api/admin/field-catalog', requireAuth('admin'), (req, res) => {
  res.json({ success: true, catalog: FIELD_CATALOG });
});

// Admin: full form config for a disease (enabled + disabled)
app.get('/api/admin/diseases/:id/form', requireAuth('admin'), async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT config_id, disease_id, field_key, field_label, field_type, field_options,
              is_required, display_order, is_enabled
       FROM DISEASE_FORM_FIELDS
       WHERE disease_id = :id
       ORDER BY display_order, field_key`,
      { id: Number(req.params.id) }
    );
    res.json({ success: true, fields: result.rows.map(mapFormFieldRow), catalog: FIELD_CATALOG });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: create disease (+ default form rows from catalog)
app.post('/api/admin/diseases', requireAuth('admin'), async (req, res) => {
  const {
    diseaseCode,
    commonName,
    scientificName,
    severityLevel,
    transmissionMode,
    description,
    category,
    subcategory
  } = req.body || {};

  if (!diseaseCode || !commonName || !severityLevel || !transmissionMode || !category) {
    return res.status(400).json({
      success: false,
      error: 'diseaseCode, commonName, severityLevel, transmissionMode, and category are required.'
    });
  }

  try {
    const insert = await executeQuery(
      `INSERT INTO DISEASES (
         disease_code, common_name, scientific_name, severity_level, transmission_mode,
         description, category, subcategory, is_active
       ) VALUES (
         :code, :name, :sci, :sev, :trans, :descr, :cat, :sub, 'Y'
       ) RETURNING disease_id INTO :disease_id`,
      {
        code: diseaseCode.trim().toUpperCase(),
        name: commonName.trim(),
        sci: scientificName || null,
        sev: severityLevel,
        trans: transmissionMode,
        descr: description || null,
        cat: category.trim(),
        sub: subcategory ? subcategory.trim() : null,
        disease_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );
    const diseaseId = insert.outBinds.disease_id[0];
    const enabledKeys = formKeysForDisease({
      category: category.trim(),
      diseaseCode: diseaseCode.trim().toUpperCase()
    });

    for (let i = 0; i < FIELD_CATALOG.length; i++) {
      const f = FIELD_CATALOG[i];
      const enabled = enabledKeys.includes(f.key);
      const required = !f.alwaysOptional && (
        ['diagnosis_date', 'symptoms_list', 'severity_at_admission', 'diagnosis_method'].includes(f.key)
        || (category.trim() === 'Infectious' && ['isolation_status', 'infection_source'].includes(f.key))
      );
      await executeQuery(
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
          req: required ? 'Y' : 'N',
          ord: i + 1,
          en: enabled ? 'Y' : 'N'
        },
        { autoCommit: true }
      );
    }

    res.status(201).json({ success: true, diseaseId, message: 'Disease created with category-aware form template.' });
  } catch (err) {
    if (err.message.includes('ORA-00001')) {
      return res.status(400).json({ success: false, error: 'Disease code already exists.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: update / soft-remove disease
app.patch('/api/admin/diseases/:id', requireAuth('admin'), async (req, res) => {
  const id = Number(req.params.id);
  const {
    commonName,
    scientificName,
    severityLevel,
    transmissionMode,
    description,
    category,
    subcategory,
    isActive,
    sampleImageUrl,
    sampleImageCaption
  } = req.body || {};

  try {
    const result = await executeQuery(
      `UPDATE DISEASES SET
         common_name = NVL(:name, common_name),
         scientific_name = NVL(:sci, scientific_name),
         severity_level = NVL(:sev, severity_level),
         transmission_mode = NVL(:trans, transmission_mode),
         description = NVL(:descr, description),
         category = NVL(:cat, category),
         subcategory = NVL(:sub, subcategory),
         sample_image_url = CASE WHEN :clearSample = 1 THEN NULL ELSE NVL(:sampleUrl, sample_image_url) END,
         sample_image_caption = NVL(:sampleCaption, sample_image_caption),
         is_active = NVL(:active, is_active)
       WHERE disease_id = :id`,
      {
        name: commonName || null,
        sci: scientificName || null,
        sev: severityLevel || null,
        trans: transmissionMode || null,
        descr: description || null,
        cat: category || null,
        sub: subcategory || null,
        sampleUrl: sampleImageUrl === undefined ? null : sampleImageUrl,
        clearSample: sampleImageUrl === null ? 1 : 0,
        sampleCaption: sampleImageCaption === undefined ? null : sampleImageCaption,
        active: typeof isActive === 'boolean' ? (isActive ? 'Y' : 'N') : null,
        id
      },
      { autoCommit: true }
    );
    if (!result.rowsAffected) {
      return res.status(404).json({ success: false, error: 'Disease not found.' });
    }
    res.json({ success: true, message: 'Disease updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Hospital: stage a clinical case image in Oracle (PENDING_IMAGE_UPLOADS BLOB)
app.post('/api/uploads/case-image', requireAuth('hospital'), (req, res) => {
  imageUpload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Upload failed.' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ success: false, error: 'image file is required.' });
    }
    try {
      const hospitalId = Number(req.user.hospitalId);
      const result = await executeQuery(
        `INSERT INTO PENDING_IMAGE_UPLOADS (hospital_id, image_blob, mime_type)
         VALUES (:hid, :blob, :mime)
         RETURNING upload_id INTO :upload_id`,
        {
          hid: hospitalId,
          blob: req.file.buffer,
          mime: req.file.mimetype || 'image/jpeg',
          upload_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        },
        { autoCommit: true }
      );
      const uploadId = result.outBinds.upload_id[0];
      res.status(201).json({
        success: true,
        uploadId,
        ref: `pending:${uploadId}`,
        url: `/api/media/pending/${uploadId}`
      });
    } catch (dbErr) {
      console.error('Case image upload error:', dbErr.message);
      res.status(500).json({ success: false, error: dbErr.message });
    }
  });
});

// Admin: store disease sample image as Oracle BLOB
app.post('/api/admin/diseases/:id/sample-image', requireAuth('admin'), (req, res) => {
  imageUpload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Upload failed.' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ success: false, error: 'image file is required.' });
    }
    const id = Number(req.params.id);
    const caption = (req.body?.caption || '').trim() || null;
    try {
      const result = await executeQuery(
        `UPDATE DISEASES SET
           sample_image = :blob,
           sample_image_mime = :mime,
           sample_image_url = NULL,
           sample_image_caption = NVL(:caption, sample_image_caption)
         WHERE disease_id = :id`,
        {
          blob: req.file.buffer,
          mime: req.file.mimetype || 'image/jpeg',
          caption,
          id
        },
        { autoCommit: true }
      );
      if (!result.rowsAffected) {
        return res.status(404).json({ success: false, error: 'Disease not found.' });
      }
      res.status(201).json({
        success: true,
        sampleImageUrl: `/api/media/diseases/${id}`,
        sampleImageCaption: caption
      });
    } catch (dbErr) {
      console.error('Disease sample upload error:', dbErr.message);
      res.status(500).json({ success: false, error: dbErr.message });
    }
  });
});

// Serve disease sample BLOB (registry reference image)
app.get('/api/media/diseases/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await executeQuery(
      `SELECT sample_image, sample_image_mime FROM DISEASES WHERE disease_id = :id`,
      { id },
      { fetchInfo: { SAMPLE_IMAGE: { type: oracledb.BUFFER } } }
    );
    const row = result.rows[0];
    if (!row?.SAMPLE_IMAGE || !row.SAMPLE_IMAGE_MIME) {
      return res.status(404).json({ success: false, error: 'No sample image.' });
    }
    res.setHeader('Content-Type', row.SAMPLE_IMAGE_MIME);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(Buffer.from(row.SAMPLE_IMAGE));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve staged hospital upload BLOB (owner hospital only)
app.get('/api/media/pending/:id', requireAuth('hospital'), async (req, res) => {
  try {
    const uploadId = Number(req.params.id);
    const hospitalId = Number(req.user.hospitalId);
    const result = await executeQuery(
      `SELECT image_blob, mime_type
       FROM PENDING_IMAGE_UPLOADS
       WHERE upload_id = :id AND hospital_id = :hid`,
      { id: uploadId, hid: hospitalId },
      { fetchInfo: { IMAGE_BLOB: { type: oracledb.BUFFER } } }
    );
    const row = result.rows[0];
    if (!row?.IMAGE_BLOB) {
      return res.status(404).json({ success: false, error: 'Upload not found.' });
    }
    res.setHeader('Content-Type', row.MIME_TYPE || 'image/jpeg');
    res.send(Buffer.from(row.IMAGE_BLOB));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: save per-disease form field toggles
app.put('/api/admin/diseases/:id/form', requireAuth('admin'), async (req, res) => {
  const diseaseId = Number(req.params.id);
  const fields = req.body?.fields;
  if (!Array.isArray(fields) || !fields.length) {
    return res.status(400).json({ success: false, error: 'fields array is required.' });
  }

  try {
    for (const f of fields) {
      const catalog = FIELD_CATALOG.find((c) => c.key === f.fieldKey);
      if (!catalog) continue;
      const existing = await executeQuery(
        `SELECT config_id FROM DISEASE_FORM_FIELDS WHERE disease_id = :did AND field_key = :fkey`,
        { did: diseaseId, fkey: f.fieldKey }
      );
      const required = catalog.alwaysOptional ? false : !!f.isRequired;
      if (existing.rows.length) {
        await executeQuery(
          `UPDATE DISEASE_FORM_FIELDS
           SET is_enabled = :en, is_required = :req, display_order = :ord,
               field_label = :label, field_type = :ftype, field_options = :opts
           WHERE disease_id = :did AND field_key = :fkey`,
          {
            en: f.isEnabled ? 'Y' : 'N',
            req: required ? 'Y' : 'N',
            ord: Number(f.displayOrder) || 1,
            label: f.fieldLabel || catalog.label,
            ftype: catalog.type,
            opts: catalog.options ? catalog.options.join('|') : null,
            did: diseaseId,
            fkey: f.fieldKey
          },
          { autoCommit: true }
        );
      } else {
        await executeQuery(
          `INSERT INTO DISEASE_FORM_FIELDS (
             disease_id, field_key, field_label, field_type, field_options,
             is_required, display_order, is_enabled
           ) VALUES (
             :did, :fkey, :label, :ftype, :opts, :req, :ord, :en
           )`,
          {
            did: diseaseId,
            fkey: f.fieldKey,
            label: f.fieldLabel || catalog.label,
            ftype: catalog.type,
            opts: catalog.options ? catalog.options.join('|') : null,
            req: required ? 'Y' : 'N',
            ord: Number(f.displayOrder) || 1,
            en: f.isEnabled ? 'Y' : 'N'
          },
          { autoCommit: true }
        );
      }
    }
    res.json({ success: true, message: 'Disease form configuration saved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Hospital: submit one clinical case using disease-specific enabled fields
app.post('/api/cases/submit', requireAuth('hospital'), async (req, res) => {
  const hospitalId = Number(req.user.hospitalId);
  const { patientId, newPatient, diseaseId, caseFields } = req.body || {};

  if (!diseaseId || !caseFields || typeof caseFields !== 'object') {
    return res.status(400).json({ success: false, error: 'diseaseId and caseFields are required.' });
  }

  try {
    let resolvedPatientId = patientId ? Number(patientId) : null;

    if (!resolvedPatientId && newPatient) {
      const check = validateNewPatient(newPatient);
      if (!check.ok) {
        return res.status(400).json({ success: false, error: check.error });
      }
      const p = check.value;
      const reg = await executeQuery(
        `BEGIN
            patient_reg_pkg.register_patient(
                p_national_id => :nationalId,
                p_birth_cert_no => :birthCertNo,
                p_full_name => :fullName,
                p_date_of_birth => TO_DATE(:dob, 'YYYY-MM-DD'),
                p_gender => :gender,
                p_blood_group => :bloodGroup,
                p_contact_number => :contactNumber,
                p_occupation => :occupation,
                p_street_address => :streetAddress,
                p_city => :city,
                p_division => :division,
                p_photo_url => :photoUrl,
                p_patient_id => :out_patient_id
            );
         END;`,
        {
          nationalId: p.nationalId,
          birthCertNo: p.birthCertNo,
          fullName: p.fullName,
          dob: p.dob,
          gender: p.gender,
          bloodGroup: p.bloodGroup,
          contactNumber: p.contactNumber,
          occupation: p.occupation,
          streetAddress: p.streetAddress,
          city: p.city,
          division: p.division,
          photoUrl: p.photoUrl,
          out_patient_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        },
        { autoCommit: true }
      );
      resolvedPatientId = reg.outBinds.out_patient_id;
    }

    if (!resolvedPatientId) {
      return res.status(400).json({ success: false, error: 'Patient ID or newPatient registration data is required.' });
    }

    const formCfg = await executeQuery(
      `SELECT field_key, is_required, is_enabled
       FROM DISEASE_FORM_FIELDS
       WHERE disease_id = :id AND is_enabled = 'Y'`,
      { id: Number(diseaseId) }
    );

    if (!formCfg.rows.length) {
      return res.status(400).json({ success: false, error: 'No form fields configured for this disease. Ask admin to set the form.' });
    }

    for (const row of formCfg.rows) {
      const catalog = FIELD_CATALOG.find((c) => c.key === row.FIELD_KEY);
      if (catalog?.alwaysOptional) continue;
      if (row.IS_REQUIRED === 'Y') {
        const val = caseFields[row.FIELD_KEY];
        if (val === undefined || val === null || String(val).trim() === '') {
          return res.status(400).json({
            success: false,
            error: `Required field missing for this disease form: ${row.FIELD_KEY}`
          });
        }
      }
    }

    const get = (key, fallback = null) => {
      const v = caseFields[key];
      if (v === undefined || v === null || String(v).trim() === '') return fallback;
      return v;
    };

    const pendingUploadId = parsePendingUploadRef(get('affected_part_image'));
    let imageBlob = null;
    let imageMime = null;
    if (pendingUploadId) {
      const pending = await executeQuery(
        `SELECT image_blob, mime_type
         FROM PENDING_IMAGE_UPLOADS
         WHERE upload_id = :id AND hospital_id = :hid`,
        { id: pendingUploadId, hid: hospitalId },
        { fetchInfo: { IMAGE_BLOB: { type: oracledb.BUFFER } } }
      );
      if (!pending.rows.length || !pending.rows[0].IMAGE_BLOB) {
        return res.status(400).json({
          success: false,
          error: 'Uploaded body-part photo expired or was not found. Please upload again.'
        });
      }
      imageBlob = Buffer.from(pending.rows[0].IMAGE_BLOB);
      imageMime = pending.rows[0].MIME_TYPE || 'image/jpeg';
    }

    const result = await executeQuery(
      `INSERT INTO CASE_RECORDS (
         patient_id, hospital_id, disease_id, diagnosis_date,
         symptoms_list, severity_at_admission, diagnosis_method,
         patient_status, isolation_status, infection_source,
         co_morbidities, travel_history, notes,
         affected_part_image, affected_part_image_mime, affected_part_image_url
       ) VALUES (
         :patientId, :hospitalId, :diseaseId, TO_DATE(:diagDate, 'YYYY-MM-DD'),
         :symptoms, :severity, :method,
         :status, :isolation, :source,
         :comorbid, :travel, :notes,
         :imgBlob, :imgMime, NULL
       ) RETURNING case_id INTO :case_id`,
      {
        patientId: resolvedPatientId,
        hospitalId,
        diseaseId: Number(diseaseId),
        diagDate: get('diagnosis_date'),
        symptoms: get('symptoms_list', 'Not specified'),
        severity: get('severity_at_admission', 'Mild'),
        method: get('diagnosis_method', 'Clinical'),
        status: get('patient_status', 'Active'),
        isolation: get('isolation_status', 'Home Isolation'),
        source: get('infection_source', 'Unknown'),
        comorbid: get('co_morbidities'),
        travel: get('travel_history'),
        notes: get('notes'),
        imgBlob: imageBlob,
        imgMime: imageMime,
        case_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );

    const caseId = result.outBinds.case_id[0];
    if (pendingUploadId) {
      await executeQuery(
        `DELETE FROM PENDING_IMAGE_UPLOADS WHERE upload_id = :id AND hospital_id = :hid`,
        { id: pendingUploadId, hid: hospitalId },
        { autoCommit: true }
      );
    }

    res.status(201).json({
      success: true,
      caseId,
      patientId: resolvedPatientId,
      message: 'Case logged successfully using disease-specific form.'
    });
  } catch (err) {
    console.error('Case submit error:', err.message);
    res.status(400).json({ success: false, error: extractOracleAppError(err) });
  }
});

// Catalog helpers for public filter UI (categories → subcategories → diseases)
app.get('/api/public/catalog', async (req, res) => {
  try {
    const diseases = await executeQuery(
      `SELECT disease_code, common_name, category, subcategory
       FROM DISEASES
       WHERE NVL(is_active,'Y') = 'Y'
       ORDER BY category, subcategory, common_name`
    );
    const rows = diseases.rows.map((d) => ({
      code: d.DISEASE_CODE,
      name: d.COMMON_NAME,
      category: d.CATEGORY || 'Infectious',
      subcategory: d.SUBCATEGORY || null
    }));
    const categories = [...new Set(rows.map((d) => d.category))].sort();
    const subcategories = [...new Set(rows.map((d) => d.subcategory).filter(Boolean))].sort();
    res.json({
      success: true,
      diseases: rows,
      categories,
      subcategories,
      categoryList: DISEASE_CATEGORIES,
      divisions: ['Dhaka', 'Chittagong', 'Rajshahi', 'Khulna', 'Barisal', 'Sylhet', 'Rangpur', 'Mymensingh']
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Step 12: Public API Endpoint to fetch aggregated outbreak statistics (multi-filter)
app.get('/api/public/stats', async (req, res) => {
  try {
    const resolved = await resolveDiseaseCodes(req.query);
    const diseases = resolved.codes;
    const divisions = parseCsvQuery(req.query.divisions || req.query.division);

    let sql = `
      SELECT division, disease_code, active_cases, total_cases, total_deaths, last_updated
      FROM DIVISIONAL_STATS_SUMMARY
      WHERE 1=1`;
    const binds = {};

    if (diseases.length) {
      const placeholders = diseases.map((_, i) => `:d${i}`).join(', ');
      sql += ` AND disease_code IN (${placeholders})`;
      diseases.forEach((d, i) => { binds[`d${i}`] = d; });
    }
    if (divisions.length) {
      const placeholders = divisions.map((_, i) => `:v${i}`).join(', ');
      sql += ` AND division IN (${placeholders})`;
      divisions.forEach((d, i) => { binds[`v${i}`] = d; });
    }
    sql += ' ORDER BY division, disease_code';

    const result = await executeQuery(sql, binds);
    const stats = result.rows.map(row => ({
      division: row.DIVISION,
      diseaseCode: row.DISEASE_CODE,
      activeCases: Number(row.ACTIVE_CASES),
      totalCases: Number(row.TOTAL_CASES),
      totalDeaths: Number(row.TOTAL_DEATHS),
      lastUpdated: row.LAST_UPDATED
    }));

    res.json({
      success: true,
      stats,
      filters: {
        diseases,
        categories: resolved.categories,
        subcategories: resolved.subcategories,
        divisions
      }
    });
  } catch (err) {
    console.error('Fetch public stats error:', err.message);
    res.status(500).json({ success: false, error: `Could not retrieve public statistics: ${err.message}` });
  }
});

const DIVISION_COORDINATES = {
  Dhaka: { lat: 23.8103, lng: 90.4125 },
  Chittagong: { lat: 22.3569, lng: 91.7832 },
  Chattogram: { lat: 22.3569, lng: 91.7832 },
  Rajshahi: { lat: 24.3745, lng: 88.6042 },
  Khulna: { lat: 22.8456, lng: 89.5403 },
  Barisal: { lat: 22.7010, lng: 90.3535 },
  Barishal: { lat: 22.7010, lng: 90.3535 },
  Sylhet: { lat: 24.8949, lng: 91.8687 },
  Rangpur: { lat: 25.7508, lng: 89.2467 },
  Mymensingh: { lat: 24.7471, lng: 90.4203 }
};

const ALL_DIVISIONS = [
  'Dhaka', 'Chittagong', 'Rajshahi', 'Khulna',
  'Barisal', 'Sylhet', 'Rangpur', 'Mymensingh'
];

function normalizeDivisionKey(name) {
  const n = String(name || '').trim().toLowerCase();
  if (n === 'chattogram') return 'Chittagong';
  if (n === 'barishal') return 'Barisal';
  const hit = ALL_DIVISIONS.find((d) => d.toLowerCase() === n);
  return hit || String(name || '').trim();
}

app.get('/api/public/map-data', async (req, res) => {
  try {
    const resolved = await resolveDiseaseCodes(req.query);
    const diseases = resolved.codes;
    const divisions = parseCsvQuery(req.query.divisions || req.query.division);

    let sql = `
      SELECT division,
             SUM(active_cases) AS active_cases,
             SUM(total_cases) AS total_cases,
             SUM(total_deaths) AS total_deaths
      FROM DIVISIONAL_STATS_SUMMARY
      WHERE 1=1`;
    const binds = {};

    if (diseases.length) {
      const placeholders = diseases.map((_, i) => `:d${i}`).join(', ');
      sql += ` AND disease_code IN (${placeholders})`;
      diseases.forEach((d, i) => { binds[`d${i}`] = d; });
    }
    if (divisions.length) {
      const placeholders = divisions.map((_, i) => `:v${i}`).join(', ');
      sql += ` AND division IN (${placeholders})`;
      divisions.forEach((d, i) => { binds[`v${i}`] = d; });
    }
    sql += ' GROUP BY division';

    const result = await executeQuery(sql, binds);
    const byName = {};
    result.rows.forEach((row) => {
      const key = normalizeDivisionKey(row.DIVISION);
      if (!byName[key]) {
        byName[key] = { activeCases: 0, totalCases: 0, totalDeaths: 0 };
      }
      byName[key].activeCases += Number(row.ACTIVE_CASES) || 0;
      byName[key].totalCases += Number(row.TOTAL_CASES) || 0;
      byName[key].totalDeaths += Number(row.TOTAL_DEATHS) || 0;
    });

    // Always emit all 8 divisions so the choropleth silhouette is complete
    const mapData = ALL_DIVISIONS.map((divName) => {
      const stats = byName[divName] || { activeCases: 0, totalCases: 0, totalDeaths: 0 };
      const coords = DIVISION_COORDINATES[divName];
      return {
        division: divName,
        lat: coords.lat,
        lng: coords.lng,
        activeCases: stats.activeCases,
        totalCases: stats.totalCases,
        totalDeaths: stats.totalDeaths
      };
    });

    res.json({ success: true, mapData, filters: { diseases, divisions } });
  } catch (err) {
    console.error('Fetch map data error:', err.message);
    res.status(500).json({ success: false, error: `Could not retrieve map indicators: ${err.message}` });
  }
});

// Step 15: Secure Researcher Data Export Pipeline (researcher JWT + PL/SQL approval + DOWNLOAD_LOGS)
// When cases include BLOB body-part photos, returns a ZIP (JSON + images/). Otherwise JSON only.
app.get('/api/research/export', requireAuth('researcher'), async (req, res) => {
  let conn;
  try {
    const diseases = parseCsvQuery(req.query.diseases || req.query.diseaseCode);
    const divisions = parseCsvQuery(req.query.divisions || req.query.division);
    const { startDate, endDate } = req.query;
    const orgId = Number(req.user.orgId);
    const diseaseCsv = diseases.length ? diseases.join(',') : null;
    const divisionCsv = divisions.length ? divisions.join(',') : null;

    const pool = await getPool();
    conn = await pool.getConnection();

    const result = await conn.execute(
      `BEGIN
         research_data_pkg.get_anonymized_cases(
             p_org_id => :orgId,
             p_disease_code => :diseaseCode,
             p_division => :division,
             p_start_date => :startDate,
             p_end_date => :endDate,
             p_cursor => :cursor
         );
       END;`,
      {
        orgId,
        diseaseCode: diseaseCsv,
        division: divisionCsv,
        startDate: startDate || null,
        endDate: endDate || null,
        cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );

    const cursor = result.outBinds.cursor;
    const rows = [];
    const imageFiles = [];
    let row;
    let imageIndex = 0;

    while ((row = await cursor.getRow())) {
      let affectedPartImage = null;
      if (row.HAS_IMAGE === 'Y' && row.CASE_ID) {
        const img = await conn.execute(
          `SELECT affected_part_image, affected_part_image_mime
           FROM CASE_RECORDS WHERE case_id = :id`,
          { id: row.CASE_ID },
          { fetchInfo: { AFFECTED_PART_IMAGE: { type: oracledb.BUFFER } } }
        );
        const blob = img.rows[0]?.AFFECTED_PART_IMAGE;
        const mime = img.rows[0]?.AFFECTED_PART_IMAGE_MIME || row.AFFECTED_PART_IMAGE_MIME || 'image/jpeg';
        if (blob && blob.length) {
          imageIndex += 1;
          const ext = mimeToExt(mime);
          const hash = String(row.PATIENT_HASH || 'anon').slice(0, 12);
          const zipName = `images/${hash}_${imageIndex}${ext}`;
          affectedPartImage = zipName;
          imageFiles.push({ zipName, buffer: Buffer.from(blob) });
        }
      }

      rows.push({
        patientHash: row.PATIENT_HASH,
        patientAge: row.PATIENT_AGE,
        gender: row.GENDER,
        bloodGroup: row.BLOOD_GROUP,
        city: row.CITY,
        division: row.DIVISION,
        diseaseCode: row.DISEASE_CODE,
        diseaseName: row.DISEASE_NAME,
        diagnosisDate: row.DIAGNOSIS_DATE,
        symptoms: row.SYMPTOMS_LIST,
        severity: row.SEVERITY_AT_ADMISSION,
        patientStatus: row.PATIENT_STATUS,
        affectedPartImage
      });
    }
    await cursor.close();

    const jsonPayload = JSON.stringify(rows, null, 2);

    if (!imageFiles.length) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="anonymized_outbreak_data.json"');
      return res.send(jsonPayload);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="anonymized_outbreak_export.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error('Research export zip error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to build export archive.' });
      } else {
        res.end();
      }
    });
    archive.pipe(res);
    archive.append(jsonPayload, { name: 'anonymized_outbreak_data.json' });
    for (const file of imageFiles) {
      archive.append(file.buffer, { name: file.zipName });
    }
    await archive.finalize();
  } catch (err) {
    console.error('Research export error:', err.message);
    if (res.headersSent) return;
    const status = err.message.includes('ORA-20002') ? 403 : 500;
    res.status(status).json({ success: false, error: extractOracleAppError(err) });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (closeErr) {
        console.error('Connection close error in export:', closeErr.message);
      }
    }
  }
});

app.listen(PORT, '127.0.0.1', async () => {
  console.log(`Backend server running on http://127.0.0.1:${PORT}`);

  try {
    await initializeDb();

    console.log('Compiling initial database outbreak statistics...');
    await executeQuery('BEGIN refresh_disease_stats; END;');
    console.log('Database statistics updated successfully.');

    const REFRESH_INTERVAL = 5 * 60 * 1000;
    setInterval(async () => {
      console.log('Scheduler: Refreshing outbreak statistics...');
      try {
        await executeQuery('BEGIN refresh_disease_stats; END;');
        console.log('Scheduler: Outbreak statistics refreshed.');
      } catch (err) {
        console.error('Scheduler Error: Failed to execute refresh_disease_stats:', err.message);
      }
    }, REFRESH_INTERVAL);
  } catch (err) {
    console.warn('\n[WARNING] Local Oracle DB not connected on startup. Verify credentials in backend/.env and start your local Oracle service.\n');
  }
});
