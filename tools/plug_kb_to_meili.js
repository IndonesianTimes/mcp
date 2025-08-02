require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MeiliSearch } = require('meilisearch');
const logger = require('../logger');

async function main() {
  const kbPath = path.join(__dirname, '..', 'knowledgebase_meili.json');
  let docs;
  try {
    docs = JSON.parse(await fs.promises.readFile(kbPath, 'utf8'));
  } catch (err) {
    logger.error('❌ Failed to read/parse KB JSON:', err.message);
    process.exit(1);
  }
  if (!Array.isArray(docs) || docs.length === 0) {
    logger.error('❌ KB JSON invalid or empty');
    process.exit(1);
  }
  docs = docs.map(d => ({ ...d, id: String(d.id) }));
  logger.info(`Total documents: ${docs.length}`, { timestamp: new Date().toISOString() });

  const meiliHost = process.env.MEILI_HOST || 'http://127.0.0.1:7700';
  const meiliApiKey = process.env.MEILI_API_KEY || process.env.API_KEY || '';
  const client = new MeiliSearch({ host: meiliHost, apiKey: meiliApiKey });

  try {
    await client.health();
  } catch (err) {
    logger.error('❌ Meili not reachable:', err.message);
    logger.warn('⚠️  Skipping indexing because Meili offline');
    return;
  }

  let index;
  try {
    index = await client.getIndex('knowledgebase');
  } catch {
    logger.warn('Index not found, creating...');
    // Patch: selalu set primaryKey di Meili v1.6+
    index = await client.createIndex('knowledgebase', { primaryKey: 'id' });
  }

  if (typeof index.updateSettings === 'function') {
    try {
      await index.updateSettings({
        searchableAttributes: ['name', 'tags', 'pola_main', 'jam_gacor'],
        filterableAttributes: ['provider', 'category', 'status'],
      });
    } catch (err) {
      logger.warn('⚠️ updateSettings failed:', err.message);
    }
  }

  if (typeof index.addDocuments !== 'function') {
    logger.error('❌ addDocuments is not supported by this Meili index');
    process.exit(1);
  }

  try {
    const result = await index.addDocuments(docs);
    logger.info('addDocuments() result:', JSON.stringify(result));
    logger.info(`✅ Indexed ${docs.length} docs in 'knowledgebase'. No task polling (fire-and-forget, SDK legacy compatibility).`);
  } catch (err) {
    logger.error('❌ Failed to index KB docs:', err.message);
    logger.error('Detail:', JSON.stringify(err.detail || err, null, 2));
    logger.error('Stack:', err.stack);
    logger.error('Raw error object:', err);
  }
}

main();
