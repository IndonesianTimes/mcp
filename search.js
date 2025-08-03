const { MeiliSearch } = require('meilisearch');
const { validateArticle } = require('./validation');
const logger = require('./logger');

if (!process.env.API_KEY) {
  logger.warn('⚠️  API_KEY is not set; falling back to MEILI_API_KEY');
}

const client = new MeiliSearch({
  host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
  apiKey: process.env.API_KEY || process.env.MEILI_API_KEY || '',
});

let knowledgeIndex;

/**
 * Retrieve the knowledgebase index, creating it if necessary. The result is
 * cached only on success so that a failed connection does not permanently
 * poison future calls.
 */
async function getKnowledgeIndex() {
  if (knowledgeIndex) {
    return knowledgeIndex;
  }

  try {
    knowledgeIndex = await client.getIndex('knowledgebase');
  } catch (err) {
    try {
      knowledgeIndex = await client.createIndex('knowledgebase', { primaryKey: 'id' });
    } catch (createErr) {
      logger.error(`Failed to init Meilisearch index: ${createErr.message}`);
      knowledgeIndex = undefined;
      throw createErr;
    }
  }

  try {
    await knowledgeIndex.updateSettings({
      searchableAttributes: ['title', 'content', 'tags', 'category', 'author'],
      filterableAttributes: ['tags', 'category', 'author', 'createdAt'],
    });
  } catch (settingsErr) {
    logger.warn(`Failed to update Meilisearch settings: ${settingsErr.message}`);
  }

  return knowledgeIndex;
}

/**
 * Memvalidasi input, memparse tags jadi array, dan mengirimkannya ke mesin pencarian.
 * @param {any} data
 */
async function indexArticle(data) {
  let article;
  try {
    article = validateArticle(data);
  } catch (err) {
    logger.error(`Validasi artikel gagal: ${err.message}`);
    throw new Error(`Validasi gagal: ${err.message}`);
  }

  // Pastikan createdAt berupa ISO string
  try {
    article.createdAt = new Date(article.createdAt).toISOString();
  } catch (err) {
    logger.error(`createdAt parse error: ${err.message}`);
    throw new Error('createdAt tidak dapat diparse sebagai tanggal');
  }

  const index = await getKnowledgeIndex();
  try {
    return await index.addDocuments([article]);
  } catch (err) {
    if (err && err.errorCode === 'index_not_found') {
      knowledgeIndex = undefined;
    }
    logger.error(`Gagal mengirim ke mesin pencarian: ${err.message}`);
    throw new Error(`Gagal mengirim ke mesin pencarian: ${err.message}`);
  }
}

/**
 * Mencari artikel berdasarkan query.
 * @param {string} query
 * @returns {Promise<{id: string|number, title: string, snippet: string}[]>}
 */
async function searchArticles(query) {
  if (typeof query !== 'string') {
    throw new Error('query harus string');
  }
  const cleaned = query.trim();
  if (!cleaned) {
    return [];
  }

  const index = await getKnowledgeIndex();
  try {
    const result = await index.search(cleaned, {
      attributesToRetrieve: ['id', 'title', 'content'],
      attributesToCrop: ['content'],
      cropLength: 80,
      cropMarker: '...'
    });
    return (result.hits || []).map((h) => ({
      id: h.id,
      title: h.title,
      snippet: (h._formatted && h._formatted.content) || h.content
    }));
  } catch (err) {
    if (err && err.errorCode === 'index_not_found') {
      knowledgeIndex = undefined;
    }
    logger.error(`Search failed: ${err.message}`);
    throw new Error(`Gagal melakukan pencarian: ${err.message}`);
  }
}

async function checkMeiliConnection() {
  await client.health();
}

async function isMeiliConnected() {
  try {
    await client.health();
    return true;
  } catch (err) {
    logger.error(`Meili connection check failed: ${err.message}`);
    return false;
  }
}

module.exports = {
  indexArticle,
  searchArticles,
  checkMeiliConnection,
  isMeiliConnected,
};
