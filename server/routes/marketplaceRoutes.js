const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const {
  getListings,
  createListing,
  createOrder,
  deleteListing,
  getMyOrders
} = require('../controllers/marketplaceController');

// Просмотр каталога — публично
router.get('/', getListings);
router.get('/listings', getListings);

// Всё остальное — только для вошедших пользователей (user и admin)
router.get('/orders/my', authMiddleware, getMyOrders);
router.post('/orders', authMiddleware, createOrder);

router.post('/', authMiddleware, createListing);
router.post('/listings', authMiddleware, createListing);

router.delete('/listings/:id', authMiddleware, deleteListing);
router.delete('/:id', authMiddleware, deleteListing);

module.exports = router;
