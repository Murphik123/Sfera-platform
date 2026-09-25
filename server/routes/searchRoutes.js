const express = require('express');
const router = express.Router();
const getEmbedding = require('../services/embedding.service');
const qdrant = require('../services/qdrant.service');

router.post('/', async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Запрос не может быть пустым' });
    }

    const collectionName = process.env.QDRANT_COLLECTION || 'sfera_vectors';
    const queryVector = await getEmbedding(query);

    // Вызываем точный метод вашего сервиса Qdrant
    const rawResults = await qdrant.searchSimilar(collectionName, queryVector, Number(limit));

    const MIN_SCORE_THRESHOLD = 20;

    const data = (Array.isArray(rawResults) ? rawResults : (rawResults?.result || []))
      .map((item) => {
        let score = item.score ?? 0;
        if (score <= 1) score = score * 100;
        score = Number(score.toFixed(2));

        const payload = item.payload || item;

        return {
          id: item.id,
          score,
          title: payload.title || item.title || '',
          description: payload.description || item.description || '',
          category: payload.category || item.category || '',
          price: payload.price || item.price || 0
        };
      })
      .filter((product) => product.score >= MIN_SCORE_THRESHOLD);

    res.json({
      success: true,
      collection: collectionName,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('❌ Ошибка /api/search:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;