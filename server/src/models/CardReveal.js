// SFERA-PATCH:SPRINT3.4m:reveal-model
const mongoose = require('mongoose');

const cardRevealSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cardId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true, index: true },
  ip:        { type: String, default: '' },
  userAgent: { type: String, default: '' },
  success:   { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('CardReveal', cardRevealSchema);
