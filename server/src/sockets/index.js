// SFERA — single authenticated Socket.IO gateway
const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const Message = require('../models/Message');
const User = require('../models/User');

module.exports = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Авторизация сокет-соединения через JWT.
  // Идентичность всегда берётся из токена, а не из данных клиента.
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return next(new Error('Authentication error: Invalid token'));
    }

    socket.userId = decoded.userId.toString();
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;

    console.log(`🟢 Пользователь ${userId} подключился к WebSocket (${socket.id})`);

    // Персональная комната — основной механизм адресной доставки.
    socket.join(userId);
    User.updateOne({ _id: userId }, { online: true, lastSeen: new Date() }).catch(() => {});
    io.emit('user_status_change', { userId, online: true });

    // Совместимость со старым Messenger-клиентом.
    // ВАЖНО: событие не может изменить socket.userId.
    socket.on('register_user', () => {
      io.emit('user_status_change', { userId, online: true });
    });

    // Сохранение и realtime-доставка сообщений.
    socket.on('send_message', async (data = {}) => {
      try {
        const { to, text, attachments = [] } = data;

        if (!to || !text) return;
        if (String(to) === userId) return;
        const recipientExists = await User.exists({ _id: to });
        if (!recipientExists) return;

        const message = new Message({
          from: userId,
          to,
          text,
          attachments: attachments || [],
        });

        await message.save();

        const populatedMessage = await Message.findById(message._id)
          .populate('from', 'username avatar online')
          .populate('to', 'username avatar online');

        io.to(String(to)).emit('new_message', populatedMessage);
        io.to(userId).emit('new_message', populatedMessage);
      } catch (err) {
        console.error('❌ Socket send_message error:', err.message);
        socket.emit('message_error', {
          success: false,
          error: 'Message delivery failed',
        });
      }
    });

    // WebRTC: инициатор звонка.
    socket.on('call_user', (data = {}) => {
      const target = data.userToCall;
      if (!target) return;

      io.to(String(target)).emit('incoming_call', {
        signal: data.signalData,
        from: userId,
        isVideo: Boolean(data.isVideo),
      });
    });

    // WebRTC: ответ на звонок.
    socket.on('answer_call', (data = {}) => {
      const target = data.to;
      if (!target) return;

      io.to(String(target)).emit('call_accepted', data.signal);
    });

    // WebRTC: ICE-кандидат.
    socket.on('ice_candidate', (data = {}) => {
      const target = data.to;
      if (!target) return;

      io.to(String(target)).emit('ice_candidate', {
        candidate: data.candidate,
        from: userId,
      });
    });

    // WebRTC: завершение звонка.
    socket.on('end_call', (data = {}) => {
      const target = data.to;
      if (!target) return;

      io.to(String(target)).emit('call_ended');
    });

    socket.on('disconnect', async () => {
      console.log(`🔴 Пользователь ${userId} отключился от WebSocket`);
      // Пользователь может быть открыт в нескольких вкладках.
      const stillOnline = (await io.in(userId).fetchSockets()).length > 0;
      if (stillOnline) return;
      User.updateOne({ _id: userId }, { online: false, lastSeen: new Date() }).catch(() => {});
      io.emit('user_status_change', { userId, online: false });
    });
  });

  return io;
};
