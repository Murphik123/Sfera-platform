const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'public', 'bank.html');
let c = fs.readFileSync(file, 'utf8');
const original = c;

// ===== Точечная замена функции t() через маркеры =====
const tStartMarker = 'const t = (key, fallback) => {';
const tStartIdx = c.indexOf(tStartMarker);

if (tStartIdx === -1) {
  console.error('❌ Не найдено начало функции t()');
  process.exit(1);
}

const tEndMarker = '};';
const tEndIdx = c.indexOf(tEndMarker, tStartIdx);
if (tEndIdx === -1) {
  console.error('❌ Не найдено закрытие функции t()');
  process.exit(1);
}

const oldT = c.slice(tStartIdx, tEndIdx + 2);
const newT = `const t = (key, fallback) => {
            if (window.SFERA_I18N && typeof window.SFERA_I18N.t === 'function') {
                const val = window.SFERA_I18N.t(key);
                if (val !== key) return val;
            }
            if (window.i18n && typeof window.i18n.t === 'function') return window.i18n.t(key, fallback);
            return fallback || key;
        };`;

c = c.replace(oldT, newT);
fs.writeFileSync(file, c, 'utf8');

// ===== Проверка =====
console.log('✅ t() обновлён на window.SFERA_I18N');
console.log('\n=== Проверка ===');
const checks = [
  ["window.SFERA_I18N && typeof window.SFERA_I18N.t", 't() использует SFERA_I18N'],
  ["'sfera:languageChanged'", 'event sfera:languageChanged'],
  ["<title data-i18n=\"bank_page_title\">", 'title с data-i18n'],
  ["/scripts/auto_translate_i18n.js", 'правильный скрипт переводчика'],
  ['data-i18n="premium_label"', 'premium_label'],
];
for (const [needle, label] of checks) {
  console.log(c.includes(needle) ? `  ✅ ${label}` : `  ⚠️  ${label}`);
}

// Убедимся, что JS не сломался
console.log('\n=== Проверка синтаксиса JS ===');
const scripts = [...c.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => {
  try { new Function(s); console.log(`  ✅ inline script ${i} OK`); }
  catch (e) { console.log(`  ❌ inline script ${i} ERROR: ${e.message}`); }
});

console.log(c === original ? '\n⚠️ Файл не изменился' : '\n✅ bank.html обновлён');