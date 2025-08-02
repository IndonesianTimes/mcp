// Simple local LLM provider stub
async function generate(prompt) {
  if (typeof prompt !== 'string') {
    throw new TypeError('prompt must be a string');
  }
  // Return a canned response for demonstration purposes
  return `Local response to: ${prompt.slice(0, 50)}`;
}

module.exports = { generate };
