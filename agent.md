 MCP Server – Modular Command Processor

This project is a **Node.js + Express based modular server** designed for running GPT-powered tools, local knowledge base queries, and LLM integrations. It is intentionally structured for human-friendly extensibility and can be maintained by non-engineers.

---

## ✅ Objectives

- Provide a **modular GPT API environment** for tools and knowledge querying
- Enable **pluggable knowledge bases** via JSON or Meilisearch
- Allow teams to call tools through `/tools/call` using JSON input
- Allow GPT-based question answering via `/ask`
- Provide structured endpoint `/kb/search` to query the KB contextually
- Secure the system with **JWT-based middleware**, while allowing certain endpoints to be public

---

## 📦 Project Structure

mcp/
├── server.js # Main Express server file
├── .env # Environment config (.env vars must be loaded)
├── tools/
│ ├── validateToken.js # JWT middleware for protected routes
│ ├── plug_kb_to_meili.js # Script to inject KB to Meilisearch
│ ├── doctor.js # System validator for MCP readiness
├── knowledgebase_meili.json # Main KB file for Meilisearch (array of objects)
├── kb_search_mapping.json # Optional mapping for semantic routing
├── genToken.js # Utility to generate JWT tokens from .env secret
├── test.bat # CLI tester for Windows (runs /kb/search)

markdown
Copy
Edit

---

## 🔐 Authentication

- JWT token is generated via `genToken.js`, using `JWT_SECRET` from `.env`
- Middleware `validateToken.js` is used for protected routes
- A global middleware `authenticateToken` exists in `server.js`
- Public endpoints are defined in `publicEndpoints[]` and bypass token verification

Example:
```js
const publicEndpoints = [
  '/search',
  '/tools/list',
  '/kb/search'
];
Important: Do not apply validateToken to a route that’s already in publicEndpoints.

🧠 Knowledgebase Modes
Supports 2 modes:

Static JSON file: knowledgebase_meili.json is injected to Meilisearch

File-per-entry (optional): kb/ folder with many .json files

Use plug_kb_to_meili.js to push KB to Meilisearch.

✅ Key Endpoints
Route	Method	Description
/kb/search	GET	Query knowledgebase using Meilisearch
/ask	POST	Forward message to GPT API
/tools/call	POST	Run tool with JSON payload
/search	GET	(Optional test endpoint)

🧪 Testing
Use test.bat to send a query to /kb/search

It auto-generates JWT from genToken.js

Token is passed in Authorization: Bearer <token>

🛠️ Dev Tips for Codex / Copilot
NEVER duplicate JWT validation — use either global or per-route, not both

ALWAYS use .env for secrets, hostnames, ports

KB injection goes through tools/plug_kb_to_meili.js

Validate query inputs before calling GPT or Meili

Any tool/module added to /tools must be CLI callable

Output must be clean JSON or clear error objects

🧼 Run Health Check
bash
Copy
Edit
npm run doctor
Runs the tools/doctor.js to check:

.env existence and vars

Meili connection

Folder structure

Token validity

Port availability
