const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { adminAuth } = require('../middleware/adminAuth'); // правильный импорт

// Все маршруты требуют прав администратора
router.use(adminAuth);

// Статистика
router.get('/stats', adminController.getStats);

// Пользователи
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Транзакции
router.get('/transactions', adminController.getTransactions);

// Объявления (листинги)
router.get('/listings', adminController.getListings);
router.put('/listings/:id', adminController.updateListing);
router.delete('/listings/:id', adminController.deleteListing);

// Почта
router.get('/mails', adminController.getMails);
router.delete('/mails/:id', adminController.deleteMail);

// AI прогнозы
router.get('/predictions', adminController.getPredictions);
router.post('/predictions', adminController.createPrediction);
router.delete('/predictions/:id', adminController.deletePrediction);

module.exports = router;
