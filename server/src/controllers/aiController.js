const Prediction = require('../models/Prediction');
const AISession = require('../models/AISession');
const { askOpenRouter } = require('../services/aiService');
const { checkProfanity } = require('../utils/profanityFilter');

const MAX_HISTORY = 20;

exports.getPredictions = async (req, res) => {
  try {
    const predictions = await Prediction.find().sort({ date: -1 }).limit(30);
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createPrediction = async (req, res) => {
  try {
    const { predictedPrice, confidence, date } = req.body;
    const prediction = new Prediction({
      date: date || new Date(),
      predictedPrice,
      confidence
    });
    await prediction.save();
    res.status(201).json(prediction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.aiChat = async (req, res, next) => {
  try {
    const userId = req.userId;
    const body = req.body || {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const lang = body.lang || 'ru';

    if (!message) {
      return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Empty message' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Message too long (max 2000)' });
    }

    if (checkProfanity(message)) {
      return res.status(400).json({ success: false, code: 'PROFANITY', message: 'Нецензурная лексика не допускается' });
    }

    let session = await AISession.findOne({ userId });
    if (!session) session = new AISession({ userId, messages: [] });

    session.messages.push({ role: 'user', content: message });
    session.lastActivity = new Date();

    const contextMsgs = session.messages.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content }));

    let reply;
    try {
      reply = await askOpenRouter(contextMsgs, lang);
    } catch (e) {
      console.error('[aiChat] LLM error:', e.message);
      return res.status(502).json({ success: false, code: 'LLM_ERROR', message: 'AI временно недоступен', detail: e.message });
    }

    session.messages.push({ role: 'assistant', content: reply });
    await session.save();

    return res.json({ success: true, reply, messagesCount: session.messages.length });
  } catch (error) {
    console.error('[aiChat]', error);
    next(error);
  }
};

exports.getAIHistory = async (req, res, next) => {
  try {
    const session = await AISession.findOne({ userId: req.userId });
    if (!session) return res.json({ success: true, messages: [], escalated: false });
    return res.json({ success: true, messages: session.messages, escalated: session.escalated });
  } catch (error) { next(error); }
};

exports.clearAIHistory = async (req, res, next) => {
  try {
    await AISession.deleteOne({ userId: req.userId });
    return res.json({ success: true });
  } catch (error) { next(error); }
};

// ============================================================
// УДАЛЕНИЕ ОДНОГО AI-СООБЩЕНИЯ (по индексу в массиве)
// ============================================================
exports.deleteAIMessage = async (req, res, next) => {
  try {
    const idx = parseInt(req.params.index, 10);
    if (isNaN(idx) || idx < 0) return res.status(400).json({ success: false, code: 'INVALID_INPUT' });
    const session = await AISession.findOne({ userId: req.userId });
    if (!session || !session.messages || idx >= session.messages.length) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND' });
    }
    session.messages.splice(idx, 1);
    await session.save();
    return res.json({ success: true });
  } catch (e) { next(e); }
};

// ============================================================
// ЭСКАЛАЦИЯ AI → admin (Позвать админа)
// ============================================================
exports.escalateToAdmin = async (req, res, next) => {
  try {
    const userId = req.userId;
    const User = require('../models/User');
    const Message = require('../models/Message');

    const admin = await User.findOne({ role: 'admin' }).select('_id username').lean();
    if (!admin) {
      return res.status(404).json({ success: false, code: 'NO_ADMIN', message: 'Администратор не найден' });
    }
    if (String(admin._id) === String(userId)) {
      return res.status(400).json({ success: false, code: 'IS_ADMIN', message: 'Вы уже админ' });
    }

    const user = await User.findById(userId).select('username').lean();
    const session = await AISession.findOne({ userId });
    const last = (session && session.messages ? session.messages.slice(-6) : [])
      .map(m => (m.role === 'user' ? '👤 ' : '🤖 ') + m.content.slice(0, 300))
      .join('\n');

    const text = '🆘 Эскалация из AI-помощника\n\nПользователь: ' + (user?.username || userId) + '\n\nПоследние сообщения:\n' + (last || '(нет)');

    const msg = new Message({ from: userId, to: admin._id, text });
    await msg.save();

    if (session) { session.escalated = true; await session.save(); }

    // Realtime-уведомление админу (для badge/toast без F5)
    try {
      const io = req.app.get('io');
      if (io && admin) {
        io.to(String(admin._id)).emit('ai_escalated', {
          userId: String(userId),
          username: (user && user.username) || String(userId),
          preview: (last || '(нет сообщений)').slice(0, 200),
          sessionId: session ? String(session._id) : null,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('[ai/escalate] realtime emit failed:', e.message);
    }

    const populated = await Message.findById(msg._id)
      .populate('from', 'username avatar online')
      .populate('to', 'username avatar online')
      .lean();

    const io = req.app.get('io');
    if (io) {
      io.to(String(admin._id)).emit('new_message', populated);
      io.to(String(userId)).emit('new_message', populated);
    }

    return res.json({ success: true, adminId: String(admin._id), adminUsername: admin.username });
  } catch (e) { next(e); }
};
