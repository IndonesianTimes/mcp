process.env.APP_MODE = 'test';
process.env.PORT = '3000';
process.env.MEILI_HOST = 'http://localhost:7700';
process.env.MEILI_API_KEY = 'masterKey';
process.env.JWT_SECRET = 'secret';
process.env.LLM_BACKEND = 'local';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const app = require('../server');

const token = jwt.sign({ userId: 1 }, 'secret');
process.env.KB_MAPPING_PATH = path.join(__dirname, '..', 'test_data', 'kb_search_mapping.json');

describe('API endpoints', () => {
  test('/tools/list returns valid JSON', async () => {
    const res = await request(app)
      .get('/tools/list');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tools)).toBe(true);
    expect(res.body.tools.length).toBeGreaterThan(0);
    expect(res.body.tools[0]).toHaveProperty('tool_name');
  });

  test('/articles rejects empty id', async () => {
    const res = await request(app)
      .post('/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: '',
        title: 'Test',
        content: 'Some content here',
        tags: ['a'],
        category: 'cat',
        createdAt: new Date().toISOString(),
        author: 'me'
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('error');
  });

  test('/tools/call with valid body works', async () => {
    const res = await request(app)
      .post('/tools/call')
      .set('Authorization', `Bearer ${token}`)
      .send({ tool_name: 'addNumbers', params: { a: 2, b: 3 } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBe(5);
  });

  test('/tools/call with invalid JSON returns error', async () => {
    const res = await request(app)
      .post('/tools/call')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send('{"tool_name": "addNumbers", "params": {a:1, b:2}');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('error');
  });

  test('/tools/list ignores corrupted file', async () => {
    const fs = require('fs');
    const path = require('path');
    const file = path.join(__dirname, '..', 'tools.json');
    const original = fs.readFileSync(file, 'utf8');
    try {
      fs.writeFileSync(file, 'not [json]', 'utf8');
      const res = await request(app)
        .get('/tools/list');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tools)).toBe(true);
    } finally {
      fs.writeFileSync(file, original, 'utf8');
    }
  });

  test('/search returns service unavailable when Meili down', async () => {
    const res = await request(app)
      .get('/search')
      .query({ query: 'random' });
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });

  test('/ask rejects empty question', async () => {
    const res = await request(app)
      .post('/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('error');
  });

  test('/kb/query returns results', async () => {
    const res = await request(app)
      .post('/kb/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'alpha' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('/kb/query validates minimal length', async () => {
    const res = await request(app)
      .post('/kb/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'ab' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('error');
  });

  test('/tools/plug-kb rejects non-admin', async () => {
    const res = await request(app)
      .post('/tools/plug-kb')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('/tools/plug-kb works for admin', async () => {
    const adminToken = jwt.sign({ userId: 2, role: 'admin' }, 'secret');
    const res = await request(app)
      .post('/tools/plug-kb')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Process exited/);
  });

  test('/admin/generate-token returns token', async () => {
    const adminToken = jwt.sign({ userId: 2, role: 'admin' }, 'secret');
    const res = await request(app)
      .post('/admin/generate-token')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'u', role: 'user' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
  });

  test('/admin/reload-tools works for admin', async () => {
    const adminToken = jwt.sign({ userId: 2, role: 'admin' }, 'secret');
    const res = await request(app)
      .post('/admin/reload-tools')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.reloaded).toBe(true);
  });

  test('/metrics returns text', async () => {
    const res = await request(app)
      .get('/metrics')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.text).toBe('string');
  });

  test('/healthz returns JSON', async () => {
    const res = await request(app).get('/healthz');
    expect(typeof res.body).toBe('object');
  });

  test('/status returns JSON', async () => {
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('server');
    expect(res.body.data).toHaveProperty('meilisearch');
    expect(res.body.data).toHaveProperty('llm');
    expect(res.body.data).toHaveProperty('uptime');
  });

  test('/routes lists endpoints', async () => {
    const res = await request(app)
      .get('/routes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.routes)).toBe(true);
    const paths = res.body.routes.map((r) => r.path);
    expect(paths).toContain('/status');
    expect(paths).toContain('/kb/search');
  });
});
