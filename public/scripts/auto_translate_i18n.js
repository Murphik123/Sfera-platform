/* ============================================
   SFERA — Глобальная система переводов (i18n)
   Язык по умолчанию: tm (туркменский)
   Сохраняет выбор на всех страницах
   ФИКС: Блокировка браузерного переводчика и валидный ISO-код (tk)
============================================ */

(function () {
    const LANGS = ['tm', 'ru', 'en'];
    const DEFAULT_LANG = 'tm';

    window.translations = {};

    // СЕНЬОРСКИЙ ФИКС №1: Блокируем браузерный переводчик СРАЗУ при загрузке скрипта.
    // Это предотвращает порчу текста Google Translate / Yandex.
    document.documentElement.setAttribute('translate', 'no');

    // Читаем язык из обоих ключей (lang и sfera_lang)
    window.currentLang = localStorage.getItem('lang')
        || localStorage.getItem('sfera_lang')
        || DEFAULT_LANG;

    if (!LANGS.includes(window.currentLang)) {
        window.currentLang = DEFAULT_LANG;
    }
    
    // СЕНЬОРСКИЙ ФИКС №2: Устанавливаем валидный ISO-код для туркменского языка (tk), 
    // чтобы браузер не пытался "угадать" язык по несуществующему коду 'tm'.
    document.documentElement.lang = window.currentLang === 'tm' ? 'tk' : window.currentLang;

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

        // СЕНЬОРСКИЙ ФИКС №3: Обновляем lang при смене языка (tk / ru / en).
        document.documentElement.lang = lang === 'tm' ? 'tk' : lang;

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

    // SFERA-PATCH: MutationObserver для динамических элементов
    function translateNode(node, t) {
        if (node.nodeType === 1) {
            if (node.hasAttribute('data-i18n')) {
                const key = node.getAttribute('data-i18n');
                if (t[key]) node.textContent = t[key];
            }
            if (node.hasAttribute('data-i18n-placeholder')) {
                const key = node.getAttribute('data-i18n-placeholder');
                if (t[key]) node.placeholder = t[key];
            }
            if (node.hasAttribute('data-i18n-title')) {
                const key = node.getAttribute('data-i18n-title');
                if (t[key]) node.title = t[key];
            }
            node.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (t[key]) el.textContent = t[key];
            });
            node.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (t[key]) el.placeholder = t[key];
            });
        }
    }

    const observer = new MutationObserver((mutations) => {
        const t = window.translations[window.currentLang] || {};
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                translateNode(node, t);
            });
        });
    });

    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
    });


    // Экспорт для ручного использования
    window.SFERA_I18N = {
        setLanguage: applyTranslations,
        getLanguage: () => window.currentLang,
        t: (key) => (window.translations[window.currentLang] || {})[key] || key
    };
})();
