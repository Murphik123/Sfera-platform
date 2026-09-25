/* ==========================================================================
   SFERA PLATFORM — MAIN SERVER (Node.js + Express + Socket.io)
   ========================================================================== */

const path = require('path');
// .env загружается ПЕРВЫМ, до require модулей, читающих process.env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { checkQdrantConnection } = require('./src/services/qdrant.service');
const connectDB = require('./src/config/db');
const initSocket = require('./src/sockets');


const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Динамическое авто-подключение всех маршрутов из src/routes
const routesDir = path.join(__dirname, 'src/routes');

if (fs.existsSync(routesDir)) {
  console.log(`📁 Найдена папка маршрутов (routes): ${routesDir}`);
  const files = fs.readdirSync(routesDir);

  files.forEach((file) => {
    if (file.endsWith('.js')) {
      const routeName = file.replace(/Routes\.js$|\.js$/, '').toLowerCase();
      const routePath = `/api/${routeName}`;
      const fullFilePath = path.join(routesDir, file);

      try {
        const routeModule = require(fullFilePath);
        app.use(routePath, routeModule);
        console.log(`✅ Маршрут подключен: ${routePath} -> ${file}`);
        // Алиас множественного числа (/api/user -> /api/users), как в src/app.js
        if (!routePath.endsWith('s')) {
          app.use(`${routePath}s`, routeModule);
        }
      } catch (err) {
        console.error(`❌ Ошибка загрузки маршрута ${file}:`, err.message);
      }
    }
  });
}

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', uptime: Math.floor(process.uptime()) });
});

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';
const httpServer = http.createServer(app);

// Один production Socket.IO gateway на общем HTTP-сервере.
const io = initSocket(httpServer);
app.set('io', io);

async function startServer() {
  try {
    await connectDB();

    httpServer.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on http://${HOST}:${PORT}`);
      console.log(`🔌 WebSocket готов`);
      checkQdrantConnection();
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();
