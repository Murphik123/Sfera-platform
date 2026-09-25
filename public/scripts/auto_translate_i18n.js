/* ============================================
   SFERA — Глобальная система переводов (i18n)
   Язык по умолчанию: tm (туркменский)
============================================ */

const LANGS = ['tm', 'ru', 'en'];
const DEFAULT_LANG = 'tm';

// Глобальные переменные
window.translations = {};
window.currentLang = localStorage.getItem('lang') || DEFAULT_LANG;

if (!LANGS.includes(window.currentLang)) {
    window.currentLang = DEFAULT_LANG;
    localStorage.setItem('lang', window.currentLang);
}

// Загрузка переводов
async function loadTranslations(lang) {
    try {
        const response = await fetch(`/languages/${lang}.json`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        window.translations[lang] = data;
        return data;
    } catch (e) {
        console.warn(`Не удалось загрузить ${lang}.json, используем фолбэк.`);
        // Фолбэк на случай offline
        return {
            logo_subtitle: lang === 'tm' ? 'Milli Sanly Platforma' : lang === 'ru' ? 'Национальная Цифровая Платформа' : 'National Digital Platform',
            logout: lang === 'tm' ? '🚪 Çykmak' : lang === 'ru' ? '🚪 Выйти' : '🚪 Logout',
            back: lang === 'tm' ? '← Yza' : lang === 'ru' ? '← Назад' : '← Back'
        };
    }
}

// Применение переводов
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
    window.currentLang = lang;
}

// Инициализация
async function initI18n() {
    await Promise.all(LANGS.map(lang => loadTranslations(lang)));
    applyTranslations(window.currentLang);

    const langBtn = document.getElementById('langBtn');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            const nextIndex = (LANGS.indexOf(window.currentLang) + 1) % LANGS.length;
            applyTranslations(LANGS[nextIndex]);
        });
    }
}

// Обработчики кнопок
function initActionButtons() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('username');
            window.location.href = '/login.html';
        });
    }

    /*
    const backLink = document.getElementById('backLink');
    if (backLink) {
        backLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '/index.html';
            }
        });
    }
    */
}
// Запуск после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    initI18n();
    initActionButtons();
});
