const express = require('express');
const router = express.Router();
const {
  getListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing
} = require('../controllers/listingController');
const { protect } = require('../middleware/auth');
const { upload } = require('../config/upload');

// GET /api/listing — получение всех объявлений
router.get('/', getListings);

// GET /api/listing/:id — получение одного объявления
router.get('/:id', getListingById);

// Защищенные маршруты (требуют авторизации и загрузки фото)
router.post('/', protect, upload.array('images', 5), createListing);
router.put('/:id', protect, upload.array('images', 5), updateListing);
router.delete('/:id', protect, deleteListing);

module.exports = router;
