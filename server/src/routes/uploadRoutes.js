const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { uploadFile, getFile } = require('../controllers/uploadController');

// POST /api/upload - загрузка файла
router.post('/', authMiddleware, uploadFile, (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    res.json({ 
        url: `/api/upload/${req.file.filename}`,
        filename: req.file.filename,
        originalName: req.file.originalname
    });
});

// GET /api/upload/:filename - получение файла (без authMiddleware, чтобы <img> мог загрузить)
router.get('/:filename', getFile);

module.exports = router;
