const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'public', 'bank.html');
let c = fs.readFileSync(file, 'utf8');
const original = c;

// 1. BOM
c = c.replace(/^\uFEFF/, '');

// 2. html lang + translate
c = c.replace(/<html lang="tm">/, '<html lang="tk" translate="no">');

// 3. title с i18n и Sfera (не SFERA)
c = c.replace(
  /<title>SFERA — TM Bank<\/title>/,
  '<title data-i18n="bank_page_title">Sfera — TM Bank</title>'
);

// 4. правильный скрипт переводчика
c = c.replace(
  /<script src="\/js\/i18n\.js"><\/script>/,
  '<script src="/scripts/auto_translate_i18n.js"></script>'
);

// 5. битые эмодзи в шапке
c = c.replace(/🚪 Г‡ykmak/, '🚪 Çykmak');
c = c.replace(/вџі Täzele/, '⟳ Täzele');
c = c.replace(/в… Premium hyzmat/, '★ Premium hyzmat');

// 6. nested spans внутри data-i18n — вынести ключ в отдельный span
c = c.replace(
  /<div class="account-number" data-i18n="account_label">Hasap: <span id="mainAccount">([^<]*)<\/span><\/div>/,
  '<div class="account-number"><span data-i18n="account_label">Hasap:</span> <span id="mainAccount">$1</span></div>'
);
c = c.replace(
  /<div style="font-size:12px; color:#9fb5c8;" data-i18n="active_since_label">Işjeň: <span id="activeSince">([^<]*)<\/span><\/div>/,
  '<div style="font-size:12px; color:#9fb5c8;"><span data-i18n="active_since_label">Işjeň:</span> <span id="activeSince">$1</span></div>'
);

// 7. убрать принудительный 'TM' на кнопке
c = c.replace(
  /const langButton = document\.getElementById\('langBtn'\);\s*\n\s*if \(langButton\) langButton\.textContent = 'TM';\s*\n/,
  ''
);

// 8. t() — использовать SFERA_I18N.t
c = c.replace(
  /const t = \(key, fallback\) => \{\s*\n\s*if \(window\.i18n && typeof window\.i18n\.t === 'function'\) return window\.i18n\.t\(key, fallback\);\s*\n\s*return fallback \|\| key;\s*\n\};/,
  `const t = (key, fallback) => {
            if (window.SFERA_I18N && typeof window.SFERA_I18N.t === 'function') {
                const val = window.SFERA_I18N.t(key);
                if (val !== key) return val;
            }
            if (window.i18n && typeof window.i18n.t === 'function') return window.i18n.t(key, fallback);
            return fallback || key;
        };`
);

// 9. событие: слушать оба варианта (Changed и changed) + fallback Sfera→SFERA
c = c.replace(
  /addEventListener\('sfera:language-changed',\(\)=>\{\s*\n\s*document\.title=t\('bank_page_title','SFERA — TM Bank'\);\s*\n\s*renderAccounts\(\); renderCards\(\); renderHistory\(\); renderNotifications\(\); populateFromAccounts\(\); updateTotalBalance\(\);\s*\n\}\);/,
  `['sfera:languageChanged', 'sfera:language-changed'].forEach(evt => addEventListener(evt, () => {
            document.title = t('bank_page_title', 'Sfera — TM Bank');
            renderAccounts(); renderCards(); renderHistory(); renderNotifications(); populateFromAccounts(); updateTotalBalance();
        }));`
);

fs.writeFileSync(file, c, 'utf8');

// Отчёт
if (c === original) {
  console.log('⚠️  Ничего не изменилось — проверь, не применены ли фиксы уже');
} else {
  console.log('✅ bank.html: все фиксы применены');
  // Покажем, какие из ключевых строк изменились
  const checks = [
    ['<html lang="tk"', 'html lang'],
    ['data-i18n="bank_page_title"', 'title i18n'],
    ['/scripts/auto_translate_i18n.js', 'правильный скрипт'],
    ['🚪 Çykmak', 'logout эмодзи'],
    ['⟳ Täzele', 'refresh эмодзи'],
    ['★ Premium hyzmat', 'premium эмодзи'],
    ['<span data-i18n="account_label">Hasap:</span>', 'account_label span'],
    ['<span data-i18n="active_since_label">Işjeň:</span>', 'active_since_label span'],
    ['SFERA_I18N && typeof window.SFERA_I18N.t', 'SFERA_I18N.t'],
    ["['sfera:languageChanged', 'sfera:language-changed']", 'event оба'],
  ];
  for (const [needle, label] of checks) {
    console.log(c.includes(needle) ? `  ✅ ${label}` : `  ⚠️  ${label} — проверь вручную`);
  }
}