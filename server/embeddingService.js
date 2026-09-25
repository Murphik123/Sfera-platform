
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { ProxyAgent, fetch: undiciFetch } = require('undici');

// Условный прокси: включается только при USE_PROXY=true и наличии URL
const proxyUrl = process.env.PROXY_URL || process.env.HTTP_PROXY;
const isProxyEnabled = process.env.USE_PROXY === 'true' && proxyUrl;
const proxyAgent = isProxyEnabled ? new ProxyAgent(proxyUrl) : undefined;

/**
 * Превращает текст в вектор из 768 чисел через Gemini API
 * @param {string} text - Текст для векторизации
 * @returns {Promise<number[]>} - Массив чисел (вектор)
 */
async function getEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Критическая ошибка: GEMINI_API_KEY не найден в переменных окружения.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;

  const fetchOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: 768
    })
  };

  if (proxyAgent) {
    fetchOptions.dispatcher = proxyAgent;
  }

  const response = await undiciFetch(url, fetchOptions);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Gemini API Error: ${data.error.message}`);
  }

  if (!data.embedding || !data.embedding.values) {
    throw new Error('Некорректный ответ от Gemini API: отсутствует вектор');
  }

  return data.embedding.values;
}

module.exports = getEmbedding;