const { MeiliSearch } = require('meilisearch');
const { validateArticle } = require('./validation');
const logger = require('./logger');

const client = new MeiliSearch({
  host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
  apiKey: process.env.API_KEY || process.env.MEILI_API_KEY || '',
});

let indexPromise;

async function getKnowledgeIndex() {
  if (!indexPromise) {
    indexPromise = client
      .getIndex('knowledgebase')
      .catch(() => client.createIndex('knowledgebase', { primaryKey: 'id' }));
    indexPromise = indexPromise.then(async (idx) => {
      await idx.updateSettings({
        searchableAttributes: ['title', 'content', 'tags', 'category', 'author'],
        filterableAttributes: ['tags', 'category', 'author', 'createdAt'],
      });
      return idx;
    });
  }
  return indexPromise;
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
