const fs = require('fs');
const path = require('path');

const langsDir = path.join(__dirname, 'languages');
const backupDir = path.join(__dirname, 'safe_json_fix_backup_' + Date.now());
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

console.log('📁 Backup:', backupDir);

const rules = {
  tm: [
    { find: /SFERA/g, replace: 'Sfera' },
    { find: /(data-i18n[^>]*>)?\bBirža\b/g, replace: (m) => m.replace('Birža', 'Marketpleýs') }
  ],
  ru: [
    { find: /СФЕРА/g, replace: 'Сфера' },
    { find: /\bБиржа\b/g, replace: 'Маркетплейс' }
  ],
  en: [
    { find: /SFERA/g, replace: 'Sfera' },
    { find: /\bExchange\b/g, replace: 'Marketplace' }
  ]
};

// Точные ключи, которые надо поправить (без глобального регекса по всему файлу — только значения)
const keyUpdates = {
  tm: {
    nav_marketplace: 'Marketpleýs',
    module_marketplace: 'Marketpleýs',
    nav_exchange: 'Marketpleýs',
    mod_exchange_title: 'Marketpleýs',
    mp_title: '🛒 Sfera Marketpleýs'
  },
  ru: {
    nav_marketplace: 'Маркетплейс',
    module_marketplace: 'Маркетплейс',
    nav_exchange: 'Маркетплейс',
    mod_exchange_title: 'Маркетплейс',
    mp_title: '🛒 Сфера Маркетплейс'
  },
  en: {
    nav_marketplace: 'Marketplace',
    module_marketplace: 'Marketplace',
    nav_exchange: 'Marketplace',
    mod_exchange_title: 'Marketplace',
    mp_title: '🛒 Sfera Marketplace'
  }
};

for (const lang of ['tm', 'ru', 'en']) {
  const p = path.join(langsDir, lang + '.json');
  if (!fs.existsSync(p)) {
    console.warn(`⚠️  ${lang}.json не найден`);
    continue;
  }

  const raw = fs.readFileSync(p, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`❌ ${lang}.json не парсится:`, e.message);
    process.exit(1); // не ломаем дальше
  }

  fs.writeFileSync(path.join(backupDir, lang + '.json.bak'), raw, 'utf8');

  // 1. Глобальная замена бренда и Birža во всех строковых значениях
  let brandCount = 0;
  const { rules: langRules } = { rules: rules[lang] };

  for (const key of Object.keys(data)) {
    if (typeof data[key] === 'string') {
      const before = data[key];
      let after = before;
      for (const r of langRules) {
        after = after.replace(r.find, r.replace);
      }
      if (before !== after) {
        data[key] = after;
        brandCount++;
      }
    }
  }

  // 2. Точечные правки маркетплейса (гарантированно правильно, без регекса)
  let mktCount = 0;
  for (const [key, val] of Object.entries(keyUpdates[lang])) {
    if (data[key] !== val) {
      data[key] = val;
      mktCount++;
    }
  }

  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✅ ${lang}.json: ${brandCount} замен бренда/Birža, ${mktCount} правок маркетплейса`);
}

console.log('\n🎉 Готово. Проверка JSON не сломана (parse OK).');
console.log('Бэкапы:', backupDir);