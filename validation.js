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
  const idTrim = String(id).trim();
  if (!idTrim) {
    throw new Error('id tidak boleh kosong');
  }
  if (!/^[a-z0-9_-]+$/i.test(idTrim)) {
    throw new Error('format id tidak valid');
  }

  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('title harus string dan tidak boleh kosong');
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('content harus string dan tidak boleh kosong');
  }
  if (typeof category !== 'string' || !category.trim()) {
    throw new Error('category harus string dan tidak boleh kosong');
  }
  if (typeof createdAt !== 'string' || !createdAt.trim()) {
    throw new Error('createdAt harus string dan tidak boleh kosong');
  }
  if (typeof author !== 'string' || !author.trim()) {
    throw new Error('author harus string dan tidak boleh kosong');
  }
  let parsedTags = [];
  if (Array.isArray(tags)) {
    parsedTags = tags.map((t) => {
      if (typeof t !== 'string' || !t.trim()) {
        throw new Error('tags harus array string tidak kosong');
      }
      return t.trim();
    });
  } else if (typeof tags === 'string') {
    parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return {
    id: idTrim,
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
