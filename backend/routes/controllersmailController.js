const Mail = require('../models/Mail');

exports.getInbox = async (req, res) => {
  try {
    const mails = await Mail.find({ to: req.user.email }).sort({ createdAt: -1 });
    res.json(mails);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.sendMail = async (req, res) => {
  const { to, subject, body } = req.body;
  try {
    const mail = new Mail({
      from: req.user.email,
      to,
      subject,
      body,
    });
    await mail.save();
    res.status(201).json({ message: 'Письмо отправлено' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.markAsRead = async (req, res) => {
  const { id } = req.params;
  try {
    await Mail.findByIdAndUpdate(id, { read: true });
    res.json({ message: 'Письмо прочитано' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};