const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // null для пополнений/депозитов
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // null для вывода средств
    },
    amount: {
        type: Number,
        required: [true, 'Сумма транзакции обязательна'],
        min: [0.01, 'Сумма транзакции должна быть больше 0']
    },
    currency: {
        type: String,
        enum: ['TMT', 'TM_COIN'],
        default: 'TMT'
    },
    type: {
        type: String,
        enum: ['transfer', 'deposit', 'withdrawal', 'escrow_hold', 'escrow_release', 'payment'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    description: {
        type: String,
        default: ''
    },
    relatedListing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing',
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);
