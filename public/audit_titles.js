const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const langsDir = path.join(rootDir, 'languages');
const langFiles = ['tm.json', 'ru.json', 'en.json'];

const langsData = {};
for (const f of langFiles) {
  const p = path.join(langsDir, f);
  if (fs.existsSync(p)) {
    langsData[f.replace('.json', '')] = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
}

const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));

console.log('=== AUDIT: <title> and <h1> data-i18n ===\n');

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(rootDir, file), 'utf8');

  // <title>
  const titleMatch = content.match(/<title[^>]*data-i18n="([^"]+)"[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    const [, key, staticText] = titleMatch;
    console.log(`📄 ${file}`);
    console.log(`   <title> key="${key}" static="${staticText.trim()}"`);
    console.log(`   -> tm: "${(langsData.tm?.[key] || '(missing)').slice(0, 60)}"`);
    console.log(`   -> ru: "${(langsData.ru?.[key] || '(missing)').slice(0, 60)}"`);
    console.log(`   -> en: "${(langsData.en?.[key] || '(missing)').slice(0, 60)}"`);

    // Проверка подозрительных ключей
    const expectedPrefix = file.replace('.html', '').split('_')[0];
    if (!key.includes(expectedPrefix) && !key.startsWith('index') && !key.startsWith('login')) {
      console.log(`   ⚠️  SUSPICIOUS: key "${key}" doesn't match file "${file}"`);
    }
  } else {
    console.log(`📄 ${file}: <title> without data-i18n`);
  }

  // <h1>
  const h1Match = content.match(/<h1[^>]*data-i18n="([^"]+)"[^>]*>([^<]*)<\/h1>/i);
  if (h1Match) {
    const [, key, staticText] = h1Match;
    const tmVal = (langsData.tm?.[key] || '(missing)').slice(0, 60);
    console.log(`   <h1> key="${key}" static="${staticText.trim()}" -> tm: "${tmVal}"`);
  }
  console.log('');
}