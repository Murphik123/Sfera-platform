// src/models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  attachments: [{
    type: String
  }],
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Автоматически добавляет createdAt и updatedAt
});

module.exports = mongoose.model('Message', messageSchema);
