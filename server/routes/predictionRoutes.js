const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/predictionController');

router.get('/', predictionController.getPredictions);

// Важно: экспорт должен быть именно таким!
module.exports = router;
