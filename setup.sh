#!/bin/bash
set -e

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
  else
    echo "Warning: .env.example not found; skipping copy" >&2
  fi
fi

docker-compose up --build -d

MCP_PORT=$(docker-compose port mcp 3000 2>/dev/null | cut -d ':' -f2)
MEILI_PORT=$(docker-compose port meilisearch 7700 2>/dev/null | cut -d ':' -f2)

MCP_PORT=${MCP_PORT:-3000}
MEILI_PORT=${MEILI_PORT:-7700}

echo -e "\e[32mSetup complete!\e[0m"
echo -e "\e[32mMCP running on http://localhost:${MCP_PORT}\e[0m"
echo -e "\e[32mMeilisearch running on http://localhost:${MEILI_PORT}\e[0m"
