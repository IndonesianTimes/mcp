const express = require('express');
const { indexArticle, searchArticles } = require('./search');
const fs = require('fs');
const path = require('path');

const app = express();
const jsonParser = express.json();

// Wrap express.json in try/catch to handle mis-parsed JSON
app.use((req, res, next) => {
  try {
    jsonParser(req, res, (err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  } catch (err) {
    next(err);
  }
});

app.post('/data', (req, res) => {
  res.json({ received: req.body });
});

app.post('/articles', async (req, res, next) => {
  try {
    const result = await indexArticle(req.body);
    res.json({ indexed: result });
  } catch (err) {
    next(err);
  }
});

app.post('/tools/call', async (req, res, next) => {
  const { tool_name, params } = req.body || {};
  if (typeof tool_name !== 'string' || typeof params !== 'object' || params === null || Array.isArray(params)) {
    return res.status(400).json({ error: 'tool_name harus string dan params harus objek' });
  }

  const map = {
    searchArticles: searchArticles,
    indexArticle: (p) => indexArticle(p.article ?? p),
  };

  const fn = map[tool_name];
  if (!fn) {
    return res.status(404).json({ error: 'Tool tidak ditemukan' });
  }

  try {
    const result = await fn(params);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

app.get('/tools/list', (req, res) => {
  const filePath = path.join(__dirname, 'tools.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      // If file does not exist fallback to empty array
      if (err.code === 'ENOENT') {
        return res.json({ tools: [] });
      }
      return res.status(500).json({ error: 'Failed to read tools data' });
    }
    let tools;
    try {
      tools = JSON.parse(data);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse tools data' });
    }
    res.json({ tools });
  });
});

// Error handling middleware for invalid JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
