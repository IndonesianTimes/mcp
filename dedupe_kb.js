const fs = require('fs');
const path = require('path');

const inputPath = '/var/www/html/knowledgebase_meili.json';  // file sumber
const outputFolder = '/root/mcp/kb/'; // folder output batch
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
  fs.mkdirSync(outputFolder, { recursive: true });
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

// Sinonim provider spesifik (hanya inject sesuai provider data ini)
const providerSynonyms = {
  'pgsoft': ['pgsoft', 'pg soft', 'pocket games soft', 'pgs'],
  'pragmatic': ['pragmatic', 'pragmatic play', 'pp', 'pragmaticplay'],
  'habanero': ['habanero', 'habanero slot', 'hb'],
  'microgaming': ['microgaming', 'micro gaming', 'mg'],
  'joker': ['joker', 'joker slot', 'joker123']
};


function getProviderSynonyms(provider) {
  const key = (provider || '').toLowerCase();
  return providerSynonyms[key] || (provider ? [provider] : []);
}

// Sinonim global
const globalSynonyms = [
  'slot', 'game', 'permainan', 'gacor', 'auto gacor', 'mudah menang',
  'jackpot', 'jp', 'bonus', 'bigwin', 'win',
  'manual', 'turbo', 'auto', 'quick', 'cepat', 'lambat',
  'malam', 'siang', 'pagi', 'sore',
  'bocoran', 'info', 'prediksi',
  'rtp', 'return to player', 'persentase menang', 'hari ini', 'sekarang', 'bagus'
];

// UPGRADED: Generator fulltext super kaya & clean
function createFulltext(obj) {
  function collectWords(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === "object") return [];
    return [String(val)];
  }

  let parts = [
    obj.name,
    obj.id,
    obj.provider,
    ...(getProviderSynonyms(obj.provider)),
    obj.status,
    obj.site,
    obj.jam_gacor,
    obj.rtp ? String(obj.rtp) : '',
    obj.last_update ? String(obj.last_update).slice(0, 10) : '', // tanggal only
    ...(collectWords(obj.category)),
    ...(collectWords(obj.tags)),
    ...(collectWords(obj.pola_main)),
    (typeof obj.description === "string" ? obj.description : ''),
    (Array.isArray(obj.faq) ? obj.faq.map(f => `${f.q} ${f.a}`).join(' ') : ''),
    globalSynonyms.join(' '),
    'resmi original terpercaya',
    'kangtau89', // context brand
    'link daftar bocoran info promo'
  ];

  // Tambah tag 'gacor' jika layak
  const rtpOK = obj.rtp && obj.rtp >= 85;
  const badPattern = Array.isArray(obj.pola_main)
    ? obj.pola_main.join(' ').toLowerCase().includes('jangan main')
    : false;
  if (rtpOK && !badPattern) {
    parts.push('gacor');
  }

  // Unique, lowercase, no blank
  let clean = parts.join(' ').replace(/[\s\n]+/g, ' ').toLowerCase();
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
