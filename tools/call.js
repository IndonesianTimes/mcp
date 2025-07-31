const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const modulesDir = path.join(__dirname, 'modules');

let tools = {};

function loadTools() {
  tools = {};
  if (!fs.existsSync(modulesDir)) {
    return;
  }
  const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const name = path.basename(file, '.js');
    // delete from require cache to allow reload
    delete require.cache[require.resolve(path.join(modulesDir, file))];
    tools[name] = require(path.join(modulesDir, file));
  }
}

function getTool(name) {
  if (!tools[name]) {
    throw new Error('Tool tidak ditemukan');
  }
  return tools[name];
}

async function callTool(name, params) {
  logger.info(`Executing tool: ${name}`);
  const fn = getTool(name);
  try {
    const result = await fn(params);
    logger.info(`Tool ${name} succeeded`);
    return result;
  } catch (err) {
    logger.error(`Tool ${name} failed: ${err.message}`);
    throw err;
  }
}

function listToolsFallback() {
  return Object.keys(tools).map(n => ({ name: n }));
}

function getToolList() {
  const jsonPath = path.join(__dirname, '..', 'tools.json');
  try {
    const data = fs.readFileSync(jsonPath, 'utf8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    // ignore and fallback
  }
  return listToolsFallback();
}

function usageTemplate(toolName, params = []) {
  const paramsObj = {};
  if (Array.isArray(params)) {
    params.forEach((p) => {
      paramsObj[p] = `<${p}>`;
    });
  }
  return {
    endpoint: '/tools/call',
    method: 'POST',
    body: {
      tool_name: toolName,
      params: paramsObj,
    },
  };
}

function getDetailedToolList() {
  loadTools();
  const jsonPath = path.join(__dirname, '..', 'tools.json');
  let meta = [];
  try {
    const data = fs.readFileSync(jsonPath, 'utf8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      meta = parsed;
    }
  } catch {
    // ignore when file missing or invalid
  }
  const metaMap = {};
  meta.forEach((t) => {
    metaMap[t.name] = t;
  });

  return Object.keys(tools).map((name) => {
    const mod = tools[name];
    const m = metaMap[name] || {};
    const description = mod.description || m.description || '';
    const example = mod.example_usage || mod.usage;
    const usage = example || usageTemplate(name, m.params);
    return { tool_name: name, description, usage };
  });
}

loadTools();

module.exports = { loadTools, callTool, getToolList, getDetailedToolList };

if (require.main === module) {
  const [,, toolName, paramsJson='{}'] = process.argv;
  if (!toolName) {
    logger.error('Usage: node tools/call.js <toolName> [paramsJson]');
    process.exit(1);
  }
  let params = {};
  try {
    params = JSON.parse(paramsJson);
  } catch (err) {
    logger.error('Invalid JSON for params');
    process.exit(1);
  }
  callTool(toolName, params)
    .then(res => {
      console.log(JSON.stringify(res, null, 2));
    })
    .catch(err => {
      logger.error(err.message);
      process.exit(1);
    });
}
