/* ==========================================================================
   SFERA PLATFORM — AUTHENTICATION ROUTES
   ========================================================================== */

const express = require('express');
const router = express.Router();

const {
    register,
    login,
    logout,
    getMe
} = require('../controllers/authController');

const { authMiddleware } = require('../middleware/auth');

// Публичные маршруты
router.post('/login', login);
router.post('/register', register);

// Защищённые маршруты
router.get('/me', authMiddleware, getMe);
router.post('/logout', authMiddleware, logout);

module.exports = router;
