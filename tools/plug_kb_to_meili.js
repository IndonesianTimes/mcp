require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MeiliSearch } = require('meilisearch');
const logger = require('../logger');

async function main() {
  const filePath = path.join(__dirname, '..', 'knowledgebase_meili.json');
  let raw;
  try {
    raw = await fs.promises.readFile(filePath, 'utf8');
  } catch (err) {
    logger.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let docs;
  try {
    docs = JSON.parse(raw);
  } catch (err) {
    logger.error(`Failed to parse JSON: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(docs) || docs.length === 0) {
    logger.error('knowledgebase_meili.json is empty or invalid');
    process.exit(1);
  }

  console.log(`Total documents: ${docs.length}`);

  const client = new MeiliSearch({
    host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
    apiKey: process.env.API_KEY || process.env.MEILI_API_KEY || '',
  });

  let index = await client
    .getIndex('knowledgebase')
    .catch(() => client.createIndex('knowledgebase', { primaryKey: 'id' }));

  await index.updateSettings({
    searchableAttributes: ['name', 'tags', 'pola_main', 'jam_gacor'],
    filterableAttributes: ['provider', 'category', 'status'],
  });

  try {
    const enqueued = await index.addDocuments(docs);
    const task = await client.waitForTask(enqueued.taskUid);
    console.log(`Status: ${task.status}; taskUid: ${enqueued.taskUid}`);
  } catch (err) {
    logger.error(`Failed to index documents: ${err.message}`);
    process.exit(1);
  }
}

main();
