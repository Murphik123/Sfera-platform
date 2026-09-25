// ============================================================
// Маршрут для статистики (публичный)
// Путь: server/src/routes/statsRoutes.js
// ============================================================
const router = require('express').Router();

// Заглушка – данные для главной страницы
router.get('/', (req, res) => {
  res.json({
    online: 1842,
    users: 2340000,
    orders: 18540291,
    docs: 11328901,
    coin: 21000000
  });
});

module.exports = router;
