// SFERA-PATCH:SPRINT1:validate
const { validateIban } = require('../utils/iban');
module.exports = function validateBankTransfer(req, res, next) {
  const { fromAccountId, toAccount, amount } = req.body || {};
  if (!fromAccountId) return res.status(400).json({ success: false, code: 'FROM_REQUIRED', message: 'fromAccountId is required' });
  if (!toAccount || !validateIban(toAccount)) return res.status(400).json({ success: false, code: 'INVALID_IBAN', message: 'Invalid IBAN' });
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ success: false, code: 'INVALID_AMOUNT', message: 'Amount must be positive' });
  if (n > 1_000_000) return res.status(400).json({ success: false, code: 'LIMIT_EXCEEDED', message: 'Amount exceeds daily limit' });
  req.body.amount = Math.round(n * 100) / 100;
  next();
};
