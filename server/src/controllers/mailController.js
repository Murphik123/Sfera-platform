// src/controllers/mailController.js
// TM Mail: внутренняя почта между зарегистрированными пользователями Sfera.
// Если получатель не найден среди пользователей и настроен RESEND_API_KEY —
// письмо уходит на внешний адрес через Resend (прежнее поведение).
const mongoose = require('mongoose');
const Mail = require('../models/Mail');
const User = require('../models/User');

function formatMail(mail, currentUserId) {
  const from = mail.from || {};
  const to = mail.to || {};
  const isSent = String(from._id || from) === String(currentUserId);
  return {
    id: String(mail._id),
    from: from.username || '',
    fromEmail: from.email || '',
    to: to.username || '',
    toEmail: to.email || '',
    subject: mail.subject,
    body: mail.body,
    date: mail.createdAt,
    unread: isSent ? false : !mail.read,
    folder: isSent ? 'sent' : 'inbox',
    server: true
  };
}

async function findRecipient(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  return User.findOne({
    $or: [{ email: v.toLowerCase() }, { username: v }]
  }).select('username email');
}

async function sendExternal({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to.includes('@')) return null;
  const { Resend } = require('resend');
  const resend = new Resend(apiKey);
  return resend.emails.send({
    from: 'Sfera Platform <onboarding@resend.dev>',
    to: [to],
    subject: subject || 'Notification from Sfera',
    html: html || `<p>${text || ''}</p>`
  });
}

// POST /api/mail/send  { to: username|email, subject, text|body }
exports.sendMail = async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    const body = String(req.body.body || req.body.text || '').trim();

    if (!to || !subject || !body) {
      return res.status(400).json({ success: false, message: 'Recipient, subject and text are required.' });
    }

    const recipient = await findRecipient(to);

    if (!recipient) {
      const external = await sendExternal({ to: String(to), subject, text: body, html });
      if (external && !external.error) {
        return res.json({ success: true, external: true, message: 'Email sent to external address.' });
      }
      return res.status(404).json({ success: false, message: 'Recipient is not registered in Sfera.' });
    }

    const mail = await Mail.create({
      from: req.userId,
      to: recipient._id,
      subject: String(subject).trim().slice(0, 300),
      body: body.slice(0, 20000)
    });

    const populated = await Mail.findById(mail._id)
      .populate('from', 'username email')
      .populate('to', 'username email');

    const io = req.app.get('io');
    if (io) {
      io.to(String(recipient._id)).emit('new_mail', formatMail(populated, recipient._id));
    }

    return res.status(201).json({ success: true, mail: formatMail(populated, req.userId) });
  } catch (error) {
    console.error('Ошибка при отправке почты:', error);
    return res.status(500).json({ success: false, message: 'Failed to send email.', error: error.message });
  }
};

// GET /api/mail — входящие и отправленные текущего пользователя
exports.getMails = async (req, res) => {
  try {
    const mails = await Mail.find({
      $or: [
        { to: req.userId, deletedByRecipient: { $ne: true } },
        { from: req.userId, deletedBySender: { $ne: true } }
      ]
    })
      .populate('from', 'username email')
      .populate('to', 'username email')
      .sort({ createdAt: -1 })
      .limit(500);

    res.json({ success: true, mails: mails.map((m) => formatMail(m, req.userId)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/mail/:id/read
exports.markRead = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false });
    await Mail.updateOne({ _id: req.params.id, to: req.userId }, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/mail/:id — удаляет письмо только у текущего пользователя
exports.deleteMail = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false });
    const mail = await Mail.findById(req.params.id);
    if (!mail) return res.status(404).json({ success: false });
    if (String(mail.to) === String(req.userId)) mail.deletedByRecipient = true;
    else if (String(mail.from) === String(req.userId)) mail.deletedBySender = true;
    else return res.status(403).json({ success: false });
    await mail.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
