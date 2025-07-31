#!/usr/bin/env node
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const BASE_URL = process.env.MCP_URL || 'http://localhost:3000';
const SECRET = process.env.JWT_SECRET || 'secret';
const token = jwt.sign({ userId: 1 }, SECRET);

async function main() {
  const [, , cmd, ...args] = process.argv;
  if (!cmd || args.length === 0) {
    console.log('Usage: node cli.js ask "question"');
    console.log('       node cli.js search "query"');
    process.exit(1);
  }
  const param = args.join(' ');
  if (cmd === 'ask') {
    await doAsk(param);
  } else if (cmd === 'search') {
    await doSearch(param);
  } else {
    logger.error(`Unknown command: ${cmd}`);
    process.exit(1);
  }
}

async function doAsk(question) {
  try {
    const res = await fetch(`${BASE_URL}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ question }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      logger.error(`Error: ${data.error || res.statusText}`);
      return;
    }
    console.log(JSON.stringify(data.data, null, 2));
  } catch (err) {
    logger.error(`Network error: ${err.message}`);
  }
}

async function doSearch(query) {
  try {
    const url = `${BASE_URL}/search?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      logger.error(`Error: ${data.error || res.statusText}`);
      return;
    }
    console.log(JSON.stringify(data.data, null, 2));
  } catch (err) {
    logger.error(`Network error: ${err.message}`);
  }
}

main();
