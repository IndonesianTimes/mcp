/**
 * Validasi objek tidak terverifikasi dan memastikan field bertipe sesuai.
 * @param {any} data
 * @returns {import('./article').Article}
 */
function validateArticle(data) {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Article harus berupa objek');
  }
  const { id, title, content, tags, category, createdAt, author } = data;
  if (typeof id !== 'string' && typeof id !== 'number') {
    throw new Error('id harus string atau number');
  }
  if (typeof title !== 'string') {
    throw new Error('title harus string');
  }
  if (typeof content !== 'string') {
    throw new Error('content harus string');
  }
  if (typeof category !== 'string') {
    throw new Error('category harus string');
  }
  if (typeof createdAt !== 'string') {
    throw new Error('createdAt harus string');
  }
  if (typeof author !== 'string') {
    throw new Error('author harus string');
  }
  let parsedTags = [];
  if (Array.isArray(tags)) {
    parsedTags = tags.map((t) => {
      if (typeof t !== 'string') {
        throw new Error('tags harus array string');
      }
      return t;
    });
  } else if (typeof tags === 'string') {
    parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return {
    id,
    title,
    content,
    tags: parsedTags,
    category,
    createdAt,
    author,
  };
}

module.exports = {
  validateArticle,
};
