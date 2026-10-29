// ============================================================
// AI маршруты (без лишних require)
// Путь: server/src/routes/aiRoutes.js
// ============================================================
const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { getPredictions, createPrediction, aiChat, getAIHistory, clearAIHistory, deleteAIMessage, escalateToAdmin, adminListSessions, adminGetSession } = require('../controllers/aiController');

router.get('/predictions', getPredictions);
router.post('/predictions', createPrediction);

router.post('/chat', authMiddleware, aiChat);
router.get('/history', authMiddleware, getAIHistory);
router.post('/clear', authMiddleware, clearAIHistory);
router.delete('/message/:index', authMiddleware, deleteAIMessage);
router.post('/escalate', authMiddleware, escalateToAdmin);

// Admin-only middleware
const adminOnly = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const u = await User.findById(req.userId).select('role').lean();
    if (!u || u.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    next();
  } catch (e) { next(e); }
};

router.get('/admin/sessions', authMiddleware, adminOnly, adminListSessions);
router.get('/admin/session/:userId', authMiddleware, adminOnly, adminGetSession);

module.exports = router;
