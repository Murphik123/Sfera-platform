const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

router.get('/webrtc', authMiddleware, (req, res) => {
    const turnUsername = process.env.TURN_USERNAME;
    const turnCredential = process.env.TURN_CREDENTIAL;

    if (!turnUsername || !turnCredential) {
        console.warn('[Config] TURN credentials missing in env');
        return res.json({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    }

    res.json({
        iceServers: [
            { urls: 'stun:stun.relay.metered.ca:80' },
            { urls: 'turn:standard.relay.metered.ca:80', username: turnUsername, credential: turnCredential },
            { urls: 'turn:standard.relay.metered.ca:80?transport=tcp', username: turnUsername, credential: turnCredential },
            { urls: 'turn:standard.relay.metered.ca:443', username: turnUsername, credential: turnCredential },
            { urls: 'turn:standard.relay.metered.ca:443?transport=tcp', username: turnUsername, credential: turnCredential }
        ]
    });
});

module.exports = router;
