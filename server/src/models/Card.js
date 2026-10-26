// SFERA-PATCH:SPRINT3.4a:card-model
const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:         { type: String, enum: ['debit','credit','virtual'], default: 'debit' },
  fullNumber:   { type: String, required: true, unique: true },
  maskedNumber: { type: String, required: true },
  expiry:       { type: String, required: true },
  frozen:       { type: Boolean, default: false, index: true },
  limit:        { type: Number, default: 1000 }
}, { timestamps: true });

module.exports = mongoose.model('Card', cardSchema);
