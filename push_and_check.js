const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MeiliSearch } = require('meilisearch');

const MEILI_HOST = process.env.MEILI_HOST || 'http://localhost:7700';
const MEILI_API_KEY = process.env.MEILI_API_KEY || 'magmeili';
const KB_DIR = path.join(__dirname, '/kb');
const INDEX_NAME = 'knowledgebase';

// Inisialisasi Meili client
const client = new MeiliSearch({
  host: MEILI_HOST,
  apiKey: MEILI_API_KEY,
});

// Fungsi cek unique id dari semua batch
function cekUniqueIds() {
  const files = fs.readdirSync(KB_DIR).filter(f => /^kb_batch_\d+\.json$/.test(f));
  let allDocs = [];

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(KB_DIR, file), 'utf-8'));
    allDocs = allDocs.concat(data);
  }

  const allIds = allDocs.map(doc => doc.id);
  const uniqueIds = new Set(allIds);

  console.log(`Total dokumen gabungan: ${allDocs.length}`);
  console.log(`Jumlah unique id: ${uniqueIds.size}`);

  if (allDocs.length !== uniqueIds.size) {
    console.log('⚠️ Ada ID duplikat di antara batch file!');
  } else {
    console.log('✅ Semua ID unik, tidak ada duplikat.');
  }
}

// Fungsi push satu batch file ke Meili
async function pushBatch(file) {
  try {
    const filePath = path.join(KB_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(data)) {
      console.log(`❌ Skip ${file}: bukan array`);
      return;
    }
    const index = client.index(INDEX_NAME);
    const res = await index.addDocuments(data);
    console.log(`✅ [${file}] berhasil diupload, taskUid: ${res.taskUid}`);
  } catch (err) {
    console.error(`❌ [${file}] gagal upload:`, err.message || err);
  }
}

// Main: cek unique ids dan push semua batch berurutan
(async () => {
  cekUniqueIds();

  const files = fs.readdirSync(KB_DIR)
    .filter(f => /^kb_batch_\d+\.json$/.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!files.length) {
    console.log('❌ Tidak ditemukan file batch di folder kb/');
    return;
  }

  console.log(`🚀 Mulai upload ${files.length} batch file ke Meilisearch...`);
  for (const file of files) {
    await pushBatch(file);
  }
  console.log('🎉 Semua batch selesai diupload!');
})();
