const { searchSimilar } = require('../services/qdrant.service');
const { generateEmbedding } = require('../services/embedding.service');

async function handleSemanticSearch(req, res) {
  try {
    const { query, limit = 10 } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Запрос (query) обязателен' });
    }

    const queryVector = await generateEmbedding(query);
    const results = await searchSimilar('sfera_marketplace', queryVector, limit);

    res.json({ success: true, query, results });
  } catch (error) {
    console.error('Ошибка семантического поиска:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера при поиске' });
  }
}

module.exports = { handleSemanticSearch };
