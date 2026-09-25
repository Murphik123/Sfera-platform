// src/controllers/chatController.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');

const createHttpError = (message, status = 500, details) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

const logControllerError = (context, error, meta = {}) => {
  console.error(`[chatController:${context}]`, {
    message: error.message,
    status: error.status || 500,
    name: error.name,
    stack: error.stack,
    ...meta
  });
};

const normalizeMessagePayload = (body = {}) => {
  const { to, text, attachments } = body;
  const normalizedText = typeof text === 'string' ? text.trim() : '';
  const normalizedAttachments = Array.isArray(attachments)
    ? attachments.filter((item) => typeof item === 'string' && item.trim())
    : [];

  return {
    to,
    text: normalizedText,
    attachments: normalizedAttachments
  };
};

// ============================================================
// ОТПРАВКА СООБЩЕНИЯ
// ============================================================
exports.sendMessage = async (req, res, next) => {
  try {
    const { to, text, attachments } = normalizeMessagePayload(req.body);
    const from = req.userId;

    if (!from) {
      throw createHttpError('Пользователь не авторизован', 401);
    }

    if (!to || !mongoose.Types.ObjectId.isValid(String(to))) {
      throw createHttpError('Неверный идентификатор получателя', 400);
    }

    if (!text && attachments.length === 0) {
      throw createHttpError('Укажите получателя и текст/файлы сообщения', 400);
    }

    const messagePayload = {
      from,
      to,
      text,
      attachments
    };

    const message = new Message(messagePayload);

    try {
      await message.validate();
    } catch (validationError) {
      const details = Object.values(validationError.errors || {}).map((item) => item.message);
      throw createHttpError('Ошибка валидации сообщения', 400, details);
    }

    const savedMessage = await message.save();

    const populatedMessage = await Message.findById(savedMessage._id)
      .populate('from', 'username avatar online')
      .populate('to', 'username avatar online');

    const io = req.app.get('io');
    if (io) {
      io.to(String(to)).emit('new_message', populatedMessage);
      io.to(String(from)).emit('new_message', populatedMessage);
    }

    return res.status(201).json(populatedMessage);
  } catch (error) {
    logControllerError('sendMessage', error, {
      from: req.userId,
      to: req.body?.to
    });
    next(error);
  }
};

// ============================================================
// ПОЛУЧЕНИЕ ПЕРЕПИСКИ С ПОЛЬЗОВАТЕЛЕМ
// ============================================================
exports.getMessages = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      throw createHttpError('Неверный идентификатор пользователя', 400);
    }

    const messages = await Message.find({
      $or: [
        { from: req.userId, to: userId },
        { from: userId, to: req.userId }
      ]
    })
      .populate('from', 'username avatar')
      .populate('to', 'username avatar')
      .sort({ createdAt: 1 });

    return res.json(messages);
  } catch (error) {
    logControllerError('getMessages', error, {
      userId: req.params?.userId,
      currentUserId: req.userId
    });
    next(error);
  }
};

// ============================================================
// СПИСОК ДИАЛОГОВ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
// ============================================================
exports.getDialogs = async (req, res, next) => {
  try {
    const currentUserId = req.userId;

    if (!currentUserId) {
      throw createHttpError('Пользователь не авторизован', 401);
    }

    const messages = await Message.find({
      $or: [{ from: currentUserId }, { to: currentUserId }]
    })
      .sort({ createdAt: -1 })
      .populate('from', 'username avatar online')
      .populate('to', 'username avatar online');

    const dialogsMap = new Map();

    messages.forEach((msg) => {
      const isFromMe = msg.from._id.toString() === currentUserId.toString();
      const partner = isFromMe ? msg.to : msg.from;
      const partnerId = partner._id.toString();

      if (!dialogsMap.has(partnerId)) {
        dialogsMap.set(partnerId, {
          id: partnerId,
          user: partner,
          lastMessage: { text: msg.text, createdAt: msg.createdAt },
          lastMsg: msg.text,
          time: msg.createdAt,
          unread: !isFromMe && !msg.read ? 1 : 0
        });
      } else if (!isFromMe && !msg.read) {
        const dialog = dialogsMap.get(partnerId);
        dialog.unread += 1;
      }
    });

    // Все зарегистрированные пользователи видны в чате, даже без переписки.
    const others = await User.find({
      _id: { $ne: currentUserId },
      isBlocked: { $ne: true }
    }).select('username avatar online');

    others.forEach((u) => {
      const id = u._id.toString();
      if (!dialogsMap.has(id)) {
        dialogsMap.set(id, { id, user: u, lastMsg: '', time: u.createdAt, unread: 0 });
      }
    });

    return res.json(Array.from(dialogsMap.values()));
  } catch (error) {
    logControllerError('getDialogs', error, {
      currentUserId: req.userId
    });
    next(error);
  }
};

// ============================================================
// ОТМЕТКА СООБЩЕНИЯ КАК ПРОЧИТАННОГО
// ============================================================
exports.markAsRead = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    if (!messageId || !mongoose.Types.ObjectId.isValid(String(messageId))) {
      throw createHttpError('Неверный идентификатор сообщения', 400);
    }

    const message = await Message.findById(messageId);

    if (!message) {
      throw createHttpError('Сообщение не найдено', 404);
    }

    if (message.to.toString() !== req.userId.toString()) {
      throw createHttpError('Нет прав для выполнения операции', 403);
    }

    message.read = true;
    await message.save();

    return res.json({ message: 'Сообщение отмечено как прочитанное' });
  } catch (error) {
    logControllerError('markAsRead', error, {
      messageId: req.params?.messageId,
      currentUserId: req.userId
    });
    next(error);
  }
};
