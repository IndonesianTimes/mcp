const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/** Cache for loaded mappings */
const mappingCache = new Map();

/**
 * Load a knowledge base from a mapping file. The mapping JSON must contain
 * `files` arrays at any depth listing JSON files. The function reads each file
 * only once and returns a lookup object `{ filename: dataArray }`.
 *
 * @param {string} mappingPath absolute or relative path to mapping.json
 * @returns {Promise<Object<string, any[]>>}
 */
async function loadKBFromMapping(mappingPath) {
  if (mappingCache.has(mappingPath)) {
    return mappingCache.get(mappingPath);
  }

  const baseDir = path.dirname(mappingPath);
  let mappingData;
  try {
    const raw = await fs.promises.readFile(mappingPath, 'utf8');
    mappingData = JSON.parse(raw);
  } catch (err) {
    logger.error(`Failed to read mapping: ${err.message}`);
    if (err.code === 'ENOENT') {
      throw new Error(`mapping file not found: ${mappingPath}`);
    }
    throw err;
  }

  const files = [];
  (function collect(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) collect(item);
      return;
    }
    if (Array.isArray(node.files)) {
      for (const f of node.files) {
        files.push(String(f));
      }
    }
    for (const value of Object.values(node)) {
      collect(value);
    }
  })(mappingData);

  const lookup = {};
  for (const rel of files) {
    const filePath = path.resolve(baseDir, rel);
    let content;
    try {
      content = await fs.promises.readFile(filePath, 'utf8');
    } catch (err) {
      logger.error(`Failed to read KB file ${filePath}: ${err.message}`);
      if (err.code === 'ENOENT') {
        throw new Error(`file not found: ${filePath}`);
      }
      throw err;
    }
    lookup[path.basename(rel)] = JSON.parse(content);
  }

  mappingCache.set(mappingPath, lookup);
  return lookup;
}

/**
 * Cari hasil knowledge base berdasarkan query menggunakan mapping glossary.
 * Mapping dibaca dari path pada env `KB_MAPPING_PATH` atau default `test_data/kb_search_mapping.json`.
 *
 * @param {string} query kata kunci yang akan dicari
 * @returns {Promise<any[]>} array gabungan isi file yang cocok
 */
async function findKBResults(query) {
  if (typeof query !== 'string') {
    throw new TypeError('query must be a string');
  }
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const mappingPath = process.env.KB_MAPPING_PATH ||
    path.join(__dirname, 'test_data', 'kb_search_mapping.json');

  let mappingData;
  try {
    const raw = await fs.promises.readFile(mappingPath, 'utf8');
    mappingData = JSON.parse(raw);
  } catch (err) {
    logger.error(`Failed to read mapping: ${err.message}`);
    if (err.code === 'ENOENT') {
      throw new Error(`mapping file not found: ${mappingPath}`);
    }
    throw err;
  }

  const matchedFiles = new Set();
  (function traverse(node) {
    if (!node || typeof node !== 'object') return;
    const glossary = Array.isArray(node.glossary)
      ? node.glossary.map((g) => String(g).toLowerCase())
      : [];
    if (glossary.some((g) => words.includes(g))) {
      if (Array.isArray(node.files)) {
        for (const f of node.files) {
          matchedFiles.add(String(f));
        }
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'files' || key === 'glossary') continue;
      traverse(node[key]);
    }
  })(mappingData);

  if (matchedFiles.size === 0) {
    return [];
  }

  const baseDir = path.dirname(mappingPath);
  const results = [];
  for (const rel of matchedFiles) {
    const filePath = path.resolve(baseDir, rel);
    let content;
    try {
      content = await fs.promises.readFile(filePath, 'utf8');
    } catch (err) {
      logger.error(`Failed to read KB file ${filePath}: ${err.message}`);
      if (err.code === 'ENOENT') {
        throw new Error(`file not found: ${filePath}`);
      }
      throw err;
    }
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      results.push(...data);
    }
  }

  return results;
}

/**
 * Helper tool untuk menanyakan knowledge base. Param `params` dapat berupa
 * string query langsung atau objek dengan properti `query`.
 *
 * @param {string|{query:string}} params input query
 * @returns {Promise<any[]>}
 */
async function queryKnowledgeBase(params) {
  const query =
    typeof params === 'object' && params !== null ? params.query : params;
  if (typeof query !== 'string') {
    throw new Error('query harus string');
  }
  const results = await findKBResults(query);
  return results.slice(0, 10);
}

module.exports = { loadKBFromMapping, findKBResults, queryKnowledgeBase };
