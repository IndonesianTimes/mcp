require('dotenv').config();
const express = require('express');
const {
  indexArticle,
  searchArticles,
  checkMeiliConnection,
  isMeiliConnected,
} = require('./search');
const { addNumbers, multiplyNumbers } = require('./dummyTools');
const { queryKnowledgeBase, findKBResults } = require('./kb');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const { askAI } = require('./ai');
const { spawn } = require('child_process');

const requiredEnv = [
  'APP_MODE',
  'PORT',
  'MEILI_HOST',
  'MEILI_API_KEY',
  'OPENAI_API_KEY',
  'JWT_SECRET',
];
const missingEnv = requiredEnv.filter((v) => !process.env[v]);
if (missingEnv.length) {
  logger.error(`Missing environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

function sendSuccess(res, data) {
  res.json({ success: true, data, error: null });
}

function sendError(res, code, message) {
  res.status(code).json({ success: false, data: null, error: message });
}

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const publicEndpoints = ['/search', '/tools/list'];

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

// Serve static files from the public directory
app.use(express.static('public'));

app.get('/healthz', async (req, res) => {
  try {
    await checkMeiliConnection();
    sendSuccess(res, { status: 'ok' });
  } catch (err) {
    logger.error(`Health check failed: ${err.message}`);
    sendError(res, 500, err.message);
  }
});

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

app.get('/status', async (req, res) => {
  const meili = (await isMeiliConnected()) ? 'connected' : 'disconnected';
  const llm = process.env.LLM_BACKEND === 'openai' ? 'openai' : 'local';
  const uptimeMs = Date.now() - (Date.now() - process.uptime() * 1000);
  sendSuccess(res, {
    server: 'ok',
    meilisearch: meili,
    llm,
    uptime: formatUptime(uptimeMs),
  });
});

// Bearer token authentication
function authenticateToken(req, res, next) {
  if (publicEndpoints.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers && req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') {
    logger.error('Missing Authorization header');
    return sendError(res, 401, 'Unauthorized');
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.error('Malformed Authorization header');
    return sendError(res, 401, 'Unauthorized');
  }
  const token = parts[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    logger.error(`JWT error: ${err.message}`);
    sendError(res, 401, 'Invalid token');
  }
}

app.use(authenticateToken);

app.post('/data', (req, res) => {
  sendSuccess(res, { received: req.body });
});

app.post('/articles', async (req, res, next) => {
  try {
    const result = await indexArticle(req.body);
    sendSuccess(res, { indexed: result });
  } catch (err) {
    next(err);
  }
});

app.get('/search', async (req, res, next) => {
  const { query } = req.query;
  if (typeof query !== 'string' || !query.trim()) {
    return sendError(res, 400, 'parameter query wajib diisi');
  }
  try {
    const results = await searchArticles(query);
    sendSuccess(res, results);
  } catch (err) {
    next(err);
  }
});

app.post('/tools/call', async (req, res, next) => {
  const { tool_name, params } = req.body || {};
  if (typeof tool_name !== 'string' || typeof params !== 'object' || params === null || Array.isArray(params)) {
    return sendError(res, 400, 'tool_name harus string dan params harus objek');
  }

  const map = {
    searchArticles: (p) => searchArticles(p.query ?? p),
    indexArticle: (p) => indexArticle(p.article ?? p),
    addNumbers,
    multiplyNumbers,
    queryKnowledgeBase: (p) => queryKnowledgeBase(p.query ?? p),
  };

  const fn = map[tool_name];
  if (!fn) {
    return sendError(res, 404, 'Tool tidak ditemukan');
  }

  try {
    const result = await fn(params);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

app.get('/tools/list', async (req, res) => {
  const filePath = path.join(__dirname, 'tools.json');
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    const tools = JSON.parse(data);
    if (!Array.isArray(tools)) {
      throw new Error('tools data is not an array');
    }
    sendSuccess(res, tools);
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.error(`tools.json not found: ${err.message}`);
      return sendError(res, 500, 'Failed to read tools data');
    }
    if (err instanceof SyntaxError || err.message.includes('tools data is not an array')) {
      logger.error(`Invalid tools.json: ${err.message}`);
      return sendError(res, 500, 'Failed to parse tools data');
    }
    logger.error(`Failed to read tools.json: ${err.message}`);
    sendError(res, 500, 'Failed to read tools data');
  }
});

app.post('/ask', async (req, res) => {
  if (!req.body || typeof req.body.question !== 'string' || !req.body.question.trim()) {
    return sendError(res, 400, 'Invalid request body');
  }
  try {
    const result = await askAI(req.body.question);
    sendSuccess(res, result);
  } catch (err) {
    logger.error(`askAI failed: ${err.message}`);
    sendError(res, 500, 'AI processing failed');
  }
});

app.post('/kb/query', async (req, res, next) => {
  const { query } = req.body || {};
  if (typeof query !== 'string' || query.trim().length < 3) {
    return sendError(res, 400, 'query minimal 3 karakter');
  }
  try {
    const results = await findKBResults(query);
    sendSuccess(res, results);
  } catch (err) {
    next(err);
  }
});

app.post('/tools/plug-kb', (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return sendError(res, 403, 'Forbidden');
  }

  const script = path.join(__dirname, 'tools', 'plug_kb_to_meili.js');
  const child = spawn('node', [script]);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  child.stdout.on('data', (data) => {
    res.write(data);
  });

  child.stderr.on('data', (data) => {
    res.write(data);
  });

  child.on('close', (code) => {
    res.end(`\nProcess exited with code ${code}`);
  });
});

// Error handling middleware for invalid JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return sendError(res, 400, 'Invalid JSON');
  }
  next(err);
});

// Generic error handler to always return JSON
app.use((err, req, res, next) => {
  logger.error(err);
  const status = err.status || 500;
  sendError(res, status, err.message || 'Internal Server Error');
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`MCP Server started on port ${PORT}`);
  });
}

module.exports = app;
