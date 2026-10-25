const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const langsDir = path.join(rootDir, 'languages');
const backupDir = path.join(rootDir, 'fix_final_backup_' + Date.now());
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

console.log('📁 Backup dir:', backupDir);

// ============================================================
// 1. ДОБАВЛЯЕМ НЕДОСТАЮЩИЕ КЛЮЧИ (documents, mail)
// ============================================================
const missingKeys = {
  tm: { doc_header_title: '📄 Resmiýetler', mail_header_title: '📬 TM Poçta' },
  ru: { doc_header_title: '📄 Документы',   mail_header_title: '📬 TM Почта' },
  en: { doc_header_title: '📄 Documents',   mail_header_title: '📬 TM Mail' }
};

// ============================================================
// 2. ОБНОВЛЯЕМ ЗНАЧЕНИЯ ДЛЯ МАРКЕТПЛЕЙСА (Birža → Marketpleýs)
// ============================================================
// Ключи, которые могут содержать «Биржу» в нашем проекте:
const marketplaceUpdates = {
  tm: {
    nav_marketplace:      'Marketpleýs',
    module_marketplace:   'Marketpleýs',
    nav_exchange:         'Marketpleýs',
    mod_exchange_title:   'Marketpleýs',
    mp_title:             '🛒 Sfera Marketpleýs',       // оставляем с эмодзи и брендом
    mp_subtitle:          'Şahsy satuwlar • Biznes üpjünçilik • Döwlet satyn alyşlar'
  },
  ru: {
    nav_marketplace:      'Маркетплейс',
    module_marketplace:   'Маркетплейс',
    nav_exchange:         'Маркетплейс',
    mod_exchange_title:   'Маркетплейс',
    mp_title:             '🛒 Сфера Маркетплейс',
    mp_subtitle:          'Частные продажи • Бизнес-поставки • Госзакупки'
  },
  en: {
    nav_marketplace:      'Marketplace',
    module_marketplace:   'Marketplace',
    nav_exchange:         'Marketplace',
    mod_exchange_title:   'Marketplace',
    mp_title:             '🛒 Sfera Marketplace',
    mp_subtitle:          'Private sales • Business supplies • Public procurement'
  }
};

// ============================================================
// 3. ОБРАБОТКА JSON
// ============================================================
for (const lang of ['tm', 'ru', 'en']) {
  const p = path.join(langsDir, lang + '.json');
  if (!fs.existsSync(p)) { console.warn(`⚠️  ${lang}.json не найден`); continue; }

  const raw = fs.readFileSync(p, 'utf8');
  let data;
  try { data = JSON.parse(raw); } catch (e) { console.error(`❌ ${lang}.json:`, e.message); continue; }

  fs.writeFileSync(path.join(backupDir, lang + '.json.bak'), raw, 'utf8');

  let added = 0, updated = 0;

  // 3.1 Добавляем недостающие ключи (только если их нет или они пустые)
  for (const [k, v] of Object.entries(missingKeys[lang])) {
    if (!data[k] || !String(data[k]).trim()) { data[k] = v; added++; }
  }

  // 3.2 Обновляем маркетплейс (только значения, ключи не трогаем)
  for (const [k, v] of Object.entries(marketplaceUpdates[lang])) {
    if (data[k] !== v) { data[k] = v; updated++; }
  }

  // 3.3 Глобальная замена бренда SFERA/СФЕРА → Sfera/Сфера во всех строках
  let brandReplaced = 0;
  const brandRegex = lang === 'ru' ? /СФЕРА/g : /SFERA/g;
  const brandReplace = lang === 'ru' ? 'Сфера' : 'Sfera';
  for (const key of Object.keys(data)) {
    if (typeof data[key] === 'string') {
      const before = data[key];
      const after = before.replace(brandRegex, brandReplace);
      if (before !== after) { data[key] = after; brandReplaced++; }
    }
  }

  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✅ ${lang}.json: +${added} новых, ${updated} обновлений маркетплейса, ${brandReplaced} замен бренда`);
}

// ============================================================
// 4. ОБРАБОТКА HTML
// ============================================================
/**
 * Сеньорский приём: заменяем текст ТОЛЬКО вне <script>...</script>,
 * чтобы не сломать JavaScript и JSON-строки в инлайн-скриптах.
 */
function replaceOutsideScripts(html, transformFn) {
  const parts = html.split(/(<script[\s\S]*?<\/script>)/gi);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) return part; // script-блок — не трогаем
    return transformFn(part);
  }).join('');
}

const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));
let htmlFixed = 0;

for (const file of htmlFiles) {
  const p = path.join(rootDir, file);
  const original = fs.readFileSync(p, 'utf8');

  const transformed = replaceOutsideScripts(original, (chunk) => {
    let c = chunk;
    // 4.1 Бренд
    c = c.replace(/SFERA/g, 'Sfera');
    c = c.replace(/СФЕРА/g, 'Сфера');

    // 4.2 Замена «Биржа» / «Birža» / «Exchange» → маркетплейс
    //    Заменяем только текстовые узлы (между > и <).
    c = c.replace(/>([^<]*?)Birža([^<]*?)</g,
      (_, a, b) => `>${a}Marketpleýs${b}<`);
    c = c.replace(/>([^<]*?)Биржа([^<]*?)</g,
      (_, a, b) => `>${a}Маркетплейс${b}<`);
    c = c.replace(/>([^<]*?)\bExchange\b([^<]*?)</g,
      (_, a, b) => `>${a}Marketplace${b}<`);

    return c;
  });

  if (transformed !== original) {
    fs.writeFileSync(path.join(backupDir, file + '.bak'), original, 'utf8');
    fs.writeFileSync(p, transformed, 'utf8');
    console.log(`✅ ${file}: обновлён (бренд и/или «Биржа» → маркетплейс)`);
    htmlFixed++;
  }
}

// ============================================================
// 5. ОТЧЁТ
// ============================================================
console.log(`\n🎉 Готово. HTML-файлов обновлено: ${htmlFixed}`);
console.log(`Все бэкапы: ${backupDir}`);
console.log('Сделай Hard Reload (Ctrl+Shift+R), чтобы увидеть изменения.');