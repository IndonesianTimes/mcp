# MCP Server Modular

![Node Version](https://img.shields.io/badge/node-%3E%3D20.x-brightgreen)
![License](https://img.shields.io/badge/license-ISC-blue)

## Overview
MCP Server Modular adalah backend Node.js + Express yang menyediakan REST API
untuk mengelola knowledge base dan integrasi Large Language Model (LLM).
Server ini dirancang untuk developer AI, tim operasi, dan prompt engineer yang
membutuhkan API fleksibel untuk query basis pengetahuan, pemanggilan tools,
serta bertanya ke LLM secara langsung.

## Architecture
```
[Client] -> [Express API] -> [Tools Modules]
                     ├-> [Meilisearch]
                     └-> [LLM Backend (OpenAI/local)]
```

## Features
- Knowledge Base (KB) berbasis mapping file
- Integrasi KB ke Meilisearch
- Endpoint LLM `/ask`
- Modular tool-call melalui `/tools/call`
- Upload KB JSON ke Meili dengan `npm run plug-kb`
- Dokter sistem `npm run doctor`
- Auto healthcheck melalui `/healthz` dan `/status`
- Endpoint diagnosa `/routes` menampilkan semua endpoint aktif
- Mode "degraded" – server tetap berjalan meski Meilisearch mati
- Rate limiting bawaan untuk mencegah abuse

## Directory Structure
```text
.
├── server.js          # Entry point Express
├── search.js          # Integrasi Meilisearch
├── kb.js              # Query KB berbasis mapping
├── ai.js              # Wrapper LLM
├── tools/             # Skrip utilitas
│   ├── doctor.js
│   └── plug_kb_to_meili.js
├── public/            # Halaman web statis
├── test_data/         # Contoh data & mapping
└── __tests__/         # Unit test
```

## Setup Instructions
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Buat file `.env`** berdasarkan `.env.example`:
   ```ini
   APP_MODE=demo
   PORT=3000
   MEILI_HOST=http://localhost:7700
   MEILI_API_KEY=masterKey
   LLM_BACKEND=local # atau openai
   OPENAI_API_KEY= # wajib jika LLM_BACKEND=openai
   JWT_SECRET=your-jwt-secret
   ```
3. **Jalankan dokter sistem**
   ```bash
   npm run doctor
   ```
4. **Start server**
   ```bash
   npm start
   ```
   Server akan tetap hidup walau Meilisearch belum siap.

5. **Generate token admin**
   ```bash
   node genToken.js
   # atau gunakan endpoint POST /admin/generate-token
   ```

## Usage
- `GET /kb/search?query=...` – pencarian KB di Meilisearch
- `GET /routes` – daftar endpoint aktif (butuh token)
- `POST /kb/query` – pencarian KB lokal berbasis mapping
- `POST /ask` – bertanya ke LLM
- `POST /tools/call` – menjalankan tool terdaftar

Contoh pemanggilan tool:
```bash
curl -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"tool_name":"addNumbers","params":{"a":2,"b":3}}' \
     http://localhost:3000/tools/call
```

Untuk mengirim pertanyaan ke GPT melalui endpoint `/ask` gunakan body JSON
`{"question":"Apa itu MCP?"}`.

## Plug-and-Play KB
Upload seluruh dokumen di `knowledgebase_meili.json` ke Meilisearch dengan:
```bash
npm run plug-kb
```
Pastikan Meilisearch telah berjalan dan variabel lingkungan sudah benar.

## Scripts
- `npm start` – menjalankan server
- `npm run doctor` – memeriksa konfigurasi dan koneksi
- `npm run plug-kb` – mengindeks KB JSON ke Meilisearch
- `./test.sh <query>` – tes cepat endpoint `/kb/search`
- `npm test` – menjalankan unit test

## API Reference
| Method | Path | Deskripsi |
| ------ | ---- | --------- |
| `GET`  | `/search` | Pencarian artikel di Meili (`query` parameter, 503 saat Meili mati) |
| `GET`  | `/healthz` | Healthcheck sederhana (status ok/degraded) |
| `GET`  | `/status` | Informasi server & koneksi (+dashboard HTML) |
| `GET`  | `/routes` | Daftar semua endpoint aktif |
| `GET`  | `/metrics` | Prometheus metrics |
| `POST` | `/articles` | Tambah artikel ke Meili |
| `POST` | `/tools/call` | Eksekusi tool terdaftar |
| `POST` | `/admin/reload-tools` | Reload daftar tools (admin only) |
| `POST` | `/admin/generate-token` | Hasilkan JWT (admin only) |
| `GET`  | `/tools/list` | Daftar tool yang tersedia |
Menampilkan array `tools` berisi metadata setiap modul. Contoh:
```json
{
  "tools": [
    {
      "tool_name": "addNumbers",
      "description": "Add two numbers",
      "usage": {
        "endpoint": "/tools/call",
        "method": "POST",
        "body": { "tool_name": "addNumbers", "params": { "a": 1, "b": 2 } }
      }
    }
  ]
}
```
| `POST` | `/tools/plug-kb` | Jalankan plug KB (admin only) |
| `POST` | `/kb/query` | Query KB lokal berdasarkan mapping |
| `GET`  | `/kb/search` | Pencarian KB dari Meili |
| `POST` | `/ask` | Bertanya ke LLM |

Semua endpoint kecuali `/search` dan `/tools/list` memerlukan Bearer token JWT.
Ganti nilai `JWT_SECRET` pada `.env` jika masih menggunakan default.

## Deployment Examples

### docker-compose
```yaml
version: '3'
services:
  mcp:
    build: .
    restart: always
    ports:
      - "3000:3000"
    environment:
      MEILI_HOST: http://meilisearch:7700
      LLM_BACKEND: local
      API_KEY: masterKey
    depends_on:
      - meilisearch
  meilisearch:
    image: getmeili/meilisearch:v1.7
    restart: always
    ports:
      - "7700:7700"
    environment:
      MEILI_MASTER_KEY: masterKey
```

### systemd
```ini
[Unit]
Description=MCP Server
After=network.target

[Service]
WorkingDirectory=/opt/mcp
ExecStart=/usr/bin/node server.js
Restart=always
EnvironmentFile=/opt/mcp/.env

[Install]
WantedBy=multi-user.target
```

## Troubleshooting
- **.env tidak ditemukan** – salin dari `.env.example` lalu jalankan `npm run doctor`.
- **Meilisearch gagal konek** – pastikan `MEILI_HOST` dan `MEILI_API_KEY` benar.
- **JWT error** – periksa nilai `JWT_SECRET` dan token yang dikirim.
- **Knowledge base tidak terindeks** – jalankan `npm run plug-kb` dan cek log.

## License
ISC
