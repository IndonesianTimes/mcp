const fs = require('fs');
const path = require('path');

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
  const fn = getTool(name);
  return await fn(params);
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

loadTools();

module.exports = { loadTools, callTool, getToolList };

if (require.main === module) {
  const [,, toolName, paramsJson='{}'] = process.argv;
  if (!toolName) {
    console.error('Usage: node tools/call.js <toolName> [paramsJson]');
    process.exit(1);
  }
  let params = {};
  try {
    params = JSON.parse(paramsJson);
  } catch (err) {
    console.error('Invalid JSON for params');
    process.exit(1);
  }
  callTool(toolName, params)
    .then(res => {
      console.log(JSON.stringify(res, null, 2));
    })
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}
