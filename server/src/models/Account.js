// src/models/Account.js
const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Баланс не может быть отрицательным']
  },
  currency: {
    type: String,
    default: 'TMT'
  },
  // SFERA-PATCH:SPRINT1:account-number
  number: { type: String, unique: true, sparse: true }
}, {
  timestamps: true // Автоматически управляет createdAt и updatedAt
});

module.exports = mongoose.model('Account', accountSchema);
