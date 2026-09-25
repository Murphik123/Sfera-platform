const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    // Основной баланс (TMT)
    balance: {
        type: Number,
        default: 0,
        min: [0, 'Баланс не может быть отрицательным']
    },
    // Средства, заблокированные под сделки на маркетплейсе
    frozenBalance: {
        type: Number,
        default: 0,
        min: [0, 'Замороженный баланс не может быть отрицательным']
    },
    // Баланс в TM Coin
    tmCoinBalance: {
        type: Number,
        default: 0,
        min: [0, 'Баланс TM Coin не может быть отрицательным']
    },
    currency: {
        type: String,
        default: 'TMT'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Wallet', walletSchema);
