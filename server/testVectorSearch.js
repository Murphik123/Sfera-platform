const { getEmbedding } = require('./embeddingService');
const { qdrantClient } = require('./qdrant');

async function runTest() {
  try {
    console.log('1. Генерируем вектор для товара...');
    const vector = await getEmbedding('Спортивные кроссовки Nike для бега');

    console.log('2. Записываем вектор в Qdrant...');
    await qdrantClient.upsert('sfera_vectors', {
      points: [
        {
          id: 100,
          vector: vector,
          payload: { title: 'Спортивные кроссовки Nike', category: 'Обувь', price: 120 }
        }
      ]
    });

    console.log('3. Делаем поиск по смысловому запросу "спортивная обувь"...');
    const queryVector = await getEmbedding('купить спортивную обувь');

    const searchResult = await qdrantClient.query('sfera_vectors', {
      query: queryVector,
      limit: 10,
      with_payload: true
    });

    console.log('✅ Результат векторного поиска с метаданными:');
    console.log(JSON.stringify(searchResult, null, 2));
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

runTest();