const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { ProxyAgent, fetch } = require('undici');

function getLocalEmbedding(text) {
  const dimensions = 384;
  const vector = new Array(dimensions).fill(0);
  if (!text || typeof text !== 'string') return vector;

  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);
  const tokens = [...words];

  for (let i = 0; i < normalized.length - 2; i++) {
    tokens.push(normalized.slice(i, i + 3));
  }

  tokens.forEach((token) => {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash << 5) - hash + token.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % dimensions;
    vector[index] += 1;
  });

  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vector;

  return vector.map((val) => Number((val / magnitude).toFixed(6)));
}

async function getEmbedding(text) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');

  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY не найден в .env, используется локальный генератор (384d)');
    return getLocalEmbedding(text);
  }

  try {
    // Включаем прокси только на локальной машине, на Render прокси автоматически отключается
    const useProxy = process.env.USE_PROXY === 'true' && !process.env.RENDER;
    const proxyUrl = process.env.PROXY_URL || 'http://127.0.0.1:65171';

    // Рабочие модели из вашего списка
    const models = ['gemini-embedding-001', 'gemini-embedding-2'];

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;

      const fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            parts: [{ text: text || '' }]
          }
        })
      };

      if (useProxy && proxyUrl) {
        fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
      }

      const response = await fetch(url, fetchOptions);
      const data = await response.json();

      if (data.embedding && data.embedding.values) {
        return data.embedding.values;
      }
    }

    console.warn('⚠️ Не удалось получить вектор от Gemini, используется локальный генератор (384d)');
    return getLocalEmbedding(text);
  } catch (error) {
    console.error('❌ Ошибка сети при запросе к Gemini API:', error.message || error);
    return getLocalEmbedding(text);
  }
}

module.exports = getEmbedding;
