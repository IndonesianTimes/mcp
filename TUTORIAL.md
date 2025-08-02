# MCP Server Setup & Usage Tutorial

This guide provides step-by-step instructions for installing, configuring and operating the **MCP Modular GPT Server**. The server offers modular tools, knowledge base querying and LLM integration via REST APIs.

## Prerequisites

- **Node.js 20+** (or Docker with Compose)
- Access to a **Meilisearch** instance (Docker setup is provided)
- Optional: OpenAI API key for `/ask` endpoint

## 1. Clone the Repository

```bash
git clone <repository-url>
cd mcp
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Create the `.env` File

Copy the example config and adjust values:

```bash
cp .env.example .env
```

Edit `.env` and set your environment variables:

```ini
APP_MODE=demo
PORT=3000
MEILI_HOST=http://localhost:7700
MEILI_API_KEY=masterKey
OPENAI_API_KEY=sk-yourkey
JWT_SECRET=your-jwt-secret
```

## 4. Run the System Doctor

Check that directories, environment variables and Meilisearch are ready:

```bash
npm run doctor
```

All checks should pass before continuing.

## 5. Start Meilisearch and MCP

### Using Docker

The easiest way is via Docker Compose:

```bash
docker-compose up -d
```

Alternatively run the convenience script which also copies `.env` if missing:

```bash
bash setup.sh
```

### Without Docker

Ensure Meilisearch is running and then launch the server:

```bash
npm start
```

The server listens on the port specified in `.env` (`3000` by default).

## 6. Index the Knowledge Base

Insert documents from `knowledgebase_meili.json` into Meilisearch:

```bash
npm run plug-kb
```

You can also trigger the same process through the admin endpoint `/tools/plug-kb`.

## 7. Generate a JWT Token

Use the bundled script to create a token for API calls:

```bash
node genToken.js
```

Copy the printed `Bearer <token>` string. Supply it in the `Authorization` header when calling secured endpoints.

## 8. Using the API

### Health and Status
- `GET /healthz` – simple health check
- `GET /status` – server, Meilisearch and LLM status

### Knowledge Base Search
- `GET /kb/search?query=...` – search documents indexed in Meilisearch
- `POST /kb/query` – search local KB mapping files

### LLM Question Answering
- `POST /ask` with JSON `{ "question": "..." }`

### Tools
- `GET /tools/list` – list available tools
- `POST /tools/call` – execute a tool

Example tool call:

```bash
curl -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"tool_name":"addNumbers","params":{"a":2,"b":3}}' \
     http://localhost:3000/tools/call
```

A successful response will contain `{ "success": true, "data": 5 }`.

## 9. Stopping the Server

If using Docker Compose:

```bash
docker-compose down
```

For a manual Node.js run, simply stop the process (Ctrl+C).

---

You now have the MCP Server running and ready for queries and tool calls.
