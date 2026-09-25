import { getEmbedding } from './embeddingService.js';
import { qdrantClient } from './config/qdrant.js';

const COLLECTION_NAME = 'sfera_vectors';

/**
 * Добавление или обновление товара в векторной базе
 */
export async function indexProduct(product) {
  try {
    const textToVectorize = `${product.title} ${product.description || ''} ${product.category || ''}`;
    const vector = await getEmbedding(textToVectorize);

    // Qdrant принимает в id только число (integer) или UUID
    const productId = product.id || product._id;

    await qdrantClient.upsert(COLLECTION_NAME, {
      points: [
        {
          id: productId,
          vector: vector,
          payload: {
            title: product.title,
            price: product.price,
            category: product.category,
            imageUrl: product.imageUrl
          }
        }
      ]
    });
    console.log(`[Qdrant] Товар ID ${productId} проиндексирован.`);
  } catch (error) {
    console.error(`[Qdrant] Ошибка индексации товара:`, error);
  }
}

/**
 * Поиск товаров по смысловому запросу
 */
export async function searchProducts(queryText, limit = 10) {
  try {
    const queryVector = await getEmbedding(queryText);

    const result = await qdrantClient.query(COLLECTION_NAME, {
      query: queryVector,
      limit: limit,
      withPayload: true
    });

    return (result.points || []).map(point => ({
      id: point.id,
      score: point.score,
      ...point.payload
    }));
  } catch (error) {
    console.error('[Qdrant] Ошибка при векторном поиске:', error);
    return [];
  }
}