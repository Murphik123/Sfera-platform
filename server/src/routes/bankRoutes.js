const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
// SFERA-PATCH:SPRINT1:routes
const { getBalance, getTransactions, getNotifications, markNotificationRead, exportTransactions, getCards, createCard, freezeCard } = require('../controllers/bankController');
const { transfer } = require('../services/bankService');
const validateBankTransfer = require('../middleware/validateBankTransfer');
const { mapTransferError } = require('../utils/mapTransferError');

router.use(authMiddleware);

router.get('/balance', getBalance);
router.post('/transfer', validateBankTransfer, async (req, res, next) => {
  try {
    // SFERA-PATCH:SPRINT3.1a:routes — io из app для realtime
    const io = req.app.get('io');
    const result = await transfer(req.userId, {
      fromAccountId: req.body.fromAccountId,
      toAccount: req.body.toAccount,
      amount: req.body.amount,
      description: req.body.description,
      idempotencyKey: req.headers['idempotency-key'] || req.body.idempotencyKey,
      io
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) { return next(mapTransferError(err)); }
});
router.get('/transactions', getTransactions);
// SFERA-PATCH:SPRINT3.2a:routes
router.get('/transactions/export', exportTransactions);
// SFERA-PATCH:SPRINT3.4a:routes
router.get('/cards', getCards);
router.post('/cards', createCard);
router.patch('/cards/:id', freezeCard);

// SFERA-PATCH:SPRINT2:routes
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);

module.exports = router;
