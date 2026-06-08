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

// Start Server
app.listen(PORT, '127.0.0.1', async () => {
  console.log(`Backend server running on http://127.0.0.1:${PORT}`);
  
  // Proactively attempt connection pool initialization on startup
  try {
    await initializeDb();
  } catch (err) {
    console.warn('\n[WARNING] Local Oracle DB not connected on startup. Verify credentials in backend/.env and start your local Oracle service.\n');
  }
});
