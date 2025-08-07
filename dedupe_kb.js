const fs = require('fs');
const path = require('path');

const inputPath = './knowledgebase_meili.json';  // file sumber
const outputFolder = './kb'; // folder output batch
const batchSize = 20; // batch size

// Fungsi sanitize ID sesuai aturan Meilisearch
function sanitizeId(id) {
  if (typeof id !== 'string') return '';
  return id
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')  // hanya huruf, angka, strip, underscore
    .slice(0, 511);               // maksimal 511 karakter
}

// 1. Pastikan folder output ada
if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder);
}

// 2. Baca data & deduplicate berdasarkan "id"
const raw = fs.readFileSync(inputPath, 'utf-8');
let data = JSON.parse(raw);

// Bersihkan dan sanitize ID dulu
data = data.map(item => ({
  ...item,
  id: sanitizeId(item.id)
}));

// Remove duplicate by id setelah sanitasi
const seen = new Set();
const deduped = data.filter(item => {
  if (seen.has(item.id)) return false;
  seen.add(item.id);
  return true;
});

console.log(`Deduplicated: ${deduped.length} unique entries.`);

// Function untuk flatten array (recursively, utk nested)
function flatten(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val), []);
}

// Logic "gacor" hanya RTP >= 85 dan tidak ada pola "jangan main"
function isGacor(obj) {
  const rtpOK = obj.rtp && obj.rtp >= 85;
  const badPattern = Array.isArray(obj.pola_main)
    ? obj.pola_main.join(' ').toLowerCase().includes('jangan main')
    : false;
  return rtpOK && !badPattern;
}

// Function createFulltext (REKOMENDASI FINAL)
function createFulltext(obj) {
  let parts = [
    obj.name || '',
    obj.provider || '',
    obj.id || '',
    obj.status || '',
    obj.rtp ? String(obj.rtp) : '',
    obj.jam_gacor || '',
    obj.last_update || '',
    flatten(obj.tags).join(' '),
    flatten(obj.category).join(' '),
    flatten(obj.pola_main).join(' '),
    (typeof obj.description === 'string' ? obj.description : ''),
    (Array.isArray(obj.faq) ? obj.faq.map(f => f.q + ' ' + f.a).join(' ') : ''),
    'slot malam siang pagi sore scatter rtp jp jackpot pola game auto manual turbo mudah menang gampang bonus bocoran link resmi terbaru'
  ];

  // Tambah 'gacor' HANYA jika layak
  if (isGacor(obj)) {
    parts.push('gacor');
  }

  // Hilangkan kata duplikat, lower-case semua, buang kosong
  let clean = parts.join(' ').replace(/\s+/g, ' ').toLowerCase();
  let unique = Array.from(new Set(clean.split(' ').filter(Boolean))).join(' ');
  return unique.trim();
}

// Tambahkan field fulltext di setiap KB hasil dedupe
for (let i = 0; i < deduped.length; i++) {
  deduped[i].fulltext = createFulltext(deduped[i]);
}

// 3. Bagi per batch & simpan ke file di ./kb/
let batchNum = 1;
for (let i = 0; i < deduped.length; i += batchSize) {
  const batch = deduped.slice(i, i + batchSize);
  const numStr = String(batchNum).padStart(2, '0');
  const filePath = path.join(outputFolder, `kb_batch_${numStr}.json`);
  fs.writeFileSync(filePath, JSON.stringify(batch, null, 2), 'utf-8');
  console.log(`✅ Batch ${batchNum}: ${batch.length} items → ${filePath}`);
  batchNum++;
}

console.log('Selesai! Semua batch tersimpan di folder kb/');
