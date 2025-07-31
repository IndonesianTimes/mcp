const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Express middleware to validate JWT from Authorization header.
 * On success attaches decoded payload to req.user.
 * Responds 401 if header missing/malformed, 403 if token invalid.
 */
function validateToken(req, res, next) {
  const authHeader = req.headers && req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({ success: false, data: null, error: 'Missing Authorization header' });
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ success: false, data: null, error: 'Malformed Authorization header' });
  }
  const token = parts[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, data: null, error: 'Server misconfigured' });
  }
  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ success: false, data: null, error: 'Invalid token' });
  }
}

module.exports = validateToken;
