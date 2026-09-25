const { verifyToken } = require('../utils/jwt');
const redisClient = require('../config/redis');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : authHeader;

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Проверка Redis сессии (если клиент активен)
    if (redisClient && redisClient.isOpen) {
      try {
        const sessionToken = await redisClient.get(`session:${decoded.userId}`);
        if (sessionToken && sessionToken !== token) {
          return res.status(401).json({ message: 'Invalid session' });
        }
      } catch (redisErr) {
        console.warn('Redis check warning:', redisErr.message);
      }
    }

    // Загружаем пользователя из БД
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Account blocked' });
    }

    req.user = user;          // полный объект пользователя
    req.userId = decoded.userId; // для обратной совместимости

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized', error: error.message });
  }
};

// Экспортируем функцию напрямую И как свойство объекта для абсолютной совместимости со всеми импортами
authMiddleware.authMiddleware = authMiddleware;
authMiddleware.protect = authMiddleware;

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
