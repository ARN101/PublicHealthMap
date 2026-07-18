const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'publichealthmap-lab-jwt-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function comparePassword(plain, hash) {
  if (!hash) return false;
  // Support legacy plain-text demo hashes during migration
  if (!hash.startsWith('$2')) {
    return plain === hash;
  }
  return bcrypt.compare(plain, hash);
}

function extractBearer(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

function requireAuth(role) {
  return (req, res, next) => {
    try {
      const token = extractBearer(req);
      if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
      }
      const decoded = verifyToken(token);
      if (role && decoded.role !== role) {
        return res.status(403).json({ success: false, error: `Access denied. ${role} role required.` });
      }
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
    }
  };
}

module.exports = {
  signToken,
  verifyToken,
  hashPassword,
  comparePassword,
  requireAuth
};
