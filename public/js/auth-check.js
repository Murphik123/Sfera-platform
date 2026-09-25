// js/auth-check.js — подключить во все HTML файлы проекта
(function () {
    const token = localStorage.getItem('token') || localStorage.getItem('sfera_token');
    const userRaw = localStorage.getItem('user');
    let user = null;

    try {
        user = userRaw ? JSON.parse(userRaw) : null;
    } catch (e) {
        user = null;
    }

    const role = user?.role || localStorage.getItem('sfera_role') || 'guest';

    window.SFERA_AUTH = {
        token: token,
        user: user,
        role: role,
        isAdmin: role === 'admin'
    };

    // Если закрытый раздел admin.html пытается открыть не-админ
    if (window.location.pathname.includes('admin.html') && role !== 'admin') {
        window.location.href = 'login.html';
    }
})();

// Перехватчик всех fetch-запросов для автоматической передачи токена
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
    const token = localStorage.getItem('token') || localStorage.getItem('sfera_token');
    options.headers = options.headers || {};

    if (token) {
        if (options.headers instanceof Headers) {
            options.headers.append('Authorization', `Bearer ${token}`);
        } else {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
    }
    return originalFetch(url, options);
};
// ==========================================
// Универсальная обработка кнопок "Выход" и "Назад"
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Делегирование кликов на весь документ
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('button, a, div, span');
        if (!target) return;

        // Определяем идентификаторы элемента
        const id = (target.id || '').toLowerCase();
        const className = (target.className || '').toString().toLowerCase();
        const action = (target.getAttribute('data-action') || '').toLowerCase();
        const text = (target.textContent || '').trim().toLowerCase();

        // 1. Проверка кнопки "Выход"
        const isLogout = id.includes('logout') || 
                         className.includes('logout') || 
                         action === 'logout' || 
                         text === 'выход' || 
                         text === 'чыкмак' || 
                         text === 'exit';

        if (isLogout) {
            e.preventDefault();
            try {
                if (typeof api !== 'undefined' && api.post) {
                    await api.post('/api/auth/logout');
                } else {
                    await fetch('/api/auth/logout', { method: 'POST' });
                }
            } catch (err) {
                console.warn('Ошибка при выходе на бэкенде:', err);
            } finally {
                localStorage.removeItem('token');
                localStorage.removeItem('sfera_token');
                localStorage.removeItem('user');
                sessionStorage.clear();
                window.location.href = 'login.html';
            }
            return;
        }

        // 2. Проверка кнопки "Назад"
        const isBack = id.includes('back') || 
                       className.includes('back') || 
                       action === 'back' || 
                       text === 'назад' || 
                       text === 'ызына' || 
                       text === 'go back';

        if (isBack) {
            e.preventDefault();
            if (window.history.length > 1 && document.referrer) {
                window.history.back();
            } else {
                window.location.href = 'dashboard.html';
            }
        }
    });
});
