require('dotenv').config();
const express = require('express');
const { indexArticle, searchArticles, checkMeiliConnection } = require('./search');
const { addNumbers, multiplyNumbers } = require('./dummyTools');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const { askAI } = require('./ai');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const app = express();
const jsonParser = express.json();

// Wrap express.json in try/catch to handle mis-parsed JSON
app.use((req, res, next) => {
  try {
    jsonParser(req, res, (err) => {
      if (err) {
        logger.error(`JSON parse error on ${req.method} ${req.originalUrl}: ${err.message}`);
        return next(err);
      }
      next();
    });
  } catch (err) {
    logger.error(`JSON parse exception on ${req.method} ${req.originalUrl}: ${err.message}`);
    next(err);
  }
});

// Log each incoming request after body parsing
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.get('/healthz', async (req, res) => {
  try {
    await checkMeiliConnection();
    res.json({ status: 'ok' });
  } catch (err) {
    logger.error(`Health check failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Bearer token authentication
app.use((req, res, next) => {
  const authHeader = req.headers && req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') {
    logger.error('Missing Authorization header');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.error('Malformed Authorization header');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = parts[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    logger.error(`JWT error: ${err.message}`);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/data', (req, res) => {
  res.json({ received: req.body });
});

app.post('/articles', async (req, res, next) => {
  try {
    const result = await indexArticle(req.body);
    res.json({ indexed: result });
  } catch (err) {
    next(err);
  }
});

app.get('/search', async (req, res, next) => {
  const query = typeof req.query.query === 'string' ? req.query.query : req.query.q;
  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'parameter query wajib diisi' });
  }
  try {
    const results = await searchArticles(query);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

app.post('/tools/call', async (req, res, next) => {
  const { tool_name, params } = req.body || {};
  if (typeof tool_name !== 'string' || typeof params !== 'object' || params === null || Array.isArray(params)) {
    return res.status(400).json({ error: 'tool_name harus string dan params harus objek' });
  }

  const map = {
    searchArticles: (p) => searchArticles(p.query ?? p),
    indexArticle: (p) => indexArticle(p.article ?? p),
    addNumbers,
    multiplyNumbers,
  };

  const fn = map[tool_name];
  if (!fn) {
    return res.status(404).json({ error: 'Tool tidak ditemukan' });
  }

  try {
    const result = await fn(params);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

app.get('/tools/list', (req, res) => {
  const filePath = path.join(__dirname, 'tools.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      // If file does not exist fallback to empty array
      if (err.code === 'ENOENT') {
        return res.json({ tools: [] });
      }
      return res.status(500).json({ error: 'Failed to read tools data' });
    }
    let tools;
    try {
      tools = JSON.parse(data);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse tools data' });
    }
    res.json({ tools });
  });
});

app.post('/ask', async (req, res) => {
  if (!req.body || typeof req.body.question !== 'string') {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  try {
    const result = await askAI(req.body.question);
    res.status(200).json(result);
  } catch (err) {
    logger.error(`askAI failed: ${err.message}`);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

// Error handling middleware for invalid JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

// Generic error handler to always return JSON
app.use((err, req, res, next) => {
  logger.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
