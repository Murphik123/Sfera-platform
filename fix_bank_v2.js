const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'public', 'bank.html');
let c = fs.readFileSync(file, 'utf8');
const original = c;

// ===== Фикс 1. Заменить t() — точный блок =====
const oldT = `            if (window.i18n && typeof window.i18n.t === 'function') return window.i18n.t(key, fallback);
            return fallback || key;`;

const newT = `            if (window.SFERA_I18N && typeof window.SFERA_I18N.t === 'function') {
                const val = window.SFERA_I18N.t(key);
                if (val !== key) return val;
            }
            if (window.i18n && typeof window.i18n.t === 'function') return window.i18n.t(key, fallback);
            return fallback || key;`;

if (c.includes(oldT)) {
  c = c.replace(oldT, newT);
  console.log('✅ t() обновлён: добавлена проверка window.SFERA_I18N.t');
} else {
  console.log('ℹ️ t() уже обновлён (SFERA_I18N уже есть внутри)');
}

// ===== Фикс 2. Имя события + фолбэк =====
const oldEvent = `addEventListener('sfera:language-changed',()=>{
            document.title=t('bank_page_title','SFERA — TM Bank');`;

const newEvent = `addEventListener('sfera:languageChanged',()=>{
            document.title=t('bank_page_title','Sfera — TM Bank');`;

if (c.includes(oldEvent)) {
  c = c.replace(oldEvent, newEvent);
  console.log('✅ Событие обновлено: sfera:language-changed → sfera:languageChanged');
  console.log('✅ Фолбэк обновлён: SFERA → Sfera');
} else {
  console.log('ℹ️ Блок события уже обновлён');
}

// ===== Фикс 3. Запасной вариант для одиночных замен =====
// Если событие по какой-то причине не заменилось одним блоком
if (c.includes("'sfera:language-changed'")) {
  c = c.split("'sfera:language-changed'").join("'sfera:languageChanged'");
  console.log('✅ Замена одиночного sfera:language-changed');
}
c = c.replace(/t\('bank_page_title',\s*'SFERA — TM Bank'\)/g, "t('bank_page_title', 'Sfera — TM Bank')");

// Сохраняем
fs.writeFileSync(file, c, 'utf8');

// Проверка
console.log('\n=== Проверка ===');
const checks = [
  ['SFERA_I18N && typeof window.SFERA_I18N.t', 't() использует SFERA_I18N'],
  ["'sfera:languageChanged'", 'event sfera:languageChanged'],
  ["t('bank_page_title', 'Sfera — TM Bank')", 'фолбэк Sfera — TM Bank'],
];
for (const [needle, label] of checks) {
  console.log(c.includes(needle) ? `  ✅ ${label}` : `  ⚠️  ${label} — не найдено`);
}

// Убедимся, что старых проблем не осталось
const badChecks = [
  ["'sfera:language-changed'", 'старое событие sfera:language-changed'],
  ["'SFERA — TM Bank'", 'старый фолбэк SFERA — TM Bank'],
];
console.log('\n=== Антипроверка (должно быть пусто) ===');
for (const [needle, label] of badChecks) {
  console.log(c.includes(needle) ? `  ❌ ${label} — ещё есть` : `  ✅ ${label} — убрано`);
}

console.log(c === original ? '\n⚠️  Файл не изменился' : '\n✅ bank.html обновлён');