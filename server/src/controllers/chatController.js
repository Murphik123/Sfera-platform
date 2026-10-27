// src/controllers/chatController.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');

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

    let populatedMessage;
    const isGroup = await Group.exists({ _id: to });
    
    if (isGroup) {
      const group = await Group.findById(to);
      populatedMessage = await Message.findById(savedMessage._id)
        .populate('from', 'username avatar online')
        .lean();
      populatedMessage.to = { _id: group._id, name: group.name, isGroup: true };
    } else {
      populatedMessage = await Message.findById(savedMessage._id)
        .populate('from', 'username avatar online')
        .populate('to', 'username avatar online')
        .lean();
    }

       const io = req.app.get('io');
    if (io) {
      console.log('[socket] emit new_message → to:', String(to), 'from:', String(from), 'room size:', io.sockets.adapter.rooms.get(String(to))?.size || 0);
      io.to(String(to)).emit('new_message', populatedMessage);
      io.to(String(from)).emit('new_message', populatedMessage);
    } else {
      console.warn('[socket] io not available in req.app — сообщение не доставлено realtime');
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

    const currentUserId = req.userId;
    const isGroup = await Group.exists({ _id: userId });

    let query = isGroup 
      ? { to: userId }
      : { $or: [ { from: currentUserId, to: userId }, { from: userId, to: currentUserId } ] };

    const messages = await Message.find(query)
      .sort({ createdAt: 1 }) 
      .populate('from', 'username avatar online lastSeen');

    const TWO_MINUTES_MS = 2 * 60 * 1000;
    const formatUserOnlineStatus = (u) => {
      if (!u) return u;
      const userObj = u.toObject ? u.toObject() : { ...u };
      const isRecentlyActive = userObj.lastSeen && (Date.now() - new Date(userObj.lastSeen).getTime() < TWO_MINUTES_MS);
      userObj.online = Boolean(userObj.online || isRecentlyActive);
      return userObj;
    };

    const formattedMessages = messages.map((msg) => {
      const msgObj = msg.toObject();
      msgObj.from = formatUserOnlineStatus(msgObj.from);
      return msgObj;
    });

    return res.json(formattedMessages);
  } catch (error) {
    logControllerError('getMessages', error, { currentUserId: req.userId, targetUserId: req.params?.userId });
    next(error);
  }
};

// ============================================================
// СПИСОК ДИАЛОГОВ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
// ============================================================
exports.getDialogs = async (req, res, next) => {
  try {
    const currentUserId = req.userId;
    if (!currentUserId) throw createHttpError('Пользователь не авторизован', 401);

    const messages = await Message.find({
      $or: [{ from: currentUserId }, { to: currentUserId }]
    }).sort({ createdAt: -1 });

    const partnerIds = new Set();
    messages.forEach(msg => {
      const isFromMe = msg.from.toString() === currentUserId.toString();
      const partnerId = isFromMe ? msg.to.toString() : msg.from.toString();
      partnerIds.add(partnerId);
    });

    const users = await User.find({ _id: { $in: Array.from(partnerIds) } }).select('username avatar online lastSeen');
    const groups = await Group.find({ _id: { $in: Array.from(partnerIds) } });
    const userGroups = await Group.find({ members: currentUserId });

    const map = new Map();
    users.forEach(u => map.set(u._id.toString(), { type: 'user', doc: u }));
    groups.forEach(g => map.set(g._id.toString(), { type: 'group', doc: g }));
    userGroups.forEach(g => { if (!map.has(g._id.toString())) map.set(g._id.toString(), { type: 'group', doc: g }); });

    const dialogsMap = new Map();

    const TWO_MINUTES_MS = 2 * 60 * 1000;
    const formatUserOnlineStatus = (u) => {
      if (!u) return u;
      const userObj = u.toObject ? u.toObject() : { ...u };
      const isRecentlyActive = userObj.lastSeen && (Date.now() - new Date(userObj.lastSeen).getTime() < TWO_MINUTES_MS);
      userObj.online = Boolean(userObj.online || isRecentlyActive);
      return userObj;
    };

    messages.forEach((msg) => {
      const isFromMe = msg.from.toString() === currentUserId.toString();
      const partnerId = isFromMe ? msg.to.toString() : msg.from.toString();
      const partnerObj = map.get(partnerId);
      if (!partnerObj) return;

      let userPayload;
      if (partnerObj.type === 'user') {
        userPayload = formatUserOnlineStatus(partnerObj.doc);
      } else {
        userPayload = { _id: partnerId, username: partnerObj.doc.name, avatar: '', online: false, isGroup: true, creator: partnerObj.doc.creator };
      }

      if (!dialogsMap.has(partnerId)) {
        dialogsMap.set(partnerId, {
          id: partnerId,
          user: userPayload,
          lastMessage: { text: msg.text, createdAt: msg.createdAt },
          lastMsg: msg.text,
          time: msg.createdAt,
          unread: !isFromMe && !msg.read ? 1 : 0
        });
      } else if (!isFromMe && !msg.read) {
        dialogsMap.get(partnerId).unread += 1;
      }
    });

    const others = await User.find({ _id: { $ne: currentUserId, $nin: Array.from(dialogsMap.keys()) } }).select('username avatar online lastSeen');
    others.forEach((u) => {
      dialogsMap.set(u._id.toString(), {
        id: u._id.toString(),
        user: formatUserOnlineStatus(u),
        lastMsg: '',
        time: u.createdAt,
        unread: 0
      });
    });

    userGroups.forEach((g) => {
      const gid = g._id.toString();
      if (!dialogsMap.has(gid)) {
        dialogsMap.set(gid, {
          id: gid,
          user: { _id: gid, username: g.name, avatar: '', online: false, isGroup: true, creator: g.creator },
          lastMsg: '',
          time: g.createdAt,
          unread: 0
        });
      }
    });

    return res.json(Array.from(dialogsMap.values()));
  } catch (error) {
    logControllerError('getDialogs', error, { currentUserId: req.userId });
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


// ============================================================
// СОЗДАНИЕ ГРУППЫ
// ============================================================
exports.createGroup = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) throw createHttpError('Укажите название', 400);
    const allUsers = await User.find({ _id: { $ne: req.userId } }).select('_id');
    const memberIds = [req.userId, ...allUsers.map(u => u._id)];
    const group = new Group({ name: name.trim(), creator: req.userId, members: memberIds });
    await group.save();
    return res.status(201).json(group);
  } catch (error) { next(error); }
};

// ============================================================
// ПОЛУЧЕНИЕ СПИСКА ГРУПП
// ============================================================
exports.getGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({ members: req.userId }).sort({ updatedAt: -1 });
    return res.json(groups);
  } catch (error) { next(error); }
};

// ============================================================
// УДАЛЕНИЕ ГРУППЫ (только создатель)
// ============================================================
exports.deleteGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    if (!groupId || !mongoose.Types.ObjectId.isValid(String(groupId))) {
      throw createHttpError('Неверный идентификатор группы', 400);
    }

    const group = await Group.findById(groupId);
    if (!group) throw createHttpError('Группа не найдена', 404);

    if (String(group.creator) !== String(req.userId)) {
      throw createHttpError('Только создатель может удалить группу', 403);
    }

    // Удаляем сообщения и группу
    await Message.deleteMany({ to: groupId });
    await Group.deleteOne({ _id: groupId });

    // Уведомляем участников через Socket.IO
    const io = req.app.get('io');
    if (io) {
      group.members.forEach((m) => {
        io.to(String(m)).emit('group_deleted', { groupId: String(groupId) });
      });
    }

    return res.json({ success: true, message: 'Группа удалена' });
  } catch (error) {
    logControllerError('deleteGroup', error, { groupId: req.params?.groupId, userId: req.userId });
    next(error);
  }
};
