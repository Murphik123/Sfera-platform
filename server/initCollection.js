const { qdrant } = require('./qdrant');

async function init() {
  const collectionName = 'sfera_vectors';

  try {
    // 1. Пытаемся удалить старую коллекцию
    try {
      await qdrant.deleteCollection(collectionName);
      console.log(`🗑 Старая коллекция "${collectionName}" удалена.`);
    } catch (e) {
      // Игнорируем, если коллекции не было
    }

    // 2. Создаем новую коллекцию под векторы Gemini (768 измерений)
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: 768,
        distance: 'Cosine',
      },
    });
    console.log(`✅ Коллекция "${collectionName}" на 768 измерений успешно создана!`);
  } catch (error) {
    console.error('❌ Ошибка при создании коллекции:', error.message);
  }
}

init();