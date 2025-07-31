const { queryKnowledgeBase } = require('../../kb');

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
    console.error('Invalid JSON input');
    process.exit(1);
  }
  module.exports(params)
    .then(res => {
      console.log(JSON.stringify(res, null, 2));
    })
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}
