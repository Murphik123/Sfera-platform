// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { authMiddleware } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const mailRoutes = require('./routes/mailRoutes');
const bankRoutes = require('./routes/bankRoutes');
const aiRoutes = require('./routes/aiRoutes');
const statsRoutes = require('./routes/statsRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// Безопасность и CSP (разрешаем внешние шрифты, стили и WebSocket)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "*"]
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS открыт для веб-сайта и мобильного приложения (Expo)
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 1. Раздача статики (проверяем обе возможные структуры папок: ../public и ../../public)
const publicPath1 = path.resolve(__dirname, '../public');
const publicPath2 = path.resolve(__dirname, '../../public');

app.use(express.static(publicPath1));
app.use(express.static(publicPath2));

// 2. API маршруты
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/marketplace', authMiddleware, marketplaceRoutes);
app.use('/api/mail', authMiddleware, mailRoutes);
app.use('/api/bank', authMiddleware, bankRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);

// 3. Fallback для SPA (безопасный поиск index.html по двум путям)
app.get('*', (req, res) => {
  const primaryIndex = path.join(publicPath1, 'index.html');
  const fallbackIndex = path.join(publicPath2, 'index.html');

  res.sendFile(primaryIndex, (err) => {
    if (err) {
      res.sendFile(fallbackIndex, (fallbackErr) => {
        if (fallbackErr) {
          res.status(404).send('Index page not found. Check public folder structure.');
        }
      });
    }
  });
});

app.use(errorHandler);

module.exports = app;
