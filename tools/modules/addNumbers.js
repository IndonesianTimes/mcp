const { addNumbers } = require('../../dummyTools');
const logger = require('../../logger');

module.exports = async function(params) {
  return addNumbers(params);
};

if (require.main === module) {
  const input = process.argv[2] || '{}';
  let params;
  try {
    params = JSON.parse(input);
  } catch (err) {
    logger.error('Invalid JSON input');
    process.exit(1);
  }
  Promise.resolve(module.exports(params))
    .then(res => {
      console.log(JSON.stringify(res, null, 2));
    })
    .catch(err => {
      logger.error(err.message);
      process.exit(1);
    });
}
