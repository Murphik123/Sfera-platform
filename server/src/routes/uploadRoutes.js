const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { uploadFile, handleUpload, getFile } = require('../controllers/uploadController');

router.post('/', authMiddleware, uploadFile, handleUpload);
router.get('/:filename', getFile);

module.exports = router;
