// src/routes/chatRoutes.js
const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { 
  sendMessage, 
  getMessages, 
  markAsRead, 
  getDialogs,
  createGroup,
  getGroups
} = require('../controllers/chatController');
router.use(authMiddleware);
// 1. Статические роуты первыми!
router.get('/dialogs', getDialogs);
router.get('/groups', getGroups);
router.post('/groups', createGroup);
router.post('/send', sendMessage);
router.put('/read/:messageId', markAsRead);

// 2. Динамические роуты с параметрами в конце!
router.get('/:userId', getMessages);

module.exports = router;
