const path = require('path');
const { loadKBFromMapping, findKBResults } = require('../kb');

describe('loadKBFromMapping', () => {
  const base = path.join(__dirname, '..', 'test_data');

  test('loads all files and caches result', async () => {
    const mapping = path.join(base, 'kb_mapping.json');
    const data1 = await loadKBFromMapping(mapping);
    expect(data1).toHaveProperty(['kb1.json']);
    expect(data1['kb1.json'][0].id).toBe(1);
    expect(data1).toHaveProperty(['kb2.json']);
    expect(data1).toHaveProperty(['kb3.json']);

    // call again to ensure caching returns same object
    const data2 = await loadKBFromMapping(mapping);
    expect(data2).toBe(data1);
  });

  test('throws when referenced file missing', async () => {
    const mapping = path.join(base, 'kb_mapping_missing.json');
    await expect(loadKBFromMapping(mapping)).rejects.toThrow(/file not found/);
  });
});

describe('findKBResults', () => {
  const base = path.join(__dirname, '..', 'test_data');

  beforeAll(() => {
    process.env.KB_MAPPING_PATH = path.join(base, 'kb_search_mapping.json');
  });

  test('returns combined results for matching glossary', async () => {
    const results = await findKBResults('alpha gamma');
    const ids = results.map((r) => r.id).sort();
    expect(ids).toEqual([1, 3]);
  });

  test('returns empty array when no match', async () => {
    const results = await findKBResults('unknown');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });
});
