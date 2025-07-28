# mcp

This project is a minimal Express server used in tests. It now includes a small AI helper utility and an `/ask` endpoint.

## Adding a new LLM backend

LLM providers are selected via the `LLM_BACKEND` environment variable. To add a new provider:

1. Create a module that exports a `generate(prompt: string): Promise<string>` function.
2. Add a new branch in `ai.js` that checks for your backend name in `LLM_BACKEND` and calls your module.

No changes are required in the `/ask` endpoint because it delegates to `askAI()` which handles backend selection.
