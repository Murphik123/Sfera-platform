const Parser = require('rss-parser');
const parser = new Parser();

const translationCache = new Map();

async function translateText(text, targetLang) {
    if (!text) return '';
    if (targetLang === 'ru') return text;

    const cacheKey = `${targetLang}_${text.slice(0, 50)}`;
    if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

    const langName = targetLang === 'tm' ? 'Turkmen' : 'English';
    const prompt = `Translate the following text to ${langName}. Return ONLY the translation, without any explanations or quotes:\n\n${text}`;

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
        const translated = data.choices?.[0]?.message?.content?.trim() || text;
        
        translationCache.set(cacheKey, translated);
        return translated;
    } catch (e) {
        console.error('Translation error:', e);
        return text;
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
        news = news.slice(0, 30);

        if (lang !== 'ru') {
            for (let i = 0; i < news.length; i++) {
                news[i].title = await translateText(news[i].title, lang);
            }
        }

        res.json(news);
    } catch (error) {
        console.error('News API Error:', error);
        res.status(500).json({ error: 'Ошибка загрузки новостей' });
    }
};

exports.translateNewsText = async (req, res) => {
    const { text, lang } = req.query;
    if (!text || !lang) return res.json({ text });
    const translated = await translateText(text, lang);
    res.json({ text: translated });
};

exports.getPlatformNews = async (req, res) => {
    const lang = req.query.lang || 'ru';
    let news = [
        { title: "Запуск видеозвонков", content: "Теперь в SFERA доступны аудио- и видеозвонки прямо из мессенджера и других модулей.", date: new Date() },
        { title: "Обновление ИИ-помощника", content: "Sfera AI Kömekçi стал умнее и теперь лучше понимает запросы на туркменском языке.", date: new Date() }
    ];
    
    if (lang !== 'ru') {
        for (let i = 0; i < news.length; i++) {
            news[i].title = await translateText(news[i].title, lang);
            news[i].content = await translateText(news[i].content, lang);
        }
    }
    res.json(news);
};
