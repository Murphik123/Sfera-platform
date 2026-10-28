const mongoose = require('mongoose');
const multer = require('multer');

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }
});

exports.uploadFile = upload.single('file');

exports.handleUpload = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
        const filename = `${Date.now()}-${req.file.originalname}`;
        const uploadStream = bucket.openUploadStream(filename, { contentType: req.file.mimetype });
        uploadStream.end(req.file.buffer);
        uploadStream.on('finish', () => {
            res.json({ url: `/api/upload/${filename}`, filename: filename, originalName: req.file.originalname });
        });
        uploadStream.on('error', (err) => {
            res.status(500).json({ error: err.message });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getFile = async (req, res) => {
    try {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
        const files = await bucket.find({ filename: req.params.filename }).toArray();
        if (!files || files.length === 0) return res.status(404).json({ error: 'File not found' });
        const file = files[0];
        if (file.contentType) res.set('Content-Type', file.contentType);
        const downloadStream = bucket.openDownloadStream(file._id);
        downloadStream.pipe(res);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
