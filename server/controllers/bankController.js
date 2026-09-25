// src/controllers/bankController.js
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

const buildError = (message, status = 500) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

exports.getBalance = async (req, res, next) => {
  try {
    let account = await Account.findOne({ userId: req.userId }).lean();

    if (!account) {
      account = await Account.create({ userId: req.userId, balance: 0 });
    }

    return res.status(200).json({
      success: true,
      data: {
        balance: account.balance,
        currency: account.currency
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.transfer = async (req, res, next) => {
  try {
    const { toUserId, amount, description } = req.body || {};
    const transferAmount = Number(amount);

    if (!toUserId || !mongoose.Types.ObjectId.isValid(String(toUserId))) {
      throw buildError('Неверный идентификатор получателя', 400);
    }

    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
      throw buildError('Сумма перевода должна быть больше нуля', 400);
    }

    if (String(req.userId) === String(toUserId)) {
      throw buildError('Нельзя перевести средства самому себе', 400);
    }

    const fromAccount = await Account.findOneAndUpdate(
      { userId: req.userId, balance: { $gte: transferAmount } },
      { $inc: { balance: -transferAmount } },
      { new: true }
    );

    if (!fromAccount) {
      throw buildError('Недостаточно средств или счёт не найден', 400);
    }

    const toAccount = await Account.findOneAndUpdate(
      { userId: toUserId },
      { $inc: { balance: transferAmount } },
      { new: true, upsert: true }
    );

    const transaction = await Transaction.create({
      sender: req.userId,
      recipient: toUserId,
      amount: transferAmount,
      currency: 'TMT',
      type: 'transfer',
      status: 'completed',
      description: description || 'Перевод внутри системы SFERA'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(String(toUserId)).emit('balance_updated', {
        newBalance: toAccount.balance,
        received: transferAmount
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        transaction,
        balance: fromAccount.balance
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    let account = await Account.findOne({ userId: req.userId }).lean();
    if (!account) {
      return res.status(200).json({ success: true, data: [] });
    }

    const transactions = await Transaction.find({
      $or: [{ sender: req.userId }, { recipient: req.userId }]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};
