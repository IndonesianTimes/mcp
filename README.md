# mcp

[![Docker Ready](https://img.shields.io/badge/docker-ready-blue)](docker-compose.yml)
[![OpenAI Compatible](https://img.shields.io/badge/openai-compatible-green)](#)
[![Meilisearch Inside](https://img.shields.io/badge/meilisearch-inside-blueviolet)](#)

This project is a minimal Express server used in tests. It now includes a small AI helper utility and an `/ask` endpoint.

## Cara jalan cepat

1. Clone repo ini.
2. Jalankan `bash setup.sh`.
3. Akses `http://localhost:3000` di browser.

## Struktur Folder

```
.
├── ai.js
├── server.js
├── search.js
├── docker-compose.yml
├── public/
├── __tests__/
├── test_data/
└── ...
```

## Endpoint API

| Method | Endpoint | Auth | Deskripsi |
| ------ | -------- | ---- | --------- |
| GET | `/healthz` | - | Cek kesehatan server |
| GET | `/status` | - | Info status aplikasi |
| POST | `/data` | Bearer | Mengembalikan data yang dikirim |
| POST | `/articles` | Bearer | Menyimpan artikel ke Meilisearch |
| GET | `/search?query=...` | Bearer | Mencari artikel |
| POST | `/tools/call` | Bearer | Menjalankan tool tertentu |
| GET | `/tools/list` | Bearer | Daftar tool yang tersedia |
| POST | `/ask` | Bearer | Ajukan pertanyaan ke LLM |

## 📦 Environment Variables

Gunakan variabel berikut untuk mengatur perilaku aplikasi. Contoh nilai diberikan untuk memudahkan konfigurasi.

| Key | Deskripsi | Contoh |
|-----|-----------|--------|
| `APP_MODE` | Mode aplikasi | `demo` |
| `PORT` | Port server | `3000` |
| `MEILI_HOST` | URL Meilisearch | `http://localhost:7700` |
| `MEILI_API_KEY` | API Key Meili | `masterKey` |
| `OPENAI_API_KEY` | API Key GPT | `sk-...` |
| `JWT_SECRET` | Token untuk auth (optional) | `secret` |

## Adding a new LLM backend

LLM providers are selected via the `LLM_BACKEND` environment variable. To add a new provider:

1. Create a module that exports a `generate(prompt: string): Promise<string>` function.
2. Add a new branch in `ai.js` that checks for your backend name in `LLM_BACKEND` and calls your module.

No changes are required in the `/ask` endpoint because it delegates to `askAI()` which handles backend selection.
