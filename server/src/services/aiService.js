const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/auto';

const SYSTEM_PROMPTS = {
  tm: 'Sen Sfera milli platformasynyň AI kömekçisi. Türkmen dilinde gysga we takyk jogap ber.',
  ru: 'Ты AI-помощник национальной платформы SFERA (Туркменистан). Отвечай кратко и по делу на русском языке.',
  en: 'You are the SFERA national platform AI assistant. Reply briefly and to the point in English.'
};

async function askOpenRouter(messages, lang) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
  const sysPrompt = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.ru;
  const body = {
    model: DEFAULT_MODEL,
    messages: [{ role: 'system', content: sysPrompt }, ...messages],
    max_tokens: 500
  };
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://sfera-platform-1.onrender.com',
      'X-Title': 'SFERA Messenger'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error('OpenRouter ' + res.status + ': ' + errText.slice(0, 200));
  }
  const data = await res.json();
  const reply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!reply) throw new Error('OpenRouter: empty reply');
  return reply;
}

module.exports = { askOpenRouter };
