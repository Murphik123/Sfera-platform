/**
 * SFERA API Client
 * Central authenticated HTTP client.
 *
 * Auth session:
 *   sfera_token
 *   sfera_user
 *
 * IMPORTANT:
 * Role/permissions are NOT trusted from localStorage.
 * USER / ADMIN authorization is enforced by the backend.
 */

(function initSferaApi(global) {
    'use strict';

    const TOKEN_KEY = 'sfera_token';
    const USER_KEY = 'sfera_user';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY) || '';
    }

    function getStoredUser() {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function normalizePath(path) {
        if (!path) return '/api';

        let value = String(path).trim();

        if (!value.startsWith('/')) {
            value = '/' + value;
        }

        if (value === '/api' || value.startsWith('/api/')) {
            return value;
        }

        return '/api' + value;
    }

    async function parseResponse(response) {
        const contentType =
            response.headers.get('content-type') || '';

        let data = {};

        if (contentType.includes('application/json')) {
            data = await response.json().catch(() => ({}));
        } else {
            const text = await response.text().catch(() => '');

            if (text) {
                try {
                    data = JSON.parse(text);
                } catch {
                    data = { message: text };
                }
            }
        }

        if (!response.ok) {
            const error = new Error(
                data?.message ||
                data?.error ||
                `HTTP ${response.status}`
            );

            error.status = response.status;
            error.data = data;

            throw error;
        }

        return data;
    }

    async function request(path, options = {}) {
        const url = normalizePath(path);
        const opts = { ...options };
        const headers = new Headers(opts.headers || {});

        const token = getToken();

        if (token) {
            headers.set(
                'Authorization',
                `Bearer ${token}`
            );
        }

        headers.set(
            'Accept',
            'application/json'
        );

        if (
            opts.body !== undefined &&
            opts.body !== null &&
            typeof opts.body === 'object' &&
            !(opts.body instanceof FormData) &&
            !(opts.body instanceof Blob) &&
            !(opts.body instanceof URLSearchParams)
        ) {
            opts.body = JSON.stringify(opts.body);
        }

        if (
            typeof opts.body === 'string' &&
            !headers.has('Content-Type')
        ) {
            headers.set(
                'Content-Type',
                'application/json'
            );
        }

        const response = await fetch(url, {
            ...opts,
            headers,
            credentials: 'same-origin'
        });

        return parseResponse(response);
    }

    async function login(email, password) {
        const response = await request('/auth/login', {
            method: 'POST',
            body: {
                email,
                password
            }
        });

        if (response?.token) {
            localStorage.setItem(
                TOKEN_KEY,
                response.token
            );
        }

        if (response?.user) {
            localStorage.setItem(
                USER_KEY,
                JSON.stringify(response.user)
            );
        }

        return response;
    }

    async function getProfile() {
        const response = await request('/auth/me');

        if (response?.user) {
            localStorage.setItem(
                USER_KEY,
                JSON.stringify(response.user)
            );
        }

        return response;
    }

    async function getCurrentUser() {
        if (!getToken()) {
            return null;
        }

        try {
            const response = await getProfile();

            return response?.user ||
                   response ||
                   null;
        } catch (error) {
            if (error.status === 401) {
                clearSession();
                return null;
            }

            return getStoredUser();
        }
    }

    async function logout() {
        try {
            if (getToken()) {
                await request('/auth/logout', {
                    method: 'POST'
                });
            }
        } finally {
            clearSession();
        }
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    const api = {
        request,

        get(path, options = {}) {
            return request(path, {
                ...options,
                method: 'GET'
            });
        },

        post(path, body, options = {}) {
            return request(path, {
                ...options,
                method: 'POST',
                body
            });
        },

        put(path, body, options = {}) {
            return request(path, {
                ...options,
                method: 'PUT',
                body
            });
        },

        delete(path, options = {}) {
            return request(path, {
                ...options,
                method: 'DELETE'
            });
        },

        login,
        getProfile,
        getCurrentUser,
        logout,
        clearSession,

        isAuthenticated() {
            return Boolean(getToken());
        },

        getToken,
        getStoredUser
    };

    /*
     * Single global API contract.
     */
    global.api = api;

    /*
     * Existing SFERA UI synchronizer.
     * Business data still comes from backend.
     */
    document.addEventListener(
        'DOMContentLoaded',
        async () => {
            if (!api.isAuthenticated()) {
                return;
            }

            try {
                const profileRes =
                    await api.getProfile();

                const user =
                    profileRes?.user ||
                    profileRes;

                if (user) {
                    document
                        .querySelectorAll(
                            '#user-display-name, .user-display-name'
                        )
                        .forEach(el => {
                            el.textContent =
                                user.username ||
                                'Пользователь';
                        });

                    document
                        .querySelectorAll(
                            '#user-avatar-img, .user-avatar-img'
                        )
                        .forEach(el => {
                            if (user.avatar) {
                                el.src = user.avatar;
                            }
                        });
                }

                try {
                    const walletData =
                        await api.request(
                            '/bank/balance'
                        );

                    document
                        .querySelectorAll(
                            '#user-balance-tmt, .user-balance-tmt'
                        )
                        .forEach(el => {
                            el.textContent =
                                `${walletData?.balance ?? 0} TMT`;
                        });

                    document
                        .querySelectorAll(
                            '#user-balance-tmcoin, .user-balance-tmcoin'
                        )
                        .forEach(el => {
                            el.textContent =
                                `${walletData?.tmCoinBalance ?? 0} TMC`;
                        });

                } catch (err) {
                    console.warn(
                        'SFERA: bank balance unavailable:',
                        err.message
                    );
                }

            } catch (err) {
                console.warn(
                    'SFERA: profile synchronization failed:',
                    err.message
                );
            }
        }
    );

})(window);