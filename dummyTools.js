function addNumbers(params) {
  const { a, b } = params || {};
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('a dan b harus number');
  }
  return a + b;
}

function multiplyNumbers(params) {
  const { a, b } = params || {};
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('a dan b harus number');
  }
  return a * b;
}

module.exports = {
  addNumbers,
  multiplyNumbers,
};
