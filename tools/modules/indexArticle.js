const { indexArticle } = require('../../search');

module.exports = async function(params) {
  const article = typeof params === 'object' && params !== null ? (params.article ?? params) : params;
  return indexArticle(article);
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
