/**
 * Единый модуль локализации платформы "СФЕРА" (без ES6 export)
 * Язык по умолчанию: Туркменский (tm)
 */
(function () {
    const DEFAULT_LANG = 'tm';
    const SUPPORTED_LANGS = ['tm', 'ru', 'en'];
    
    let currentLang = localStorage.getItem('sfera_lang') || DEFAULT_LANG;
    let fallbackDictionary = {}; // Базовый словарь (tm.json)
    let activeDictionary = {};   // Текущий словарь (ru.json / en.json / tm.json)

    /**
     * Загрузка JSON-файла с переводом
     */
    async function fetchTranslationFile(lang) {
        try {
            const response = await fetch(`./languages/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Не удалось загрузить файл переводов: ${lang}.json`);
            }
            return await response.json();
        } catch (error) {
            console.warn(`[i18n] Ошибка загрузки ${lang}.json:`, error);
            return null;
        }
    }

    /**
     * Инициализация и смены языка
     */
    async function setLanguage(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) {
            lang = DEFAULT_LANG;
        }

        // 1. Всегда загружаем туркменский словарь в качестве запасного (fallback)
        if (Object.keys(fallbackDictionary).length === 0) {
            fallbackDictionary = (await fetchTranslationFile(DEFAULT_LANG)) || {};
        }

        // 2. Загружаем целевой язык
        if (lang === DEFAULT_LANG) {
            activeDictionary = fallbackDictionary;
        } else {
            const loaded = await fetchTranslationFile(lang);
            activeDictionary = loaded || fallbackDictionary;
        }

        currentLang = lang;
        localStorage.setItem('sfera_lang', lang);

        // 3. Обновляем интерфейс
        applyTranslations();
        updateActiveLangUI();
    }

    /**
     * Получение перевода по ключу с fallback на TM
     */
    function t(key) {
        // Проверяем текущий язык -> затем туркменский fallback -> иначе возвращаем сам ключ
        if (activeDictionary && activeDictionary[key] !== undefined && activeDictionary[key] !== "") {
            return activeDictionary[key];
        }
        if (fallbackDictionary && fallbackDictionary[key] !== undefined && fallbackDictionary[key] !== "") {
            return fallbackDictionary[key];
        }
        return key;
    }

    /**
     * Применение переводов к DOM-элементам
     */
    function applyTranslations() {
        // Элементы с атрибутом data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = t(key);

            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.hasAttribute('placeholder')) {
                    el.placeholder = translation;
                } else {
                    el.value = translation;
                }
            } else {
                el.textContent = translation;
            }
        });

        // Элементы с явным указанием плейсхолдера data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = t(key);
        });

        // Элементы с атрибутом title (подсказки)
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = t(key);
        });
    }

    /**
     * Подсветка активной кнопки выбора языка (.lang или .lang-btn)
     */
    function updateActiveLangUI() {
        document.querySelectorAll('.lang, .lang-btn, [data-lang]').forEach(btn => {
            const btnLang = (btn.getAttribute('data-lang') || btn.textContent).toLowerCase().trim();
            if (btnLang === currentLang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Экспорт в глобальный объект window
    window.i18n = {
        init: () => setLanguage(currentLang),
        setLanguage: setLanguage,
        getLang: () => currentLang,
        t: t
    };

    // Слушатель событий при загрузке DOM
    document.addEventListener('DOMContentLoaded', () => {
        window.i18n.init();

        // Делегирование кликов по кнопкам смены языка
        document.addEventListener('click', (e) => {
            const langBtn = e.target.closest('.lang, .lang-btn, [data-lang]');
            if (langBtn) {
                const selectedLang = (langBtn.getAttribute('data-lang') || langBtn.textContent).toLowerCase().trim();
                if (SUPPORTED_LANGS.includes(selectedLang)) {
                    window.i18n.setLanguage(selectedLang);
                }
            }
        });
    });
})();
