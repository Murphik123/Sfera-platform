// server/src/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error('❌ Ошибка: Переменная MONGODB_URI/MONGO_URI не задана в .env!');
    }

    mongoose.set('strictQuery', true);
    mongoose.set('bufferCommands', false);

    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      autoIndex: false,
      maxIdleTimeMS: 30000
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
