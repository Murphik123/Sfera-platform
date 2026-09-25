// src/services/qdrant.service.js
const { QdrantClient } = require('@qdrant/js-client-rest');

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

// Клиент создается только при наличии URL — платформа должна запускаться и без Qdrant
const qdrantClient = QDRANT_URL
  ? new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY })
  : null;

const isQdrantConfigured = () => Boolean(QDRANT_URL);

// Логирует состояние кластера при старте сервера. Никогда не бросает исключение,
// чтобы недоступный Qdrant не мешал запуску платформы.
const checkQdrantConnection = async () => {
  if (!qdrantClient) {
    console.warn('⚠️  Qdrant: переменная QDRANT_URL не задана, векторный поиск отключен');
    return false;
  }

  if (!QDRANT_API_KEY) {
    console.warn('⚠️  Qdrant: QDRANT_API_KEY не задан, подключение к облачному кластеру может быть отклонено');
  }

  try {
    const { collections } = await qdrantClient.getCollections();
    const names = collections.map((collection) => collection.name);

    console.log(`✅ Qdrant подключен: ${QDRANT_URL} (коллекций: ${names.length})`);
    if (names.length) {
      console.log(`   Коллекции: ${names.join(', ')}`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Qdrant недоступен (${QDRANT_URL}): ${error.message}`);
    return false;
  }
};

module.exports = { qdrantClient, checkQdrantConnection, isQdrantConfigured };
