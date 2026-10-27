// ============================================================
// AI маршруты (без лишних require)
// Путь: server/src/routes/aiRoutes.js
// ============================================================
const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { getPredictions, createPrediction, aiChat, getAIHistory, clearAIHistory } = require('../controllers/aiController');

router.get('/predictions', getPredictions);
router.post('/predictions', createPrediction);

router.post('/chat', authMiddleware, aiChat);
router.get('/history', authMiddleware, getAIHistory);
router.post('/clear', authMiddleware, clearAIHistory);

module.exports = router;
