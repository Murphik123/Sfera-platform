// src/routes/mailRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const mailController = require('../controllers/mailController');

router.use(authMiddleware);

router.get('/', mailController.getMails);
router.post('/send', mailController.sendMail);
router.put('/:id/read', mailController.markRead);
router.delete('/:id', mailController.deleteMail);

module.exports = router;
