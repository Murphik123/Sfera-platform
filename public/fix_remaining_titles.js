const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const langsDir = path.join(rootDir, 'languages');
const backupDir = path.join(rootDir, 'fix_remaining_backup_' + Date.now());
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

console.log('📁 Backup dir:', backupDir);

// ============================================================
// 1. Какие файлы и какие ключи/значения использовать
// ============================================================
const titleFixes = {
  'bank.html': {
    key: 'bank_page_title',
    values: {
      tm: 'Sfera — TM Bank',
      ru: 'Сфера — TM Bank',
      en: 'Sfera — TM Bank'
    }
  },
  'register.html': {
    key: 'register_page_title',
    values: {
      tm: 'Sfera — Hasap döretmek',
      ru: 'Сфера — Регистрация',
      en: 'Sfera — Register'
    }
  },
  'tm-coin.html': {
    key: 'coin_page_title',
    values: {
      tm: 'Sfera — TM Coin',
      ru: 'Сфера — TM Coin',
      en: 'Sfera — TM Coin'
    }
  }
};

// ============================================================
// 2. Обновляем HTML: добавляем data-i18n к <title>
// ============================================================
for (const [file, cfg] of Object.entries(titleFixes)) {
  const p = path.join(rootDir, file);
  if (!fs.existsSync(p)) {
    console.warn(`⚠️  ${file} не найден, пропускаем`);
    continue;
  }

  const original = fs.readFileSync(p, 'utf8');
  let content = original;

  // Заменяем <title ...>...</title>, вставляя data-i18n, если его нет.
  // Статический текст ставим в tm (язык по умолчанию) — чтобы не было
  // мерцания до применения i18n-переводчика.
  content = content.replace(
    /<title([^>]*)>([^<]*)<\/title>/i,
    (match, attrs, text) => {
      if (/data-i18n\s*=/i.test(attrs)) {
        console.log(`ℹ️  ${file}: data-i18n уже стоит — пропускаем`);
        return match;
      }
      return `<title data-i18n="${cfg.key}"${attrs}>${cfg.values.tm}</title>`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(path.join(backupDir, file + '.bak'), original, 'utf8');
    fs.writeFileSync(p, content, 'utf8');
    console.log(`✅ ${file}: <title> получил data-i18n="${cfg.key}"`);
  } else {
    console.log(`ℹ️  ${file}: без изменений`);
  }
}

// ============================================================
// 3. Обновляем JSON: добавляем новые ключи
// ============================================================
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
    console.error(`❌ ${lang}.json:`, e.message);
    continue;
  }

  fs.writeFileSync(path.join(backupDir, lang + '.json.bak'), raw, 'utf8');

  let added = 0, updated = 0;
  for (const [, cfg] of Object.entries(titleFixes)) {
    const wanted = cfg.values[lang];
    if (!wanted) continue;
    if (!(cfg.key in data)) {
      data[cfg.key] = wanted;
      added++;
    } else if (!data[cfg.key] || !String(data[cfg.key]).trim()) {
      data[cfg.key] = wanted;
      updated++;
    }
  }

  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✅ ${lang}.json: +${added} новых, ${updated} заполнено пустых`);
}

// ============================================================
// 4. Финальная проверка
// ============================================================
console.log('\n=== Проверка ===');
for (const [file, cfg] of Object.entries(titleFixes)) {
  const p = path.join(rootDir, file);
  if (!fs.existsSync(p)) continue;
  const html = fs.readFileSync(p, 'utf8');
  const m = html.match(/<title[^>]*data-i18n="([^"]+)"[^>]*>([^<]*)<\/title>/i);
  if (m && m[1] === cfg.key) {
    console.log(`✅ ${file}: <title data-i18n="${m[1]}">${m[2]}</title>`);
  } else {
    console.log(`⚠️  ${file}: data-i18n не найден в <title>`);
  }
}

console.log(`\n🎉 Готово. Бэкапы: ${backupDir}`);