const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

async function transfer(userId, { fromAccountId, toAccount, amount, description }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Проверяем счёт отправителя
    const sender = await Account.findOne({ _id: fromAccountId, userId }).session(session);
    if (!sender) throw Object.assign(new Error('Sender account not found'), { code: 'ACCOUNT_NOT_FOUND' });
    if (sender.balance < amount) throw Object.assign(new Error('Insufficient funds'), { code: 'INSUFFICIENT_FUNDS' });

    // 2. Ищем счёт получателя по IBAN
    const recipient = await Account.findOne({ number: toAccount.replace(/\s+/g, '') }).session(session);
    if (!recipient) throw Object.assign(new Error('Recipient account not found'), { code: 'RECIPIENT_NOT_FOUND' });
    if (String(recipient._id) === String(sender._id)) {
      throw Object.assign(new Error('Cannot transfer to same account'), { code: 'SAME_ACCOUNT' });
    }
    if (recipient.currency !== sender.currency) {
      throw Object.assign(new Error('Currency mismatch'), { code: 'CURRENCY_MISMATCH' });
    }

    // 3. Атомарное списание/зачисление
    sender.balance = Math.round((sender.balance - amount) * 100) / 100;
    recipient.balance = Math.round((recipient.balance + amount) * 100) / 100;
    await sender.save({ session });
    await recipient.save({ session });

    // 4. Пишем транзакцию
    const [tx] = await Transaction.create([{
      userId,
      fromAccountId: sender._id,
      toAccountId: recipient._id,
      toAccount: recipient.number,
      type: 'transfer',
      amount,
      currency: sender.currency,
      description: description || 'Transfer',
      status: 'completed',
      createdAt: new Date()
    }], { session });

    await session.commitTransaction();
    return { transactionId: tx._id, balance: sender.balance };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { transfer };