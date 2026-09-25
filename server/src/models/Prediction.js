const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  predictedPrice: { type: Number, required: true },
  confidence: { type: Number, min: 0, max: 1, default: 0.5 },
  actualPrice: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prediction', predictionSchema);
