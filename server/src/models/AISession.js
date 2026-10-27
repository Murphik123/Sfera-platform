const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  escalated: { type: Boolean, default: false },
  lastActivity: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

module.exports = mongoose.model('AISession', sessionSchema);
