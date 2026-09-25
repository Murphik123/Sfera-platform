const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

// Получение или создание кошелька
exports.getWallet = async (req, res) => {
    try {
        let wallet = await Wallet.findOne({ userId: req.user._id });
        
        if (!wallet) {
            wallet = await Wallet.create({ userId: req.user._id });
        }
        
        res.json(wallet);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Безопасный перевод средств (TMT или TM Coin)
exports.transfer = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { recipientId, amount, currency = 'TMT', description } = req.body;
        const senderId = req.user._id;

        if (senderId.toString() === recipientId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Нельзя перевести средства самому себе' });
        }

        const transferAmount = Number(amount);
        if (isNaN(transferAmount) || transferAmount <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Сумма перевода должна быть больше 0' });
        }

        const balanceField = currency === 'TM_COIN' ? 'tmCoinBalance' : 'balance';

        // 1. Проверяем баланс отправителя
        const senderWallet = await Wallet.findOne({ userId: senderId }).session(session);
        if (!senderWallet || senderWallet[balanceField] < transferAmount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Недостаточно средств на балансе' });
        }

        // 2. Получаем/создаем кошелек получателя
        let recipientWallet = await Wallet.findOne({ userId: recipientId }).session(session);
        if (!recipientWallet) {
            recipientWallet = new Wallet({ userId: recipientId });
        }

        // 3. Обновляем балансы
        senderWallet[balanceField] -= transferAmount;
        recipientWallet[balanceField] += transferAmount;

        await senderWallet.save({ session });
        await recipientWallet.save({ session });

        // 4. Фиксируем транзакцию
        const transaction = new Transaction({
            sender: senderId,
            recipient: recipientId,
            amount: transferAmount,
            currency,
            type: 'transfer',
            status: 'completed',
            description: description || 'Внутренний перевод'
        });

        await transaction.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.json({ message: 'Перевод успешно выполнен', transaction });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: err.message });
    }
};

// Пополнение баланса (Депозит)
exports.deposit = async (req, res) => {
    try {
        const { amount, currency = 'TMT' } = req.body;
        const depositAmount = Number(amount);

        if (isNaN(depositAmount) || depositAmount <= 0) {
            return res.status(400).json({ message: 'Сумма пополнения должна быть больше 0' });
        }

        const balanceField = currency === 'TM_COIN' ? 'tmCoinBalance' : 'balance';

        let wallet = await Wallet.findOne({ userId: req.user._id });
        if (!wallet) {
            wallet = new Wallet({ userId: req.user._id });
        }

        wallet[balanceField] += depositAmount;
        await wallet.save();

        const transaction = await Transaction.create({
            sender: null,
            recipient: req.user._id,
            amount: depositAmount,
            currency,
            type: 'deposit',
            status: 'completed',
            description: 'Пополнение баланса TM Pay'
        });

        res.json({ message: 'Баланс успешно пополнен', wallet, transaction });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// История транзакций пользователя
exports.getMyTransactions = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;

        const query = {
            $or: [
                { sender: req.user._id },
                { recipient: req.user._id }
            ]
        };

        const transactions = await Transaction.find(query)
            .populate('sender', 'username email')
            .populate('recipient', 'username email')
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Transaction.countDocuments(query);

        res.json({ transactions, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
