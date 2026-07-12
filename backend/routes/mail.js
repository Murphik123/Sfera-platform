
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getInbox, sendMail, markAsRead } = require('../controllers/mailController');

router.get('/inbox', auth, getInbox);
router.post('/send', auth, sendMail);
router.put('/read/:id', auth, markAsRead);

module.exports = router;
