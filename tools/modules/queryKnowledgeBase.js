const { queryKnowledgeBase } = require('../../kb');
const logger = require('../../logger');

module.exports = async function(params) {
  const query = typeof params === 'object' && params !== null ? (params.query ?? params) : params;
  return queryKnowledgeBase(query);
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
  module.exports(params)
    .then(res => {
      console.log(JSON.stringify(res, null, 2));
    })
    .catch(err => {
      logger.error(err.message);
      process.exit(1);
    });
}
