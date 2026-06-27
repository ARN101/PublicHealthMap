const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all cross-origin requests during dev
app.use(cors());
app.use(express.json());

// Step 1: Basic Hello World Endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: "Hello from the PublicHealthMap Backend!" });
});

const { initializeDb, executeQuery } = require('./db');

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

const oracledb = require('oracledb');

// Step 6: Patient Lookup endpoint using PL/SQL
app.get('/api/patients/search', async (req, res) => {
  const { identity } = req.query;
  if (!identity) {
    return res.status(400).json({ success: false, error: 'Identity query parameter is required.' });
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
        identity: identity,
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
      // Format the Date of Birth to a clean YYYY-MM-DD string
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
        message: 'No patient record found for the provided identity.'
      });
    }
  } catch (err) {
    console.error('Patient search error:', err.message);
    res.status(500).json({ success: false, error: `Database search failed: ${err.message}` });
  }
});

// Step 6: Patient Registration endpoint executing PL/SQL
app.post('/api/patients/register', async (req, res) => {
  const {
    nationalId,
    birthCertNo,
    fullName,
    dob,
    gender,
    bloodGroup,
    contactNumber,
    occupation,
    streetAddress,
    city,
    division,
    photoUrl
  } = req.body;

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
        nationalId: nationalId || null,
        birthCertNo: birthCertNo || null,
        fullName: fullName || null,
        dob: dob || null,
        gender: gender || null,
        bloodGroup: bloodGroup || null,
        contactNumber: contactNumber || null,
        occupation: occupation || null,
        streetAddress: streetAddress || null,
        city: city || null,
        division: division || null,
        photoUrl: photoUrl || null,
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
    
    // Parse custom PL/SQL application errors (ORA-20101 to ORA-20104)
    let userMessage = err.message;
    if (err.message.includes('ORA-20')) {
      const matches = err.message.match(/ORA-20\d{3}:\s*(.*)/);
      if (matches && matches[1]) {
        userMessage = matches[1].split('\n')[0]; // Extract the first line of the custom error
      }
    }
    res.status(400).json({ success: false, error: userMessage });
  }
});

// Step 10: Batch Case Submission executing PL/SQL stored procedure
app.post('/api/cases/batch-submit', async (req, res) => {
  const { cases } = req.body;

  if (!cases || !Array.isArray(cases) || cases.length === 0) {
    return res.status(400).json({ success: false, error: 'No cases provided in batch.' });
  }

  const size = cases.length;

  // Extract arrays of values
  const patientIds = cases.map(c => Number(c.patientId));
  const hospitalIds = cases.map(c => Number(c.hospitalId));
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

// Step 12: Public API Endpoint to fetch aggregated outbreak statistics
app.get('/api/public/stats', async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT division, disease_code, active_cases, total_cases, total_deaths, last_updated 
       FROM DIVISIONAL_STATS_SUMMARY 
       ORDER BY division, disease_code`
    );
    
    const stats = result.rows.map(row => ({
      division: row.DIVISION,
      diseaseCode: row.DISEASE_CODE,
      activeCases: Number(row.ACTIVE_CASES),
      totalCases: Number(row.TOTAL_CASES),
      totalDeaths: Number(row.TOTAL_DEATHS),
      lastUpdated: row.LAST_UPDATED
    }));

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Fetch public stats error:', err.message);
    res.status(500).json({ success: false, error: `Could not retrieve public statistics: ${err.message}` });
  }
});

// Dictionary of geographic coordinates for Bangladesh divisions
const DIVISION_COORDINATES = {
  'Dhaka': { lat: 23.8103, lng: 90.4125 },
  'Chittagong': { lat: 22.3569, lng: 91.7832 },
  'Chattogram': { lat: 22.3569, lng: 91.7832 },
  'Rajshahi': { lat: 24.3745, lng: 88.6042 },
  'Khulna': { lat: 22.8456, lng: 89.5403 },
  'Barisal': { lat: 22.7010, lng: 90.3535 },
  'Barishal': { lat: 22.7010, lng: 90.3535 },
  'Sylhet': { lat: 24.8949, lng: 91.8687 },
  'Rangpur': { lat: 25.7508, lng: 89.2467 },
  'Mymensingh': { lat: 24.7471, lng: 90.4203 }
};

// Step 12: Public API Endpoint to fetch map boundary indicators
app.get('/api/public/map-data', async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT division, 
              SUM(active_cases) AS active_cases, 
              SUM(total_cases) AS total_cases, 
              SUM(total_deaths) AS total_deaths
       FROM DIVISIONAL_STATS_SUMMARY 
       GROUP BY division`
    );

    const mapData = result.rows.map(row => {
      const divName = row.DIVISION;
      const coords = DIVISION_COORDINATES[divName] || { lat: 23.6850, lng: 90.3563 };
      return {
        division: divName,
        lat: coords.lat,
        lng: coords.lng,
        activeCases: Number(row.ACTIVE_CASES),
        totalCases: Number(row.TOTAL_CASES),
        totalDeaths: Number(row.TOTAL_DEATHS)
      };
    });

    res.json({ success: true, mapData });
  } catch (err) {
    console.error('Fetch map data error:', err.message);
    res.status(500).json({ success: false, error: `Could not retrieve map indicators: ${err.message}` });
  }
});

// Step 15: Secure Researcher Data Export Pipeline
app.get('/api/research/export', async (req, res) => {
  let conn;
  try {
    const { diseaseCode, division, startDate, endDate } = req.query;

    const pool = await initializeDb();
    conn = await pool.getConnection();

    const result = await conn.execute(
      `BEGIN
         research_data_pkg.get_anonymized_cases(
             p_disease_code => :diseaseCode,
             p_division => :division,
             p_start_date => :startDate,
             p_end_date => :endDate,
             p_cursor => :cursor
         );
       END;`,
      {
        diseaseCode: diseaseCode || null,
        division: division || null,
        startDate: startDate || null,
        endDate: endDate || null,
        cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
      }
    );

    const cursor = result.outBinds.cursor;
    const rows = [];
    let row;

    while ((row = await cursor.getRow())) {
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
        patientStatus: row.PATIENT_STATUS
      });
    }
    await cursor.close();

    // Set headers to trigger file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="anonymized_outbreak_data.json"');
    
    res.send(JSON.stringify(rows, null, 2));

  } catch (err) {
    console.error('Research export error:', err.message);
    res.status(500).json({ success: false, error: `Export pipeline failed: ${err.message}` });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Connection close error in export:', err.message);
      }
    }
  }
});

// Start Server
app.listen(PORT, '127.0.0.1', async () => {
  console.log(`Backend server running on http://127.0.0.1:${PORT}`);
  
  // Proactively attempt connection pool initialization on startup
  try {
    await initializeDb();

    // Compile background stats immediately on startup
    console.log('Compiling initial database outbreak statistics...');
    await executeQuery('BEGIN refresh_disease_stats; END;');
    console.log('Database statistics updated successfully.');

    // Configure 5-minute background stats refresh timer
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
