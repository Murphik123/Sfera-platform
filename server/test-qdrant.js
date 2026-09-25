import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

const client = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY || undefined,
});

async function runTest() {
  const collectionName = 'test_sfera_collection';

  try {
    console.log('1. Проверка соединения...');
    const { collections } = await client.getCollections();
    console.log('✅ Подключение к Qdrant установлено.');

    if (collections.some((c) => c.name === collectionName)) {
      await client.deleteCollection(collectionName);
    }

    console.log('2. Создание коллекции...');
    await client.createCollection(collectionName, {
      vectors: { size: 4, distance: 'Cosine' },
    });
    console.log(`✅ Коллекция "${collectionName}" создана.`);

    console.log('3. Вставка вектора (Upsert)...');
    await client.upsert(collectionName, {
      wait: true,
      points: [
        {
          id: 1,
          vector: [0.25, 0.5, 0.75, 0.1],
          payload: { title: 'Тестовый объект Sfera', role: 'admin' },
        },
      ],
    });
    console.log('✅ Точка с вектором успешно добавлена.');

    console.log('4. Векторный поиск...');
    const searchResult = await client.search(collectionName, {
      vector: [0.25, 0.5, 0.75, 0.1],
      limit: 1,
    });

    console.log('✅ Результат поиска:');
    console.dir(searchResult, { depth: null });
  } catch (error) {
    console.error('❌ Ошибка Qdrant:', error.message);
  }
}

runTest();