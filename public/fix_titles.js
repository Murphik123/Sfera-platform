const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const langsDir = path.join(rootDir, 'languages');
const backupDir = path.join(rootDir, 'fix_titles_backup_' + Date.now());

if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
console.log('📁 Backup dir:', backupDir);

// ---------- 1. ТОЧЕЧНЫЕ ПРАВКИ HTML (Фикс бага с page_title) ----------
// Заменяем неуникальный data-i18n="page_title" на уникальные ключи.
const htmlFixes = {
  'ai.html': [
    { find: '<h1 data-i18n="page_title">', replace: '<h1 data-i18n="ai_header_title">' }
  ],
  'bank.html': [
    { find: '<h1 data-i18n="page_title">', replace: '<h1 data-i18n="bank_header_title">' }
  ],
  'tm-coin.html': [
    { find: '<h1 data-i18n="page_title">', replace: '<h1 data-i18n="coin_header_title">' }
  ],
  'tm-pay.html': [
    { find: '<title data-i18n="page_title">', replace: '<title data-i18n="pay_page_title">' },
    { find: '<h1 data-i18n="page_title">', replace: '<h1 data-i18n="pay_header_title">' }
  ]
};

for (const [file, fixes] of Object.entries(htmlFixes)) {
  const p = path.join(rootDir, file);
  if (!fs.existsSync(p)) {
    console.warn(`⚠️  ${file} не найден, пропускаем`);
    continue;
  }
  let content = fs.readFileSync(p, 'utf8');
  const original = content;
  let applied = 0;

  for (const { find, replace } of fixes) {
    if (content.includes(find)) {
      content = content.replace(find, replace);
      applied++;
    }
  }

  if (content !== original) {
    fs.writeFileSync(path.join(backupDir, file + '.bak'), original, 'utf8');
    fs.writeFileSync(p, content, 'utf8');
    console.log(`✅ ${file}: исправлено ключей - ${applied}`);
  } else {
    console.log(`ℹ️  ${file}: изменений нет`);
  }
}

// ---------- 2. ДОБАВЛЕНИЕ НОВЫХ КЛЮЧЕЙ В JSON ----------
const newKeys = {
  tm: {
    admin_page_title:   'Sfera — Administrasiýa paneli',
    ai_page_title:      'Sfera — AI analitika',
    ai_header_title:    '🤖 AI analitika & Kömekçi',
    bank_header_title:  '🏦 TM Bank',
    coin_header_title:  '₮ TM Coin',
    doc_page_title:     'Sfera — Resmiýetler',
    index_page_title:   'Sfera — Türkmenistanyň Birleşdirilen Sanly Platformasy',
    login_page_title:   'Sfera — Giriş',
    mail_page_title:    'Sfera — TM Poçta',
    mp_page_title:      'Sfera — Marketpleýs',
    pay_page_title:     'Sfera — TM Pay',
    pay_header_title:   '💳 TM Pay',
  },
  ru: {
    admin_page_title:   'Сфера — Административная панель',
    ai_page_title:      'Сфера — AI аналитика',
    ai_header_title:    '🤖 AI аналитика & Помощник',
    bank_header_title:  '🏦 TM Bank',
    coin_header_title:  '₮ TM Coin',
    doc_page_title:     'Сфера — Документы',
    index_page_title:   'Сфера — Единая цифровая платформа Туркменистана',
    login_page_title:   'Сфера — Вход',
    mail_page_title:    'Сфера — TM Почта',
    mp_page_title:      'Сфера — Маркетплейс',
    pay_page_title:     'Сфера — TM Pay',
    pay_header_title:   '💳 TM Pay',
  },
  en: {
    admin_page_title:   'Sfera — Admin Panel',
    ai_page_title:      'Sfera — AI Analytics',
    ai_header_title:    '🤖 AI Analytics & Assistant',
    bank_header_title:  '🏦 TM Bank',
    coin_header_title:  '₮ TM Coin',
    doc_page_title:     'Sfera — Documents',
    index_page_title:   'Sfera — United Digital Platform of Turkmenistan',
    login_page_title:   'Sfera — Login',
    mail_page_title:    'Sfera — TM Mail',
    mp_page_title:      'Sfera — Marketplace',
    pay_page_title:     'Sfera — TM Pay',
    pay_header_title:   '💳 TM Pay',
  }
};

// ---------- 3. ОБРАБОТКА JSON: ДОБАВЛЕНИЕ КЛЮЧЕЙ И ЗАМЕНА БРЕНДА ----------
const brandReplacements = {
  tm: { regex: /SFERA/g, replacement: 'Sfera' },
  en: { regex: /SFERA/g, replacement: 'Sfera' },
  ru: { regex: /СФЕРА/g, replacement: 'Сфера' }
};

for (const lang of ['tm', 'ru', 'en']) {
  const p = path.join(langsDir, lang + '.json');
  if (!fs.existsSync(p)) {
    console.warn(`⚠️  ${lang}.json не найден, пропускаем`);
    continue;
  }

  const raw = fs.readFileSync(p, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`❌ Ошибка парсинга ${lang}.json:`, e.message);
    continue;
  }

  fs.writeFileSync(path.join(backupDir, lang + '.json.bak'), raw, 'utf8');

  let added = 0;
  let updated = 0;
  let brandReplaced = 0;

  // 3.1 Добавляем новые ключи (если их нет)
  for (const [key, value] of Object.entries(newKeys[lang])) {
    if (!(key in data)) {
      data[key] = value;
      added++;
    } else if (!data[key] || data[key].trim() === '') {
      data[key] = value;
      updated++;
    }
  }

  // 3.2 Проходим по ВСЕМ строкам и заменяем бренд
  const { regex, replacement } = brandReplacements[lang];
  for (const key of Object.keys(data)) {
    if (typeof data[key] === 'string') {
      const originalText = data[key];
      const newText = originalText.replace(regex, replacement);
      if (originalText !== newText) {
        data[key] = newText;
        brandReplaced++;
      }
    }
  }

  // Сохраняем результат
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✅ ${lang}.json: +${added} новых ключей, ${updated} заполнено, ${brandReplaced} замен бренда (SFERA -> Sfera)`);
}

// ---------- 4. ОТЧЕТ ПО ЗАВЕРШЕНИЮ ----------
console.log('\n🎉 Готово!');
console.log('Все бэкапы сохранены в:', backupDir);
console.log('Теперь запусти аудит для проверки: node audit_titles.js');