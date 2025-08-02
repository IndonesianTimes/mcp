const fs = require('fs');
const path = require('path');
const { MeiliSearch } = require('meilisearch');

const MEILI_HOST = process.env.MEILI_HOST || 'http://localhost:7700';
const MEILI_API_KEY = process.env.MEILI_API_KEY || 'masterKey';
const KB_DIR = path.join(__dirname, '../kb');
const INDEX_NAME = 'knowledgebase';

// Inisialisasi client
const client = new MeiliSearch({
  host: MEILI_HOST,
  apiKey: MEILI_API_KEY
});

// Fungsi push satu batch
async function pushBatch(file) {
  try {
    const filePath = path.join(KB_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(data)) {
      console.log(`❌ Skip ${file}: Not an array`);
      return;
    }
    const index = client.index(INDEX_NAME);
    const res = await index.addDocuments(data);
    console.log(`✅ [${file}] uploaded, taskUid: ${res.taskUid}`);
  } catch (e) {
    console.error(`❌ [${file}] failed:`, e.message || e);
  }
}

// Main eksekusi untuk semua file batch
(async () => {
  const files = fs.readdirSync(KB_DIR)
    .filter(f => /^kb_batch_\d+\.json$/.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  
  if (!files.length) {
    console.log('Tidak ada file batch ditemukan di folder /kb');
    return;
  }

  console.log(`Akan push total ${files.length} batch ke Meilisearch...`);
  for (const file of files) {
    await pushBatch(file);
  }
  console.log('Done push all batch!');
})();
