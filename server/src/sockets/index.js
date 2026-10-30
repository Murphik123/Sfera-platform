// SFERA — single authenticated Socket.IO gateway
const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const Message = require('../models/Message');
const Group = require('../models/Group');
const User = require('../models/User');

// === Call watchdog ===
// activeCalls: userId -> { peer, accepted, timer }
// Запись есть у ОБЕИХ сторон звонка. accepted=true после answer_call.
// Принятый звонок при обрыве сокета получает grace-период (WebRTC может жить без сокета),
// непринятый (calling/ringing) завершается сразу — клиент сам делает cleanup при disconnect.
const CALL_GRACE_MS = 30000;
const activeCalls = new Map();

function dropCall(uid) {
  const c = activeCalls.get(uid);
  if (!c) return;
  if (c.timer) clearTimeout(c.timer);
  activeCalls.delete(uid);
  const other = activeCalls.get(c.peer);
  if (other && other.peer === uid) {
    if (other.timer) clearTimeout(other.timer);
    activeCalls.delete(c.peer);
  }
}

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

    // Загружаем имя для показа в звонках (fromName в incoming_call)
    User.findById(decoded.userId)
      .select('username name fullName')
      .lean()
      .then((u) => {
        socket.userName = (u && (u.username || u.name || u.fullName)) || null;
        next();
      })
      .catch((err) => {
        console.warn('[socket] userName lookup failed:', err.message);
        socket.userName = null;
        next();
      });
  });

  // При старте сервера — все офлайн (соединения умерли вместе со старым процессом).
  // ОДИН РАЗ, не при каждом коннекте (иначе сбрасываем других активных юзеров).
  User.updateMany({}, { online: false }).catch(() => {});

  io.on('connection', (socket) => {
    const userId = socket.userId;

    console.log(`🟢 Пользователь ${userId} подключился к WebSocket (${socket.id})`);

    // Персональная комната — основной механизм адресной доставки.
    socket.join(userId);
    const pendingCall = activeCalls.get(userId);
    if (pendingCall && pendingCall.timer) {
      clearTimeout(pendingCall.timer);
      pendingCall.timer = null;
    }
    User.updateOne({ _id: userId }, { online: true, lastSeen: new Date() }).catch(() => {});
    io.emit('user_status_change', { userId, online: true });

    // Совместимость со старым Messenger-клиентом.
    // ВАЖНО: событие не может изменить socket.userId.
       socket.on('register_user', () => {
      io.emit('user_status_change', { userId, online: true });
    });

    // Heartbeat: клиент раз в 45 сек говорит «я жив» → обновляем lastSeen
    socket.on('heartbeat', () => {
      User.updateOne(
        { _id: userId },
        { lastSeen: new Date(), online: true }
      ).then((r) => {
        if (r && r.modifiedCount > 0) {
          io.emit('user_status_change', { userId, online: true });
        }
      }).catch(() => {});
    });

    // Сохранение и realtime-доставка сообщений.
    socket.on('send_message', async (data = {}) => {
      try {
        const { to, text, attachments = [] } = data;

        if (!to || !text) return;
        if (String(to) === userId) return;
        const recipientExists = await User.exists({ _id: to });
        const groupExists = await Group.exists({ _id: to });
        if (!recipientExists && !groupExists) return;

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

        const targetGroup = await Group.findById(to).lean();
        if (targetGroup && Array.isArray(targetGroup.members)) {
          targetGroup.members.forEach((memberId) => {
            io.to(String(memberId)).emit('new_message', populatedMessage);
          });
        } else {
          io.to(String(to)).emit('new_message', populatedMessage);
        }
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
      if (String(target) === userId) return;

      // Устаревшие записи (потерянный end_call) не должны блокировать новый звонок
      dropCall(userId);
      dropCall(String(target));
      activeCalls.set(userId, { peer: String(target), accepted: false, timer: null });
      activeCalls.set(String(target), { peer: userId, accepted: false, timer: null });

      io.to(String(target)).emit('incoming_call', {
        signal: data.signalData,
        from: userId,
        fromName: socket.userName || null,
        isVideo: Boolean(data.isVideo),
      });
    });

    // WebRTC: ответ на звонок.
    socket.on('answer_call', (data = {}) => {
      const target = data.to;
      if (!target) return;

      const mine = activeCalls.get(userId);
      const theirs = activeCalls.get(String(target));
      if (mine && mine.peer === String(target)) mine.accepted = true;
      if (theirs && theirs.peer === userId) theirs.accepted = true;

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

      // Если у отправителя есть активный звонок с кем-то ДРУГИМ — это не его звонок, игнорируем.
      // Если записи нет (рестарт сервера и т.п.) — пропускаем как раньше, чтобы не ломать hangup.
      const mine = activeCalls.get(userId);
      if (mine && mine.peer !== String(target)) return;

      dropCall(userId);
      io.to(String(target)).emit('call_ended');
    });

    socket.on('disconnect', async () => {
      console.log(`🔴 Пользователь ${userId} отключился от WebSocket`);
      // Пользователь может быть открыт в нескольких вкладках.
      const stillOnline = (await io.in(userId).fetchSockets()).length > 0;
      if (stillOnline) return;

      const call = activeCalls.get(userId);
      if (call) {
        const peer = call.peer;
        if (!call.accepted) {
          // calling/ringing — клиент сам чистится при disconnect, сообщаем собеседнику сразу
          dropCall(userId);
          io.to(peer).emit('call_ended');
        } else if (!call.timer) {
          // принятый звонок: ждём CALL_GRACE_MS — вдруг сокет вернётся (WebRTC жив)
          call.timer = setTimeout(async () => {
            const cur = activeCalls.get(userId);
            if (!cur || cur.peer !== peer) return;
            const back = (await io.in(userId).fetchSockets()).length > 0;
            if (back) { cur.timer = null; return; }
            dropCall(userId);
            io.to(peer).emit('call_ended');
          }, CALL_GRACE_MS);
        }
      }

      User.updateOne({ _id: userId }, { online: false, lastSeen: new Date() }).catch(() => {});
      io.emit('user_status_change', { userId, online: false });
    });
  });

  return io;
};
