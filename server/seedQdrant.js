const path = require('path');
// Загружаем .env из корня проекта (на один уровень выше)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const embeddingModule = require('./src/services/embedding.service');
const qdrant = require('./src/services/qdrant.service');

const getEmbedding = typeof embeddingModule === 'function' 
  ? embeddingModule 
  : (embeddingModule.getEmbedding || embeddingModule.generateEmbedding);

const sampleProducts = [
  {
    id: 1,
    title: 'Кроссовки Nike Air Max',
    description: 'Удобные спортивные кроссовки Nike для бега и повседневной носки',
    category: 'Обувь',
    price: 12900
  },
  {
    id: 2,
    title: 'Беговые кроссовки Adidas Ultraboost',
    description: 'Легкие кроссовки Adidas с хорошей амортизацией',
    category: 'Обувь',
    price: 14500
  },
  {
    id: 3,
    title: 'Смартфон Samsung Galaxy A10',
    description: 'Надежный бюджетный смартфон с четким экраном',
    category: 'Электроника',
    price: 18000
  },
  {
    id: 4,
    title: 'Кожаные классические туфли',
    description: 'Мужские черные туфли из натуральной кожи',
    category: 'Обувь',
    price: 9500
  }
];

async function seed() {
  const collectionName = process.env.QDRANT_COLLECTION || 'sfera_vectors';
  console.log(`🌱 Запуск индексации коллекции "${collectionName}"...`);

  if (!qdrant.client) {
    throw new Error('Подключение к Qdrant отсутствует. Проверьте QDRANT_URL в .env');
  }

  // 1. Генерация пробного вектора через Gemini API
  console.log('⏳ Вычисление размерности вектора...');
  const firstText = `${sampleProducts[0].title}. ${sampleProducts[0].description}. Категория: ${sampleProducts[0].category}`;
  const firstVector = await getEmbedding(firstText);
  const vectorSize = firstVector.length;
  console.log(`📏 Размерность векторов модели: ${vectorSize}`);

  // 2. Создание или пересоздание коллекции под размерность Gemini
  try {
    const { collections } = await qdrant.client.getCollections();
    const exists = collections.some(c => c.name === collectionName);

    if (exists) {
      console.log(`🗑️ Сброс существующей коллекции "${collectionName}"...`);
      await qdrant.client.deleteCollection(collectionName);
    }

    console.log(`⚙️ Создание коллекции "${collectionName}" (${vectorSize}d, Cosine)...`);
    await qdrant.client.createCollection(collectionName, {
      vectors: { size: vectorSize, distance: 'Cosine' }
    });
  } catch (e) {
    console.error('❌ Ошибка настройки коллекции:', e.message || e);
    throw e;
  }

  // 3. Сохранение товаров
  for (let i = 0; i < sampleProducts.length; i++) {
    const product = sampleProducts[i];
    const vector = (i === 0) 
      ? firstVector 
      : await getEmbedding(`${product.title}. ${product.description}. Категория: ${product.category}`);

    await qdrant.upsertVector(collectionName, {
      id: product.id,
      vector,
      payload: product
    });

    console.log(`✅ [${i + 1}/${sampleProducts.length}] Товар ID ${product.id} ("${product.title}") записан`);
  }

  console.log('🎉 Все тестовые данные успешно сохранены в Qdrant!');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Ошибка выполнения:', err.message || err);
    process.exit(1);
  });