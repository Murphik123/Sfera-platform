// src/routes/chatRoutes.js
const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { 
  sendMessage, 
  getMessages, 
  markAsRead, 
  getDialogs,
  createGroup,
  getGroups,
  deleteGroup,
  deleteMessage,
  deleteDialog,
  adminOversightUsers,
  adminOversightDialogs,
  adminOversightMessages
} = require('../controllers/chatController');
router.use(authMiddleware);
// 1. Статические роуты первыми!
router.get('/dialogs', getDialogs);
router.get('/groups', getGroups);
router.post('/groups', createGroup);
router.delete('/groups/:groupId', deleteGroup);
router.post('/send', sendMessage);
router.put('/read/:messageId', markAsRead);
router.delete('/message/:messageId', deleteMessage);
router.delete('/dialog/:userId', deleteDialog);
router.get('/admin/oversight/users', adminOversightUsers);
router.get('/admin/oversight/users/:userId/dialogs', adminOversightDialogs);
router.get('/admin/oversight/dialogs/:userA/:userB/messages', adminOversightMessages);

// 2. Динамические роуты с параметрами в конце!
router.get('/:userId', getMessages);

module.exports = router;
