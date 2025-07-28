const request = require('supertest');
const app = require('../server');

describe('API endpoints', () => {
  test('/tools/list returns valid JSON', async () => {
    const res = await request(app).get('/tools/list');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tools)).toBe(true);
  });

  test('/tools/call with valid body works', async () => {
    const res = await request(app)
      .post('/tools/call')
      .send({ tool_name: 'addNumbers', params: { a: 2, b: 3 } });
    expect(res.status).toBe(200);
    expect(res.body.result).toBe(5);
  });

  test('/tools/call with invalid JSON returns error', async () => {
    const res = await request(app)
      .post('/tools/call')
      .set('Content-Type', 'application/json')
      .send('{"tool_name": "addNumbers", "params": {a:1, b:2}');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('/search returns JSON', async () => {
    const res = await request(app).get('/search').query({ query: 'random' });
    expect(typeof res.body).toBe('object');
  });
});
