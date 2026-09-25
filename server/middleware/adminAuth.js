const { authMiddleware } = require('./auth');

const adminAuth = async (req, res, next) => {
  // Сначала вызываем базовую аутентификацию
  authMiddleware(req, res, (err) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    // Если аутентификация прошла, проверяем роль
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
  });
};

module.exports = { adminAuth };
