require('dotenv').config();
const jwt = require('jsonwebtoken');
const logger = require('./logger');

const { JWT_SECRET } = process.env;
if (!JWT_SECRET) {
  logger.error('JWT_SECRET not set in .env');
  process.exit(1);
}

const token = jwt.sign({ user: 'dev' }, JWT_SECRET, { expiresIn: '7d' });
console.log(`Bearer ${token}`);
