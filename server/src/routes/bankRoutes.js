const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
// SFERA-PATCH:SPRINT1:routes
const { getBalance, getTransactions, getNotifications, markNotificationRead } = require('../controllers/bankController');
const { transfer } = require('../services/bankService');
const validateBankTransfer = require('../middleware/validateBankTransfer');
const { mapTransferError } = require('../utils/mapTransferError');

router.use(authMiddleware);

router.get('/balance', getBalance);
router.post('/transfer', validateBankTransfer, async (req, res, next) => {
  try {
    const result = await transfer(req.userId, {
      fromAccountId: req.body.fromAccountId,
      toAccount: req.body.toAccount,
      amount: req.body.amount,
      description: req.body.description,
      idempotencyKey: req.headers['idempotency-key'] || req.body.idempotencyKey
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) { return next(mapTransferError(err)); }
});
router.get('/transactions', getTransactions);

// SFERA-PATCH:SPRINT2:routes
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);

module.exports = router;
