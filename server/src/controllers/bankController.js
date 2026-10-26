// src/controllers/bankController.js
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { toCsv } = require('../utils/exportCsv');
const { buildPdf } = require('../utils/exportPdf');
const { generateIban } = require('../utils/ibanGenerator');

const buildError = (message, status = 500) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

// SFERA-PATCH:SPRINT1:overview
exports.getBalance = async (req, res, next) => {
  try {
    let accounts = await Account.find({ userId: req.userId }).lean();
    if (!accounts.length) {
      const created = await Account.create({ userId: req.userId, balance: 0, currency: 'TMT', number: generateIban() });
      accounts = [created.toObject()];
    } else {
      for (const acc of accounts) {
        if (!acc.number) {
          const newNum = generateIban();
          await Account.updateOne({ _id: acc._id }, { $set: { number: newNum } });
          acc.number = newNum;
        }
      }
    }
    const ids = accounts.map(a => a._id);
    const transactions = await Transaction.find({
      $or: [
        { fromAccountId: { $in: ids } },
        { toAccountId:   { $in: ids } },
        { sender: req.userId },
        { recipient: req.userId }
      ]
    }).sort({ createdAt: -1 }).limit(20).lean();

    return res.status(200).json({
      success: true,
      data: {
        accounts: accounts.map(a => ({
          id: String(a._id), number: a.number || '', name: a.name || a.type || 'Account',
          type: a.type || 'main', balance: a.balance, currency: a.currency || 'TMT'
        })),
        cards: [], transactions, notifications: [],
        balance: accounts.reduce((s, a) => s + ((a.currency || 'TMT') === 'TMT' ? Number(a.balance || 0) : 0), 0),
        currency: 'TMT'
      }
    });
  } catch (error) { next(error); }
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

// SFERA-PATCH:SPRINT2:getTransactions
exports.getTransactions = async (req, res, next) => {
  try {
    const limit  = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip   = Math.max(Number(req.query.skip) || 0, 0);
    const type   = String(req.query.type || '').trim();
    const search = String(req.query.search || '').trim();
    const from   = req.query.from ? new Date(req.query.from) : null;
    const to     = req.query.to   ? new Date(req.query.to)   : null;

    const accounts = await Account.find({ userId: req.userId }).lean();
    const accountIds = accounts.map(a => a._id);

    const query = {
      $or: [
        { sender: req.userId },
        { recipient: req.userId },
        { fromAccountId: { $in: accountIds } },
        { toAccountId:   { $in: accountIds } }
      ]
    };

    const VALID_TYPES = ['transfer','deposit','withdrawal','payment','escrow_hold','escrow_release'];
    if (type && VALID_TYPES.includes(type)) query.type = type;

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.description = { $regex: safeSearch, $options: 'i' };
    }

    if (from || to) {
      query.createdAt = {};
      if (from && !isNaN(from.getTime())) query.createdAt.$gte = from;
      if (to   && !isNaN(to.getTime()))   query.createdAt.$lte = to;
      if (!Object.keys(query.createdAt).length) delete query.createdAt;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Transaction.countDocuments(query)
    ]);

    return res.status(200).json({ success: true, data: transactions, total, limit, skip });
  } catch (error) { next(error); }
};

// SFERA-PATCH:SPRINT2:getNotifications
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(50).lean();
    const unread = notifications.filter(n => !n.read).length;
    return res.status(200).json({ success: true, data: notifications, unread });
  } catch (error) { next(error); }
};

// SFERA-PATCH:SPRINT2:markNotificationRead
exports.markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid id' });
    }
    await Notification.updateOne({ _id: id, userId: req.userId }, { $set: { read: true } });
    return res.status(200).json({ success: true });
  } catch (error) { next(error); }
}

// SFERA-PATCH:SPRINT3.2a:exports
exports.exportTransactions = async (req, res, next) => {
  try {
    const format = String(req.query.format || 'csv').toLowerCase();
    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({ success: false, code: 'INVALID_FORMAT', message: 'format must be csv or pdf' });
    }
    const type   = String(req.query.type || '').trim();
    const search = String(req.query.search || '').trim();
    const from   = req.query.from ? new Date(req.query.from) : null;
    const to     = req.query.to   ? new Date(req.query.to)   : null;

    const accounts = await Account.find({ userId: req.userId }).lean();
    const accountIds = accounts.map(a => a._id);

    const query = {
      $or: [
        { sender: req.userId },
        { recipient: req.userId },
        { fromAccountId: { $in: accountIds } },
        { toAccountId:   { $in: accountIds } }
      ]
    };
    const VALID_TYPES = ['transfer','deposit','withdrawal','payment','escrow_hold','escrow_release'];
    if (type && VALID_TYPES.includes(type)) query.type = type;
    if (search) {
      const safeSearch = search.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
      query.description = { $regex: safeSearch, $options: 'i' };
    }
    if (from || to) {
      query.createdAt = {};
      if (from && !isNaN(from.getTime())) query.createdAt.$gte = from;
      if (to   && !isNaN(to.getTime()))   query.createdAt.$lte = to;
      if (!Object.keys(query.createdAt).length) delete query.createdAt;
    }

    const transactions = await Transaction.find(query).sort({ createdAt: -1 }).limit(1000).lean();
    const ts = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const csv = toCsv(transactions);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="sfera-bank-' + ts + '.csv"');
      return res.send(csv);
    }

    const pdfBuffer = await buildPdf(transactions, { from: req.query.from || '', to: req.query.to || '' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="sfera-bank-' + ts + '.pdf"');
    res.setHeader('Content-Length', String(pdfBuffer.length));
    return res.end(pdfBuffer);
  } catch (error) { next(error); }
};
;
