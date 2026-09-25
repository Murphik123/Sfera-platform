const Prediction = require('../models/Prediction');

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
