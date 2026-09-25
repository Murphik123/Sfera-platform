/**
 * Sfera Auth Controller
 * Обработка входа и регистрации пользователей
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authErrorEl = document.getElementById('auth-error');

    // Функция отображения ошибок
    const showError = (message) => {
        if (authErrorEl) {
            authErrorEl.textContent = message;
            authErrorEl.style.display = 'block';
        } else {
            alert(message);
        }
    };

    // ОБРАБОТКА ВХОДА (LOGIN)
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email')?.value.trim();
            const password = document.getElementById('password')?.value.trim();

            if (!email || !password) {
                return showError('Пожалуйста, заполните все поля');
            }

            try {
                const response = await window.api.login(email, password);
                
                if (response.success || response.token) {
                    // Успешный вход — перенаправляем на главную
                    window.location.href = '/index.html';
                } else {
                    showError(response.message || 'Ошибка авторизации');
                }
            } catch (err) {
                showError(err.message || 'Неверный email или пароль');
            }
        });
    }

    // ОБРАБОТКА РЕГИСТРАЦИИ (REGISTER)
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username')?.value.trim();
            const email = document.getElementById('email')?.value.trim();
            const password = document.getElementById('password')?.value.trim();

            if (!username || !email || !password) {
                return showError('Заполните все обязательные поля');
            }

            try {
                const response = await window.api.request('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ username, email, password })
                });

                if (response.success || response.token) {
                    if (response.token) {
                        localStorage.setItem('sfera_token', response.token);
                        localStorage.setItem('sfera_user', JSON.stringify(response.user));
                    }
                    window.location.href = '/index.html';
                } else {
                    showError(response.message || 'Ошибка при регистрации');
                }
            } catch (err) {
                showError(err.message || 'Ошибка регистрации. Возможно, email или имя уже заняты');
            }
        });
    }
});
