const { validateIban } = require('../utils/iban');

module.exports = function validateBankTransfer(req, res, next) {
  const { fromAccountId, toAccount, amount } = req.body;

  if (!fromAccountId) {
    return res.status(400).json({ success: false, message: 'fromAccountId is required' });
  }
  if (!toAccount || !validateIban(toAccount)) {
    return res.status(400).json({ success: false, message: 'Invalid IBAN' });
  }
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Amount must be positive' });
  }
  if (numAmount > 1_000_000) {
    return res.status(400).json({ success: false, message: 'Amount exceeds daily limit' });
  }
  req.body.amount = Math.round(numAmount * 100) / 100;
  next();
};