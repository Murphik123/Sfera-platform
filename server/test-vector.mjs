import path from 'path';
import dotenv from 'dotenv';
import { qdrantClient } from './config/qdrant.js';
import { getEmbedding } from './embeddingService.js';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function testVector() {
  try {
    console.log('🔄 1. Генерация вектора через Gemini...');
    const vector = await getEmbedding('Тестовый запрос для Sfera');

    console.log('🔄 2. Сохранение в Qdrant...');
    await qdrantClient.upsert('sfera_vectors', {
      points: [
        {
          id: 1,
          vector: vector,
          payload: { text: 'Тестовый запрос для Sfera', category: 'test' }
        }
      ]
    });

    console.log('✅ Вектор успешно сгенерирован и сохранен в Qdrant!');
  } catch (error) {
    console.error('❌ Ошибка теста:', error.message || error);
    if (error.cause) {
      console.error('🔍 Причина сбоя:', error.cause);
    }
  }
}

testVector();