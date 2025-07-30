# MCP Server Modular

## 📚 Overview
MCP Server adalah backend modular berbasis Node.js dan Express. Sistem ini ditujukan untuk tim developer, ops, dan AI yang memerlukan REST API fleksibel lengkap dengan knowledge base dan integrasi LLM.

## ⚙️ Features
- Modular REST API untuk Knowledge Base dan Tools
- Plug-and-play KB menggunakan Meilisearch
- GPT integration siap pakai melalui endpoint `/ask`
- Self-check CLI `doctor.js` untuk memvalidasi lingkungan
- Auto index dan search KB

## 📂 Directory Structure
```text
.
├── server.js
├── kb.js
├── search.js
├── tools/
│   ├── plug_kb_to_meili.js
│   └── doctor.js
├── public/
│   ├── index.html
│   └── tools.html
├── test_data/
└── .env
```

## 🚀 Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Buat file .env
Contoh:
```ini
PORT=3000
MEILI_HOST=http://localhost:7700
MEILI_API_KEY=your-key
OPENAI_API_KEY=your-openai-key
JWT_SECRET=supersecret
```

### 3. Jalankan pemeriksaan awal
```bash
npm run doctor
```

### 4. Jalankan server
```bash
npm start
```

### 🤖 Plug-and-Play KB via Meilisearch
Pastikan `knowledgebase_meili.json` sudah tersedia lalu jalankan:
```bash
npm run plug-kb
```

## 🔎 API Reference
- `GET /kb/search?query=&provider=&category=` → query dari Meili
- `POST /kb/query` → query KB lokal dengan `mapping.json`
- `POST /ask` → kirim pertanyaan ke GPT/LLM
- `POST /tools/call` → eksekusi modular tools
- `GET /status` → status server, LLM, Meili, uptime

## 🔮 Testing
Gunakan curl atau Postman untuk mencoba setiap endpoint. Jalankan unit test dengan:
```bash
npm test
```

## 🆘 Troubleshooting
- Missing `.env` → jalankan `npm run doctor`
- Meili tidak connect → cek `MEILI_HOST`
- JWT error → cek `JWT_SECRET`
