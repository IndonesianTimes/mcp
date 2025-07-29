const fs = require('fs');
const path = require('path');

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

module.exports = { loadKBFromMapping };
