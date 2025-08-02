const fs = require('fs');
const path = require('path');

const inputPath = './knowledgebase_meili.json';  // file sumber
const outputFolder = './kb'; // folder output batch
const batchSize = 20; // bisa kamu ganti ke 10, 50, dll

// 1. Pastikan folder output ada
if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder);
}

// 2. Baca data & deduplicate berdasarkan "id"
const raw = fs.readFileSync(inputPath, 'utf-8');
let data = JSON.parse(raw);

// Remove duplicate by id
const seen = new Set();
const deduped = data.filter(item => {
  if (seen.has(item.id)) return false;
  seen.add(item.id);
  return true;
});

console.log(`Deduplicated: ${deduped.length} unique entries.`);

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
