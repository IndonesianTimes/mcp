const logger = require('./logger');
const dotenv = require('dotenv');
const dotenvResult = dotenv.config();
if (dotenvResult.error) {
  logger.warn('⚠️  .env file not found, falling back to environment variables');
}
const express = require('express');
const {
  indexArticle,
  searchArticles,
  checkMeiliConnection,
  isMeiliConnected,
} = require('./search');
const { queryKnowledgeBase, findKBResults } = require('./kb');
const toolCaller = require('./tools/call');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { askAI } = require('./ai');
const { spawn } = require('child_process');
const { MeiliSearch } = require('meilisearch');
const clientMetrics = require('prom-client');

const metricsRegister = new clientMetrics.Registry();
clientMetrics.collectDefaultMetrics({ register: metricsRegister });
const httpCounter = new clientMetrics.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});
metricsRegister.registerMetric(httpCounter);

const requiredEnv = [
  'APP_MODE',
  'PORT',
  'MEILI_HOST',
  'MEILI_API_KEY',
  'JWT_SECRET',
];
if ((process.env.LLM_BACKEND || 'local') === 'openai') {
  requiredEnv.push('OPENAI_API_KEY');
}
const missingEnv = requiredEnv.filter((v) => !process.env[v]);
if (missingEnv.length) {
  logger.error(`Missing environment variables: ${missingEnv.join(', ')}`);
  logger.error('Please create a .env file based on .env.example');
  process.exit(1);
}

if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim() || process.env.JWT_SECRET === 'your-jwt-secret') {
  if (process.env.APP_MODE === 'production') {
    logger.error('JWT_SECRET must be set to a custom value in production');
    process.exit(1);
  }
  logger.warn('⚠️  JWT_SECRET is empty or using default value');
}

function sendSuccess(res, data) {
  res.json({ success: true, data, error: null });
}

function createError(code, message) {
  const err = new Error(message);
  err.status = code;
  return err;
}

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in the .env file');
}
const JWT_SECRET = process.env.JWT_SECRET;
const publicEndpoints = ['/search', '/tools/list', '/kb/search'];

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.stack || err.message}`);
  process.exit(1);
});

function listEndpoints(app) {
  const routes = [];
  const router = app._router || app.router;
  const stack = router && router.stack;
  if (!stack) return routes;
  stack.forEach((m) => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods).map((k) => k.toUpperCase());
      methods.forEach((method) => routes.push({ method, path: m.route.path }));
    } else if (m.name === 'router' && m.handle && m.handle.stack) {
      m.handle.stack.forEach((h) => {
        if (h.route) {
          const methods = Object.keys(h.route.methods).map((k) => k.toUpperCase());
          methods.forEach((method) => routes.push({ method, path: h.route.path }));
        }
      });
    }
  });
  return routes;
}

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
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    httpCounter.inc({ method: req.method, route, status: res.statusCode });
  });
  next();
});

// Serve static files from the public directory
app.use(express.static('public'));

app.get('/healthz', async (req, res) => {
  const meili = await isMeiliConnected();
  const status = meili ? 'ok' : 'degraded';
  sendSuccess(res, { status, meilisearch: meili ? 'connected' : 'disconnected' });
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
  const data = {
    server: 'ok',
    meilisearch: meili,
    llm,
    uptime: formatUptime(uptimeMs),
  };
  if ((req.headers.accept || '').includes('text/html')) {
    res.send(`<!DOCTYPE html><html><body><h1>MCP Status</h1><ul><li>Server: ${data.server}</li><li>Meilisearch: ${data.meilisearch}</li><li>LLM: ${data.llm}</li><li>Uptime: ${data.uptime}</li></ul></body></html>`);
  } else {
    sendSuccess(res, data);
  }
});

// Bearer token authentication
function authenticateToken(req, res, next) {
  if (publicEndpoints.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers && req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') {
    logger.error('Missing Authorization header');
    return next(createError(401, 'Unauthorized'));
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.error('Malformed Authorization header');
    return next(createError(401, 'Unauthorized'));
  }
  const token = parts[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    logger.error(`JWT error: ${err.message}`);
    next(createError(401, 'Invalid token'));
  }
}

app.use(authenticateToken);

app.post('/data', (req, res) => {
  sendSuccess(res, { received: req.body });
});

  app.post('/articles', async (req, res, next) => {
    try {
      if (!(await isMeiliConnected())) {
        return next(createError(503, 'Meilisearch unavailable'));
      }
      const result = await indexArticle(req.body);
      sendSuccess(res, { indexed: result });
    } catch (err) {
      logger.error(`indexArticle failed: ${err.message}`);
      next(err);
    }
  });

  app.get('/search', async (req, res, next) => {
    const { query } = req.query;
    if (typeof query !== 'string' || !query.trim()) {
      return next(createError(400, 'parameter query wajib diisi'));
    }
    try {
      if (!(await isMeiliConnected())) {
        return next(createError(503, 'Meilisearch unavailable'));
      }
      const results = await searchArticles(query);
      sendSuccess(res, results);
    } catch (err) {
      logger.error(`searchArticles failed: ${err.message}`);
      next(err);
    }
  });

  app.get('/kb/search', async (req, res, next) => {
    const { query } = req.query;
    if (typeof query !== 'string' || !query.trim()) {
      return next(createError(400, 'parameter query wajib diisi'));
    }
    try {
      const results = await findKBResults(query);
      sendSuccess(res, results);
    } catch (err) {
      logger.error(`kb search failed: ${err.message}`);
      next(err);
    }
  });

app.post('/tools/call', async (req, res, next) => {
  const { tool_name, params } = req.body || {};
  if (typeof tool_name !== 'string' || typeof params !== 'object' || params === null || Array.isArray(params)) {
    return next(createError(400, 'tool_name harus string dan params harus objek'));
  }

  try {
    const result = await toolCaller.callTool(tool_name, params, { timeout: 15000, maxOutputLength: 10000 });
    sendSuccess(res, result);
  } catch (err) {
    if (err.message.includes('Tool tidak ditemukan')) {
      return next(createError(404, err.message));
    }
    logger.error(`tool call failed: ${err.message}`);
    next(err);
  }
});

app.post('/tools/reload', (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(createError(403, 'Forbidden'));
  }
  toolCaller.loadTools();
  sendSuccess(res, { reloaded: true });
});

app.post('/admin/generate-token', (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(createError(403, 'Forbidden'));
  }
  const { username = 'user', role = 'user', expiresIn = '7d' } = req.body || {};
  const token = jwt.sign({ username, role }, JWT_SECRET, { expiresIn });
  sendSuccess(res, { token });
});

app.get('/tools/list', async (req, res) => {
  try {
    const list = toolCaller.getDetailedToolList();
    res.json({ tools: list });
  } catch (err) {
    logger.error(`Failed to list tools: ${err.message}`);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

app.post('/ask', async (req, res, next) => {
  if (!req.body || typeof req.body.question !== 'string' || !req.body.question.trim()) {
    return next(createError(400, 'Invalid request body'));
  }
  try {
    const result = await askAI(req.body.question);
    sendSuccess(res, result);
  } catch (err) {
    logger.error(`askAI failed: ${err.message}`);
    next(createError(500, 'AI processing failed'));
  }
});

  app.post('/kb/query', async (req, res, next) => {
  const { query } = req.body || {};
  if (typeof query !== 'string' || query.trim().length < 3) {
    return next(createError(400, 'query minimal 3 karakter'));
  }
    try {
      const results = await findKBResults(query);
      sendSuccess(res, results);
    } catch (err) {
      logger.error(`kb query failed: ${err.message}`);
      next(err);
    }
  });

app.post('/tools/plug-kb', (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(createError(403, 'Forbidden'));
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

app.get('/routes', (req, res) => {
  res.json({ routes: listEndpoints(app) });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// Centralized error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    err.status = 400;
    err.message = 'Invalid JSON';
  }
  logger.error(err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json({ success: false, data: null, error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  (async () => {
    try {
      await checkMeiliConnection();
      logger.info('Connected to Meilisearch');
    } catch (err) {
      logger.warn(`Starting without Meilisearch: ${err.message}`);
    }

    try {
      const client = new MeiliSearch({
        host: process.env.MEILI_HOST,
        apiKey: process.env.API_KEY || process.env.MEILI_API_KEY,
      });
      await client.getIndex('knowledgebase');
    } catch (err) {
      logger.warn('⚠️  Meili index "knowledgebase" not found. Run "npm run plug-kb" to create it.');
    }

    app.listen(PORT, () => {
      logger.info(`MCP Server started on port ${PORT}`);
      const routes = listEndpoints(app);
      logger.info('Available endpoints:');
      routes.forEach((r) => logger.info(`${r.method} ${r.path}`));
    });
  })();
}

module.exports = app;
