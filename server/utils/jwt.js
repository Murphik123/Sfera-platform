const jwt = require('jsonwebtoken');

// Секрет читается при каждом вызове: .env может загрузиться позже require().
const DEFAULT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';
function getSecret() {
    return process.env.JWT_SECRET || DEFAULT_SECRET;
}

exports.generateToken = (userId) => jwt.sign({ userId }, getSecret(), { expiresIn: '7d' });

exports.verifyToken = (token) => {
    try {
        return jwt.verify(token, getSecret());
    } catch (error) {
        return null;
    }
};
