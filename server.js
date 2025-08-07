const logger = require('./logger');
const dotenv = require('dotenv');
const dotenvResult = dotenv.config();
if (dotenvResult.error) {
  logger.warn('⚠️  .env file not found, falling back to environment variables');
}
const express = require('express');
const rateLimit = require('express-rate-limit');
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

// Ensure we always use the Meili credentials from the environment
const MEILI_API_KEY = process.env.MEILI_API_KEY || process.env.API_KEY || 'magmeili';
const meiliClient = new MeiliSearch({
  host: process.env.MEILI_HOST,
  apiKey: MEILI_API_KEY,
});

// Debug log so we can verify the server is using the expected Meili instance
// Avoid printing the full API key to prevent leaking credentials
logger.info(`[ENV] MEILI_HOST: ${process.env.MEILI_HOST}`);
if (MEILI_API_KEY) {
  logger.info('[ENV] MEILI_API_KEY is set');
} else {
  logger.warn('[ENV] MEILI_API_KEY is missing or empty');
}
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

if (!process.env.API_KEY) {
  logger.warn('⚠️  API_KEY is not set; falling back to MEILI_API_KEY');
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
const publicEndpoints = ['/search', '/tools/list', '/kb/search', '/ask'];

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
// Ensure body parser is active before all routes
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

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
  // use process.uptime for clarity
  const uptimeMs = process.uptime() * 1000;
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
  // Normalise path to handle optional trailing slashes
  const normalizedPath = req.path.replace(/\/+$/, '') || '/';
  if (publicEndpoints.includes(normalizedPath)) {
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
    const body = req.body;
    if (typeof body !== 'object' || body === null) {
      return next(createError(400, 'Invalid article data'));
    }
    try {
      if (!(await isMeiliConnected())) {
        return next(createError(503, 'Meilisearch unavailable'));
      }
      const result = await indexArticle(body);
      sendSuccess(res, { indexed: result });
    } catch (err) {
      if (err.message && err.message.includes('Validasi')) {
        return next(createError(400, err.message));
      }
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

app.post('/admin/reload-tools', (req, res, next) => {
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
  let { username = 'user', role = 'user', expiresIn = 7 * 24 * 60 * 60 * 1000 } = req.body || {};
  if (typeof expiresIn === 'string') {
    if (/^\d+$/.test(expiresIn)) {
      expiresIn = parseInt(expiresIn, 10);
    } else {
      return next(createError(400, 'expiresIn must be integer milliseconds'));
    }
  }
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return next(createError(400, 'expiresIn must be integer milliseconds'));
  }
  const token = jwt.sign({ username, role }, JWT_SECRET, { expiresIn: Math.floor(expiresIn / 1000) });
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
  try {
    const question = req.body?.question;
    if (!question || typeof question !== 'string') {
      return next(createError(400, 'Invalid request body'));
    }

    const result = await askAI(question);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(createError(500, 'AI processing failed'));
  }
});

// Helper: parse limit
function parseLimitFromQuery(query, defaultLimit = 5, maxLimit = 50) {
  let m = query.match(/(?:top|list|daftar|show)\s*(\d+)/i);
  if (m && m[1]) return Math.max(1, Math.min(parseInt(m[1]), maxLimit));
  m = query.match(/^(\d+)\s*(slot|game|permainan)/i);
  if (m && m[1]) return Math.max(1, Math.min(parseInt(m[1]), maxLimit));
  return defaultLimit;
}

// Helper: parse provider
function parseProviderFromQuery(query) {
  const providers = ['pragmatic', 'pgsoft', 'microgaming', 'joker', 'habanero'];
  return providers.find(p => new RegExp(p, 'i').test(query));
}

// Helper: cleaning query
function cleanQueryForMeili(query) {
  return query
    .replace(/\b(top|list|daftar|show)\s*\d+\b/gi, '')
    .replace(/\b(slot|game|gacor|rtp|provider|pragmatic|pgsoft|microgaming|habanero|joker|malam|siang|pagi|hari|terbaik|tinggi|populer|paling)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// -------------------------
// HANDLER /kb/query SECTION
// -------------------------

app.post('/kb/query', async (req, res, next) => {
  const { query } = req.body || {};
  const cleaned = typeof query === 'string' ? query.trim() : '';
  logger.info('[KB/QUERY]', cleaned);

  if (cleaned.length < 3) {
    return next(createError(400, 'query minimal 3 karakter'));
  }
  try {
    if (!(await isMeiliConnected())) {
      return next(createError(503, 'Meilisearch unavailable'));
    }

    const limit = parseLimitFromQuery(cleaned, 5, 50);
    const provider = parseProviderFromQuery(cleaned);

    let queryForSearch = cleaned;
    if (provider) queryForSearch = queryForSearch.replace(new RegExp(provider, 'ig'), '');
    const limitMatch = cleaned.match(/(?:top|list|daftar|show)\s*\d+/i) || cleaned.match(/^(\d+)\s*(slot|game|permainan)/i);
    if (limitMatch) queryForSearch = queryForSearch.replace(limitMatch[0], '');
    queryForSearch = cleanQueryForMeili(queryForSearch);
    if (!queryForSearch && provider) queryForSearch = provider;
    if (!queryForSearch) queryForSearch = 'slot';

    const searchLimit = Math.max(100, limit * 4);
    const index = meiliClient.index('knowledgebase');
    const result = await index.search(queryForSearch, { limit: searchLimit });

    let hits = Array.isArray(result.hits) ? result.hits : [];
    logger.info(`[MeiliSearch] result: ${hits.length} hits. Keyword: "${queryForSearch}"`);

    // *** STRICT PROVIDER FILTER (paling penting) ***
    if (provider) {
      const provNorm = provider.toLowerCase();
      hits = hits.filter(x => (x.provider || '').toLowerCase().trim() === provNorm);
      logger.info(`[After provider filter "${provNorm}"]: ${hits.length} hits`);
      logger.info('Provider(s) after filter:', [...new Set(hits.map(x => x.provider))]);
    }

    // FILTER lain
    if (/gacor/i.test(cleaned)) {
      const before = hits.length;
      hits = hits.filter(x => x.rtp && x.rtp >= 85);
      logger.info(`[Filter RTP >= 85 ('gacor')]: ${before} -> ${hits.length} hits`);
    }
    if (/top/i.test(cleaned)) {
      hits = hits.sort((a, b) => (b.rtp || 0) - (a.rtp || 0));
    }
    hits = hits.filter(x => x && x.id && x.provider && typeof x.rtp === 'number');

    // LIMIT HARUS TERAKHIR
    sendSuccess(res, hits.slice(0, limit));
  } catch (err) {
    logger.error('[MEILI ERROR]', err);
    logger.error('kb query failed:', err.message);
    next(createError(err.status || 500, err.message || 'Meilisearch query failed'));
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

  child.on('error', (err) => {
    logger.error(`plug-kb spawn error: ${err.message}`);
    res.status(500).end(`Process error: ${err.message}`);
  });

  child.on('close', (code) => {
    res.end(`\nProcess exited with code ${code}`);
  });
});

app.get('/routes', (req, res) => {
  res.json({ routes: listEndpoints(app) });
});

app.get('/metrics', async (req, res, next) => {
  try {
    res.set('Content-Type', metricsRegister.contentType);
    res.end(await metricsRegister.metrics());
  } catch (err) {
    logger.error(`metrics failed: ${err.message}`);
    next(createError(500, 'Failed to collect metrics'));
  }
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

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`MCP Server started on port ${PORT}`);
      const routes = listEndpoints(app);
      logger.info('Available endpoints:');
      routes.forEach((r) => logger.info(`${r.method} ${r.path}`));
    });
  })();
}

module.exports = app;