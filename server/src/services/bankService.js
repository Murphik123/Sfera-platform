// SFERA-PATCH:SPRINT1:service
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

async function transfer(userId, { fromAccountId, toAccount, amount, description, idempotencyKey }) {
  if (idempotencyKey) {
    const existing = await Transaction.findOne({ userId, idempotencyKey }).lean();
    if (existing) {
      const acc = await Account.findOne({ userId }).lean();
      return { transactionId: existing._id, balance: acc ? acc.balance : 0, idempotent: true };
    }
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sender = await Account.findOne({ _id: fromAccountId, userId }).session(session);
    if (!sender) throw Object.assign(new Error('Sender account not found'), { code: 'ACCOUNT_NOT_FOUND' });
    if (sender.balance < amount) throw Object.assign(new Error('Insufficient funds'), { code: 'INSUFFICIENT_FUNDS' });
    const recipient = await Account.findOne({ number: String(toAccount).replace(/\s+/g, '') }).session(session);
    if (!recipient) throw Object.assign(new Error('Recipient account not found'), { code: 'RECIPIENT_NOT_FOUND' });
    if (String(recipient._id) === String(sender._id)) throw Object.assign(new Error('Same account'), { code: 'SAME_ACCOUNT' });
    if (recipient.currency !== sender.currency) throw Object.assign(new Error('Currency mismatch'), { code: 'CURRENCY_MISMATCH' });
    sender.balance = Math.round((sender.balance - amount) * 100) / 100;
    recipient.balance = Math.round((recipient.balance + amount) * 100) / 100;
    await sender.save({ session });
    await recipient.save({ session });
    const [tx] = await Transaction.create([{
      userId,
      sender: userId,
      recipient: recipient.userId || null,
      fromAccountId: sender._id,
      toAccountId:   recipient._id,
      toAccount:     recipient.number,
      type: 'transfer',
      amount,
      currency: sender.currency,
      description: description || 'Transfer',
      status: 'completed',
      idempotencyKey: idempotencyKey || undefined
    }], { session });
    await session.commitTransaction();

    // SFERA-PATCH:SPRINT2.2a:notify — sender out + recipient in (best-effort, after commit)
    try {
      const notes = [
        {
          userId,
          type: 'transfer_out',
          message: 'Перевод ' + amount + ' ' + sender.currency + ' на ' + recipient.number,
          meta: { transactionId: tx._id, amount, direction: 'out', counterparty: recipient.number }
        }
      ];
      if (recipient.userId) {
        notes.push({
          userId: recipient.userId,
          type: 'transfer_in',
          message: 'Поступление ' + amount + ' ' + recipient.currency + ' от ' + (sender.number || 'счёта'),
          meta: { transactionId: tx._id, amount, direction: 'in', counterparty: sender.number || '' }
        });
      }
      await Notification.insertMany(notes);
    } catch (e) {
      console.warn('[SFERA-PATCH:SPRINT2.2a] Notification insert failed:', e.message);
    }

    return { transactionId: tx._id, balance: sender.balance };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally { session.endSession(); }
}
module.exports = { transfer };
