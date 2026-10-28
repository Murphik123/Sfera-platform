const router = require('express').Router();
const { getWorldNews, getPlatformNews, translateNewsText } = require('../controllers/newsController');

router.get('/world', getWorldNews);
router.get('/platform', getPlatformNews);
router.get('/translate', translateNewsText);

module.exports = router;
