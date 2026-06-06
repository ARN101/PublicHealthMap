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
