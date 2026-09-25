// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Имя пользователя обязательно'],
        unique: true,
        trim: true,
        minlength: [3, 'Имя пользователя должно содержать от 3 символов'],
        maxlength: [30, 'Имя пользователя не должно превышать 30 символов']
    },
    email: {
        type: String,
        required: [true, 'Email обязателен'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Укажите корректный email адрес']
    },
    password: {
        type: String,
        required: [true, 'Пароль обязателен'],
        minlength: [6, 'Пароль должен быть не менее 6 символов']
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'moderator'],
        default: 'user'
    },
    avatar: {
        type: String,
        default: ''
    },
    online: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    isBlocked: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true // Автоматически создает и обновляетcreatedAt и updatedAt
});

// Хэширование пароля перед сохранением
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Метод для сравнения паролей при входе (login)
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
