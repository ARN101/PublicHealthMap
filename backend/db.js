const oracledb = require('oracledb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Enable Thick mode to support older Oracle databases (like 11g)
function initializeThickMode() {
  try {
    const clientOpts = {};
    if (process.env.ORACLE_CLIENT_DIR) {
      clientOpts.libDir = process.env.ORACLE_CLIENT_DIR;
    }
    // Calling initOracleClient enables Thick Mode
    oracledb.initOracleClient(clientOpts);
    console.log('Oracle client initialized in Thick Mode successfully.');
  } catch (err) {
    // NJS-083 is thrown if node-oracledb was already initialized in Thick mode, which is fine
    if (err.message.includes('NJS-083')) {
      console.log('Oracle client already running in Thick Mode.');
    } else {
      console.error('Failed to initialize Oracle Client (Thick Mode):', err.message);
      throw err;
    }
  }
}

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool = null;

async function initializeDb() {
  if (pool) return pool;
  
  try {
    // Trigger Thick Mode initialization to support 11g
    initializeThickMode();
    
    console.log('Initializing Oracle Database connection pool...');
    pool = await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1
    });
    console.log('Oracle connection pool created successfully.');
    return pool;
  } catch (err) {
    console.error('Failed to create Oracle connection pool:', err.message);
    throw err;
  }
}

async function getPool() {
  if (!pool) {
    return await initializeDb();
  }
  return pool;
}

// Helper to run simple queries safely
async function executeQuery(sql, binds = [], options = {}) {
  let connection;
  try {
    const dbPool = await getPool();
    connection = await dbPool.getConnection();
    const result = await connection.execute(sql, binds, options);
    return result;
  } catch (err) {
    console.error('Database query execution error:', err.message);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error('Error closing database connection:', closeErr.message);
      }
    }
  }
}

module.exports = {
  initializeDb,
  getPool,
  executeQuery
};
