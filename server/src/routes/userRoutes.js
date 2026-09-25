const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' }
});

router.use(profileLimiter);

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user._id ? user._id.toString() : user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar || '',
    online: Boolean(user.online),
    lastSeen: user.lastSeen
  };
}

function buildProfileUpdates(payload = {}) {
  const allowedFields = ['username', 'email', 'avatar'];
  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (allowedFields.includes(key) && value !== undefined && value !== null && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {});
}

// GET /api/users — все зарегистрированные пользователи (без паролей), кроме текущего
router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId }, isBlocked: { $ne: true } })
      .select('username avatar online lastSeen role')
      .sort({ username: 1 });
    res.json(users.map((u) => ({ ...sanitizeUser(u), role: u.role })));
  } catch (error) {
    res.status(500).json({ message: 'Ошибка при получении пользователей', error: error.message });
  }
});

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      user: sanitizeUser(req.user)
    });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера при получении профиля', error: error.message });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const updates = buildProfileUpdates(req.body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Нет допустимых полей для обновления' });
    }

    const updatedUser = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
      runValidators: true
    }).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    res.json({ success: true, message: 'Профиль обновлен', user: sanitizeUser(updatedUser) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Данные уже заняты' });
    }

    res.status(500).json({ message: 'Ошибка при обновлении профиля', error: error.message });
  }
});

module.exports = router;
module.exports.sanitizeUser = sanitizeUser;
module.exports.buildProfileUpdates = buildProfileUpdates;
