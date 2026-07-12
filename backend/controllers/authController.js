const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { name, phone, email, electronicKey, role, avatar } = req.body;
  try {
    const userExists = await User.findOne({ $or: [{ email }, { phone }] });
    if (userExists) {
      return res.status(400).json({ message: 'Пользователь с таким email или телефоном уже существует' });
    }
    const user = new User({ name, phone, email, electronicKey, role, avatar });
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name, email, role, avatar } });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.login = async (req, res) => {
  const { login, password } = req.body;
  try {
    const user = await User.findOne({ $or: [{ email: login }, { phone: login }] });
    if (!user) {
      return res.status(400).json({ message: 'Неверный логин или пароль' });
    }
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Неверный логин или пароль' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.getMe = async (req, res) => {
  res.json(req.user);
};
