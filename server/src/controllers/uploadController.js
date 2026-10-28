const mongoose = require('mongoose');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');

let gfs, gridfsBucket;

mongoose.connection.once('open', () => {
    gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
    });
    gfs = Grid(mongoose.connection.db, mongoose.mongo);
    gfs.collection('uploads');
});

const storage = new GridFsStorage({
    url: process.env.MONGODB_URI || process.env.MONGO_URI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            const filename = `${Date.now()}-${file.originalname}`;
            const fileInfo = {
                filename: filename,
                bucketName: 'uploads'
            };
            resolve(fileInfo);
        });
    }
});

const upload = multer({ storage });

exports.uploadFile = upload.single('file');

exports.getFile = async (req, res) => {
    try {
        const file = await gfs.files.findOne({ filename: req.params.filename });
        if (!file) return res.status(404).json({ error: 'File not found' });

        const readstream = gridfsBucket.openDownloadStream(file._id);
        readstream.pipe(res);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
