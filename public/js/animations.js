/**
 * SFERA Platform — Animations Utilities
 * Version: 1.0
 */

/**
 * Анимирует счётчик от 0 до target
 * @param {HTMLElement} element - DOM-элемент, куда выводить число
 * @param {number} target - конечное значение
 * @param {number} duration - длительность анимации в мс
 */
export function animateCounter(element, target, duration = 3000) {
    if (!element) return;
    let start = 0;
    const stepTime = 16;
    const steps = Math.floor(duration / stepTime);
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current).toLocaleString('ru-RU');
    }, stepTime);
}

/**
 * Плавное появление элемента при скролле (Intersection Observer)
 * @param {string} selector - CSS-селектор для элементов
 * @param {string} activeClass - класс, добавляемый при появлении (по умолчанию 'visible')
 */
export function initScrollReveal(selector = '.reveal', activeClass = 'visible') {
    const elements = document.querySelectorAll(selector);
    if (!elements.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add(activeClass);
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    });

    elements.forEach(el => observer.observe(el));
}

/**
 * Анимация с задержкой для элементов (последовательное появление)
 * @param {string} selector - селектор элементов
 * @param {number} stagger - задержка между элементами (мс)
 * @param {string} activeClass - класс для активации
 */
export function staggerReveal(selector = '.stagger', stagger = 100, activeClass = 'visible') {
    const items = document.querySelectorAll(selector);
    items.forEach((el, index) => {
        setTimeout(() => {
            el.classList.add(activeClass);
        }, index * stagger);
    });
}

/**
 * Обновление статистики с сервера (пример)
 * @param {string} endpoint - URL для получения данных
 * @param {Object} counterMap - объект { elementId: 'dataKey' }
 */
export async function loadStatsWithAnimation(endpoint = '/api/stats', counterMap) {
    try {
        const response = await fetch(endpoint);
        const data = await response.json();
        for (const [elId, key] of Object.entries(counterMap)) {
            const el = document.getElementById(elId);
            if (el && data[key] !== undefined) {
                animateCounter(el, data[key]);
            }
        }
    } catch (error) {
        console.warn('Не удалось загрузить статистику:', error);
    }
}
