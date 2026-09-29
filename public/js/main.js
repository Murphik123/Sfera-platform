/**
 * Главный скрипт платформы "СФЕРА" (без ES-модулей)
 * Отвечает за навигацию, сессии и глобальные события
 */
(function () {
    /**
     * Обработка кнопки "Назад" (#btn-back, .btn-back)
     */
    function setupBackButton() {
        document.addEventListener('click', function (e) {
            const backBtn = e.target.closest('#btn-back, .btn-back');
            if (backBtn) {
                e.preventDefault();
                const backRole = (window.SFERA_AUTH && window.SFERA_AUTH.role) || localStorage.getItem('sfera_role') || 'user';
                const backUrl = backRole === 'admin' ? '/admin.html' : '/dashboard.html';
                if (window.location.pathname !== backUrl) {
                    window.location.href = backUrl;
                }
            }
        });
    }

    /**
     * Обработка кнопки "Выйти" (#btn-logout, .btn-logout)
     */
    function setupLogoutButton() {
        document.addEventListener('click', function (e) {
            const logoutBtn = e.target.closest('#btn-logout, .btn-logout');
            if (logoutBtn) {
                e.preventDefault();
                
                // Очистка сессии пользователя
                localStorage.removeItem('token');
                localStorage.removeItem('sfera_token');
                localStorage.removeItem('user');
                localStorage.removeItem('sfera_user');
                localStorage.removeItem('sfera_role');
                sessionStorage.clear();

                // Перенаправление на страницу входа
                window.location.href = 'login.html';
            }
        });
    }

    /**
     * Проверка состояния авторизации пользователя
     */
    function checkAuthStatus() {
        const token = localStorage.getItem('sfera_token');
        const user = localStorage.getItem('sfera_user') || localStorage.getItem('user');
        const currentPage = window.location.pathname.split('/').pop();

        // Защищенные страницы, требующие авторизации
        const protectedPages = ['dashboard.html', 'marketplace.html'];

        if (protectedPages.includes(currentPage) && !token) {
            console.warn('[AUTH] Доступ ограничен. Перенаправление на login.html');
            // window.location.href = 'login.html'; // Расскоментировать при необходимости жесткой защиты
        }

        // Если пользователь авторизован, обновляем имя в шапке
        if (user) {
            try {
                const userData = JSON.parse(user);
                const userNameEl = document.getElementById('user-name') || document.querySelector('.user-profile-name');
                if (userNameEl && (userData.name || userData.username)) {
                    userNameEl.textContent = userData.name || userData.username;
                }
            } catch (err) {
                console.error('[AUTH] Ошибка парсинга данных пользователя:', err);
            }
        }
    }

    /**
     * Инициализация всех модулей
     */
    function init() {
        setupBackButton();
        setupLogoutButton();
        checkAuthStatus();
        
        console.log('[SFERA] Платформа успешно инициализирована.');
    }

    // Экспорт базовых функций в window
    window.SferaApp = {
        init: init,
        logout: () => {
            localStorage.removeItem('token');
            localStorage.removeItem('sfera_token');
            localStorage.removeItem('user');
            localStorage.removeItem('sfera_user');
            localStorage.removeItem('sfera_role');
            sessionStorage.clear();
            window.location.href = 'login.html';
        }
    };

    // Запуск при готовности DOM
    document.addEventListener('DOMContentLoaded', init);
})();
