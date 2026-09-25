const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const qdrant = require('./qdrant');
const { getEmbedding } = require('./embeddingService');

async function testSearch() {
  try {
    const searchQuery = 'Тестовый запрос для Sfera';
    console.log(`🔍 Генерация вектора для поиска: "${searchQuery}"...`);

    const queryVector = await getEmbedding(searchQuery);

    console.log('🔄 Поиск похожих векторов в Qdrant...');
    const results = await qdrant.searchSimilar('sfera_vectors', queryVector, 5);

    console.log(`\n✅ Найдено совпадений: ${results.length}\n`);

    if (results.length === 0) {
      console.log('Записи не найдены. Убедитесь, что коллекция sfera_vectors содержит данные.');
      return;
    }

    results.forEach((item, index) => {
      console.log(`--- Результат #${index + 1} ---`);
      console.log(`🆔 ID: ${item.id}`);
      console.log(`🎯 Схожесть (Score): ${(item.score * 100).toFixed(2)}% (${item.score})`);
      console.log(`📄 Данные (Payload):`, item.payload);
      console.log('--------------------\n');
    });

  } catch (error) {
    console.error('❌ Ошибка векторного поиска:', error.message);
    if (error.cause) {
      console.error('🔍 Детали сетевой ошибки:', error.cause);
    }
  }
}

testSearch();