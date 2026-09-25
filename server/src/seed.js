const dns = require('dns');
dns.setServers(['86.54.11.100', '156.154.71.1']);

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const Listing = require('./models/Listing');

const dummySellerId = new mongoose.Types.ObjectId();

const products = [
  {
    title: 'Смартфон Sfera Phone 1',
    price: 3499,
    description: 'Тестовый смартфон для проверки маркетплейса',
    category: 'electronics',
    segment: 'b2c',
    seller: dummySellerId,
    images: [{ url: 'https://via.placeholder.com/150' }]
  },
  {
    title: 'Беспроводные наушники Sfera Sound',
    price: 800,
    description: 'Качественный звук и шумоподавление',
    category: 'electronics',
    segment: 'b2c',
    seller: dummySellerId,
    images: [{ url: 'https://via.placeholder.com/150' }]
  }
];

const seedDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('Переменная MONGO_URI не найдена в файле .env или окружении');
    }

    await mongoose.connect(mongoURI);
    console.log('✅ Успешное подключение к MongoDB');

    await Listing.deleteMany({});
    console.log('🗑️ Старые товары удалены');

    await Listing.insertMany(products);
    console.log('✅ База успешно заполнена товарами!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Ошибка заполнения:', err.message);
    process.exit(1);
  }
};

seedDB();
