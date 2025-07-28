const { MeiliSearch } = require('meilisearch');
const { validateArticle } = require('./validation');

const client = new MeiliSearch({
  host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
  apiKey: process.env.MEILI_API_KEY || '',
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
    throw new Error(`Validasi gagal: ${err.message}`);
  }

  // Pastikan createdAt berupa ISO string
  try {
    article.createdAt = new Date(article.createdAt).toISOString();
  } catch (err) {
    throw new Error('createdAt tidak dapat diparse sebagai tanggal');
  }

  const index = await getKnowledgeIndex();
  try {
    return await index.addDocuments([article]);
  } catch (err) {
    throw new Error(`Gagal mengirim ke mesin pencarian: ${err.message}`);
  }
}

module.exports = { indexArticle };
