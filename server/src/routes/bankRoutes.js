const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { getBalance, transfer, getTransactions } = require('../controllers/bankController');

router.use(authMiddleware);

router.get('/balance', getBalance);
router.post('/transfer', transfer);
router.get('/transactions', getTransactions);

module.exports = router;
