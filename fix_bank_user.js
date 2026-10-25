const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'public', 'bank.html');
let c = fs.readFileSync(file, 'utf8');
const original = c;

// ===== 1. Логотип: добавить data-i18n и корректный бренд =====
const logoOld = '<h2>SFERA</h2>';
const logoNew = '<h2 data-i18n="logo_title">Sfera</h2>';
if (c.includes(logoOld)) {
  c = c.replace(logoOld, logoNew);
  console.log('✅ logo: <h2>SFERA</h2> → <h2 data-i18n="logo_title">Sfera</h2>');
} else {
  console.log('ℹ️ logo: <h2>SFERA</h2> не найден (возможно, уже исправлен)');
}

// ===== 2. Функция populateUsername() + вызов =====
if (!c.includes('function populateUsername()')) {
  const anchor = 'function renderParticles() {';
  const populateFn = `function populateUsername() {
            const el = document.getElementById('username');
            if (!el) return;
            let user = null;
            try {
                const raw = localStorage.getItem('sfera_user') || localStorage.getItem('user');
                if (raw) user = JSON.parse(raw);
            } catch (e) {}
            if (user && (user.username || user.name)) {
                el.textContent = user.username || user.name;
                return;
            }
            if (window.api && typeof window.api.getCurrentUser === 'function') {
                Promise.resolve(window.api.getCurrentUser()).then(u => {
                    if (u && (u.username || u.name)) el.textContent = u.username || u.name;
                }).catch(() => {});
            }
        }

        `;
  c = c.replace(anchor, populateFn + anchor);
  console.log('✅ добавлена функция populateUsername()');
} else {
  console.log('ℹ️ populateUsername() уже определена');
}

if (!c.includes('populateUsername();')) {
  const callAnchor = '        loadBankData();';
  if (c.includes(callAnchor)) {
    c = c.replace(callAnchor, callAnchor + '\n        populateUsername();');
    console.log('✅ добавлен вызов populateUsername()');
  } else {
    console.log('⚠️ не найден якорь "loadBankData();" для вставки вызова');
  }
} else {
  console.log('ℹ️ вызов populateUsername() уже есть');
}

fs.writeFileSync(file, c, 'utf8');

// ===== Проверка =====
console.log('\n=== Проверка ===');
const checks = [
  ['<h2 data-i18n="logo_title">Sfera</h2>', 'logo с data-i18n'],
  ['function populateUsername()', 'функция populateUsername'],
  ['populateUsername();', 'вызов populateUsername'],
];
for (const [needle, label] of checks) {
  console.log(c.includes(needle) ? `  ✅ ${label}` : `  ⚠️ ${label} — проверь вручную`);
}

// Синтаксис JS
console.log('\n=== Синтаксис JS ===');
const scripts = [...c.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => {
  try { new Function(s); console.log(`  ✅ inline script ${i} OK`); }
  catch (e) { console.log(`  ❌ inline script ${i}: ${e.message}`); }
});

console.log(c !== original ? '\n✅ bank.html обновлён' : '\n⚠️ bank.html без изменений');