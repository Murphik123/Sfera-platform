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
