const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { MeiliSearch } = require('meilisearch');
require('dotenv').config();

const requiredEnv = [
  'APP_MODE',
  'PORT',
  'MEILI_HOST',
  'MEILI_API_KEY',
  'OPENAI_API_KEY',
  'JWT_SECRET',
];

let allOk = true;

function log(ok, message) {
  if (ok) {
    console.log(chalk.green(`✅ ${message}`));
  } else {
    allOk = false;
    console.log(chalk.red(`❌ ${message}`));
  }
}

function warn(message) {
  console.log(chalk.yellow(`⚠️  ${message}`));
}

function checkExists(p, isDir = false) {
  try {
    const stat = fs.statSync(p);
    return isDir ? stat.isDirectory() : stat.isFile();
  } catch {
    return false;
  }
}

function ensureDir(p, name) {
  if (!checkExists(p, true)) {
    try {
      fs.mkdirSync(p, { recursive: true });
      console.log(chalk.yellow(`Created missing ${name}/ folder`));
    } catch (err) {
      log(false, `${name}/ folder missing and failed to create: ${err.message}`);
      return false;
    }
  }
  return true;
}

async function run() {
  console.log(chalk.cyan.bold('MCP Doctor Running...'));

  // folder checks
  log(checkExists(path.join(__dirname, '..', 'public'), true), 'public/ folder found', 'public/ folder missing');
  log(checkExists(path.join(__dirname, '..', 'tools'), true), 'tools/ folder found', 'tools/ folder missing');

  const kbPath = path.join(__dirname, '..', 'kb');
  log(ensureDir(kbPath, 'kb'), 'kb/ folder ready', 'kb/ folder missing');

  const logsPath = path.join(__dirname, '..', 'logs');
  log(ensureDir(logsPath, 'logs'), 'logs/ folder ready', 'logs/ folder missing');

  // file checks
  log(checkExists(path.join(__dirname, '..', '.env')), '.env found', '.env missing');
  log(checkExists(path.join(__dirname, '..', 'server.js')), 'server.js found', 'server.js missing');
  log(checkExists(path.join(__dirname, '..', 'knowledgebase_meili.json')), 'knowledgebase_meili.json found', 'knowledgebase_meili.json missing');
  const mappingPath = process.env.KB_MAPPING_PATH || path.join(__dirname, '..', 'test_data', 'kb_search_mapping.json');
  log(checkExists(mappingPath), `mapping file found (${mappingPath})`, `mapping file not found (${mappingPath})`);

  // env validation
  const missing = requiredEnv.filter((k) => !process.env[k]);
  if (missing.length === 0) {
    console.log(chalk.green(`✅ env vars ok`));
  } else {
    allOk = false;
    console.log(chalk.red(`❌ missing env vars: ${missing.join(', ')}`));
  }

  // meili connection
  let client;
  try {
    client = new MeiliSearch({
      host: process.env.MEILI_HOST,
      apiKey: process.env.API_KEY || process.env.MEILI_API_KEY,
    });
    await client.health();
    console.log(chalk.green('✅ Connected to Meilisearch'));
  } catch (err) {
    allOk = false;
    console.log(chalk.red(`❌ Cannot connect to Meilisearch: ${err.message}`));
    return finish();
  }

  try {
    const index = await client.getIndex('knowledgebase');
    console.log(chalk.green('✅ knowledgebase index exists'));
    const settings = await index.getSettings();
    const sAttr = ['name', 'tags', 'pola_main', 'jam_gacor'];
    const fAttr = ['provider', 'category', 'status'];
    const searchOk = sAttr.every((a) => settings.searchableAttributes.includes(a));
    const filterOk = fAttr.every((a) => settings.filterableAttributes.includes(a));
    if (!searchOk) {
      warn('searchableAttributes unexpected');
    } else {
      console.log(chalk.green('✅ searchableAttributes check'));
    }
    if (!filterOk) {
      warn('filterableAttributes unexpected');
    } else {
      console.log(chalk.green('✅ filterableAttributes check'));
    }
  } catch (err) {
    warn(`knowledgebase index check failed: ${err.message}`);
  }

  finish();
}

function finish() {
  if (allOk) {
    console.log(chalk.green.bold('All checks passed!'));
    process.exit(0);
  } else {
    console.log(chalk.red.bold('Some checks failed.'));
    process.exit(1);
  }
}

run();
