require('dotenv').config();
const { QdrantClient } = require('@qdrant/js-client-rest');

const rawUrl = (process.env.QDRANT_URL || '').trim();

const host = rawUrl
  .replace(/^https?:\/\//, '')
  .replace(/:[0-9]+.*$/, '')
  .replace(/\/.*$/, '');

const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

const qdrantClient = host
  ? new QdrantClient({
      host: host,
      port: 443,
      https: true,
      apiKey: QDRANT_API_KEY,
      checkCompatibility: false
    })
  : null;

module.exports = {
  qdrantClient,
  client: qdrantClient,

  checkQdrantConnection: async () => {
    if (!qdrantClient) return false;
    try {
      const res = await qdrantClient.getCollections();
      console.log(`✅ Qdrant подключен (коллекций: ${res.collections.length})`);
      return true;
    } catch (e) {
      console.error(`❌ Ошибка Qdrant: ${e.message}`);
      return false;
    }
  },

  upsertVector: async (collectionName, { id, vector, payload }) => {
    if (!qdrantClient) return null;
    return await qdrantClient.upsert(collectionName, {
      points: [{ id, vector, payload }]
    });
  },

  searchSimilar: async (collectionName, queryVector, limit = 10, filter = null) => {
    if (!qdrantClient) return [];

    const options = {
      limit,
      with_payload: true
    };
    if (filter) options.filter = filter;

    // 1. Qdrant JS SDK v1.10+ (Universal Query API)
    if (typeof qdrantClient.query === 'function') {
      const res = await qdrantClient.query(collectionName, {
        query: queryVector,
        ...options
      });
      return res.points || res;
    }

    // 2. qdrantClient.queryPoints
    if (typeof qdrantClient.queryPoints === 'function') {
      const res = await qdrantClient.queryPoints(collectionName, {
        query: queryVector,
        ...options
      });
      return res.points || res;
    }

    // 3. Совместимость со старыми версиями
    if (typeof qdrantClient.search === 'function') {
      return await qdrantClient.search(collectionName, {
        vector: queryVector,
        ...options
      });
    }

    throw new Error('Подходящий метод поиска векторов не найден');
  },

  deleteVector: async (collectionName, id) => {
    if (!qdrantClient) return null;
    return await qdrantClient.delete(collectionName, { points: [id] });
  }
};