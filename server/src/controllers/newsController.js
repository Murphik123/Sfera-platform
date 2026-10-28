const Parser = require('rss-parser');
const parser = new Parser();

const translationCache = new Map();

// Функция пакетного перевода через Groq API
async function batchTranslate(newsArray, targetLang) {
    if (targetLang === 'ru' || !newsArray.length) return newsArray;

    const langName = targetLang === 'tm' ? 'Turkmen' : 'English';
    
    // Подготавливаем данные для перевода (только title и content)
    const payload = newsArray.map((item, index) => ({
        id: index,
        title: item.title,
        content: item.content
    }));

    const prompt = `Translate the 'title' and 'content' fields of this JSON array to ${langName}. Return ONLY a valid JSON array of objects with the exact same structure and 'id'. Do not add any markdown formatting or explanations. JSON: ${JSON.stringify(payload)}`;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-120b',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1
            })
        });

        const data = await response.json();
        let translatedText = data.choices?.[0]?.message?.content?.trim() || '[]';
        
        // Очищаем от markdown-тегов, если Groq их добавил
        translatedText = translatedText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        
        const translatedArray = JSON.parse(translatedText);

        // Собираем обратно
        return newsArray.map((item, index) => {
            const translatedItem = translatedArray.find(t => t.id === index);
            return {
                ...item,
                title: translatedItem ? translatedItem.title : item.title,
                content: translatedItem ? translatedItem.content : item.content
            };
        });

    } catch (e) {
        console.error('Batch translation error:', e);
        return newsArray; // В случае ошибки возвращаем оригинал
    }
}

exports.getWorldNews = async (req, res) => {
    try {
        const lang = req.query.lang || 'ru';
        
        const [turkmenFeed, worldFeed] = await Promise.allSettled([
            parser.parseURL('https://turkmenportal.com/rss'),
            parser.parseURL('https://lenta.ru/rss/news')
        ]);

        let news = [];
        if (turkmenFeed.status === 'fulfilled') {
            news = news.concat(turkmenFeed.value.items.map(item => ({
                id: item.guid || item.link,
                title: item.title,
                link: item.link,
                content: item.contentSnippet || item.content || 'Текст недоступен',
                date: item.pubDate,
                source: 'Turkmenportal 🇹🇲'
            })));
        }

        if (worldFeed.status === 'fulfilled') {
            news = news.concat(worldFeed.value.items.slice(0, 15).map(item => ({
                id: item.guid || item.link,
                title: item.title,
                link: item.link,
                content: item.contentSnippet || 'Текст недоступен',
                date: item.pubDate,
                source: 'Мировые новости 🌍'
            })));
        }

        news.sort((a, b) => new Date(b.date) - new Date(a.date));
        news = news.slice(0, 20); // Берем 20 новостей для перевода

        if (lang !== 'ru') {
            news = await batchTranslate(news, lang);
        }

        res.json(news);
    } catch (error) {
        console.error('News API Error:', error);
        res.status(500).json({ error: 'Ошибка загрузки новостей' });
    }
};

exports.translateNewsText = async (req, res) => {
    // Оставляем на случай, если понадобится точечный перевод
    const { text, lang } = req.query;
    if (!text || !lang) return res.json({ text });
    res.json({ text });
};

exports.getPlatformNews = async (req, res) => {
    const lang = req.query.lang || 'ru';
    let news = [
        { title: "Запуск видеозвонков", content: "Теперь в SFERA доступны аудио- и видеозвонки прямо из мессенджера и других модулей.", date: new Date() },
        { title: "Обновление ИИ-помощника", content: "Sfera AI Kömekçi стал умнее и теперь лучше понимает запросы на туркменском языке.", date: new Date() }
    ];
    
    if (lang !== 'ru') {
        news = await batchTranslate(news, lang);
    }
    res.json(news);
};
