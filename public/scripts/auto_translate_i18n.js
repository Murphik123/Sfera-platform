/* ============================================
   SFERA — Глобальная система переводов (i18n)
   Язык по умолчанию: tm (туркменский)
   Сохраняет выбор на всех страницах
============================================ */

(function () {
    const LANGS = ['tm', 'ru', 'en'];
    const DEFAULT_LANG = 'tm';

    window.translations = {};

    // Читаем язык из обоих ключей (lang и sfera_lang)
    window.currentLang = localStorage.getItem('lang')
        || localStorage.getItem('sfera_lang')
        || DEFAULT_LANG;

    if (!LANGS.includes(window.currentLang)) {
        window.currentLang = DEFAULT_LANG;
    }
    // Пишем в оба ключа сразу
    localStorage.setItem('lang', window.currentLang);
    localStorage.setItem('sfera_lang', window.currentLang);

    async function loadTranslations(lang) {
        try {
            const response = await fetch(`/languages/${lang}.json`);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            window.translations[lang] = data;
            return data;
        } catch (e) {
            console.warn(`Не удалось загрузить ${lang}.json, используем фолбэк.`);
            return {
                logo_subtitle: lang === 'tm' ? 'Milli Sanly Platforma' : lang === 'ru' ? 'Национальная Цифровая Платформа' : 'National Digital Platform',
                logout: lang === 'tm' ? '🚪 Çykmak' : lang === 'ru' ? '🚪 Выйти' : '🚪 Logout',
                back: lang === 'tm' ? '← Yza' : lang === 'ru' ? '← Назад' : '← Back'
            };
        }
    }

    function applyTranslations(lang) {
        const t = window.translations[lang] || {};

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) el.textContent = t[key];
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (t[key]) el.placeholder = t[key];
        });

        const langBtn = document.getElementById('langBtn');
        if (langBtn) langBtn.textContent = lang.toUpperCase();

        localStorage.setItem('lang', lang);
        localStorage.setItem('sfera_lang', lang);
        window.currentLang = lang;

        // Сообщаем другим скриптам, что язык сменился
        window.dispatchEvent(new CustomEvent('sfera:languageChanged', { detail: { lang } }));
    }

    async function initI18n() {
        await Promise.all(LANGS.map(lang => loadTranslations(lang)));
        applyTranslations(window.currentLang);

        // Перезаписываем обработчик langBtn, чтобы не было дублей
        const langBtn = document.getElementById('langBtn');
        if (langBtn) {
            const newBtn = langBtn.cloneNode(true); // клон сбрасывает все обработчики
            langBtn.parentNode.replaceChild(newBtn, langBtn);
            newBtn.textContent = window.currentLang.toUpperCase();
            newBtn.addEventListener('click', () => {
                const nextIndex = (LANGS.indexOf(window.currentLang) + 1) % LANGS.length;
                applyTranslations(LANGS[nextIndex]);
            });
        }
    }

    document.addEventListener('DOMContentLoaded', initI18n);

    // Экспорт для ручного использования
    window.SFERA_I18N = {
        setLanguage: applyTranslations,
        getLanguage: () => window.currentLang,
        t: (key) => (window.translations[window.currentLang] || {})[key] || key
    };
})();