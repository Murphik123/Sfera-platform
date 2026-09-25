/**
 * SFERA Platform — Theme Module (светлая/тёмная тема)
 * Version: 1.0
 */

const THEME_KEY = 'sfera_theme';
const DEFAULT_THEME = 'dark';

let currentTheme = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;

export function getTheme() {
    return currentTheme;
}

export function setTheme(theme) {
    if (theme !== 'dark' && theme !== 'light') return;
    currentTheme = theme;
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light') {
        root.style.setProperty('--bg-900', '#f0f4f8');
        root.style.setProperty('--bg-800', '#e2e8f0');
        root.style.setProperty('--bg-700', '#cbd5e1');
        root.style.setProperty('--bg-600', '#94a3b8');
        root.style.setProperty('--bg-500', '#64748b');
        root.style.setProperty('--text-primary', '#0f172a');
        root.style.setProperty('--text-secondary', '#1e293b');
        root.style.setProperty('--text-muted', '#475569');
        root.style.setProperty('--glass-bg', 'rgba(255,255,255,0.6)');
        root.style.setProperty('--glass-border', 'rgba(0,0,0,0.12)');
        // ... можно добавить больше переменных
    } else {
        // возвращаем тёмную тему (значения по умолчанию из variables.css)
        root.style.setProperty('--bg-900', '#050B15');
        root.style.setProperty('--bg-800', '#08111E');
        root.style.setProperty('--bg-700', '#0C1827');
        root.style.setProperty('--bg-600', '#102033');
        root.style.setProperty('--bg-500', '#142840');
        root.style.setProperty('--text-primary', '#FFFFFF');
        root.style.setProperty('--text-secondary', '#D7E4F5');
        root.style.setProperty('--text-muted', '#8EA5BF');
        root.style.setProperty('--glass-bg', 'rgba(255,255,255,0.08)');
        root.style.setProperty('--glass-border', 'rgba(255,255,255,0.14)');
    }
}

// Применяем сохранённую тему при загрузке
applyTheme(currentTheme);

// Опционально: экспортируем функцию переключения
export function toggleTheme() {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}
