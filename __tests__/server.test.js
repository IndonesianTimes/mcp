const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');

const token = jwt.sign({ userId: 1 }, 'secret');

describe('API endpoints', () => {
  test('/tools/list returns valid JSON', async () => {
    const res = await request(app)
      .get('/tools/list')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tools)).toBe(true);
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
    expect(res.body).toHaveProperty('error');
  });

  test('/tools/call with valid body works', async () => {
    const res = await request(app)
      .post('/tools/call')
      .set('Authorization', `Bearer ${token}`)
      .send({ tool_name: 'addNumbers', params: { a: 2, b: 3 } });
    expect(res.status).toBe(200);
    expect(res.body.result).toBe(5);
  });

  test('/tools/call with invalid JSON returns error', async () => {
    const res = await request(app)
      .post('/tools/call')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send('{"tool_name": "addNumbers", "params": {a:1, b:2}');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('/tools/list handles corrupted file', async () => {
    const fs = require('fs');
    const path = require('path');
    const file = path.join(__dirname, '..', 'tools.json');
    const original = fs.readFileSync(file, 'utf8');
    try {
      fs.writeFileSync(file, 'not [json]', 'utf8');
      const res = await request(app)
        .get('/tools/list')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    } finally {
      fs.writeFileSync(file, original, 'utf8');
    }
  });

  test('/search returns JSON', async () => {
    const res = await request(app)
      .get('/search')
      .set('Authorization', `Bearer ${token}`)
      .query({ query: 'random' });
    expect(typeof res.body).toBe('object');
  });

  test('/ask rejects empty question', async () => {
    const res = await request(app)
      .post('/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('/healthz returns JSON', async () => {
    const res = await request(app).get('/healthz');
    expect(typeof res.body).toBe('object');
  });
});
