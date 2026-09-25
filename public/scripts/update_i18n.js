const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '..');
const languagesDir = path.join(publicDir, 'languages');
const htmlDir = publicDir;
const backupDir = path.join(publicDir, 'languages_backup_' + Date.now());

if (!fs.existsSync(languagesDir)) {
  console.error('languages folder not found:', languagesDir);
  process.exit(1);
}

if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

// Read existing language files
const langs = ['tm', 'ru', 'en'];
const data = {};
for (const l of langs) {
  const p = path.join(languagesDir, l + '.json');
  if (fs.existsSync(p)) {
    const raw = fs.readFileSync(p, 'utf8');
    try {
      data[l] = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse', p, e);
      data[l] = {};
    }
    // backup
    fs.writeFileSync(path.join(backupDir, l + '.json.bak'), JSON.stringify(data[l], null, 2));
  } else {
    data[l] = {};
  }
}

// Collect HTML files in public
const htmlFiles = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));
console.log('HTML files:', htmlFiles);

const keyMap = {};

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(htmlDir, file), 'utf8');

  // Match data-i18n, data-i18n-placeholder, data-i18n-title, data-i18n-value
  const attrRegex = /(data-i18n(?:-placeholder|-title|-value)?)\s*=\s*\"([^\"]+)\"/g;
  let m;
  while ((m = attrRegex.exec(content)) !== null) {
    const attr = m[1];
    const key = m[2];
    if (!key) continue;
    if (!keyMap[key]) keyMap[key] = { keys: new Set(), examples: [] };
    keyMap[key].keys.add(attr);

    // Try to extract nearby human-readable default text for tm: look after the attribute up to closing tag
    const idx = m.index;
    // find '>' after this position
    const after = content.slice(idx);
    const gt = after.indexOf('>');
    if (gt !== -1) {
      const close = after.indexOf('<', gt + 1);
      if (close !== -1) {
        const txt = after.slice(gt + 1, close).trim();
        if (txt) keyMap[key].examples.push({ file, text: txt });
      }
    }
  }
}

console.log('Found keys:', Object.keys(keyMap).length);

// Merge into language files
let addedCount = 0;
for (const [key, info] of Object.entries(keyMap)) {
  // Determine tm text from examples or fallback to existing tm
  let tmText = data.tm[key];
  if (!tmText) {
    if (info.examples && info.examples.length) {
      tmText = info.examples[0].text;
    } else {
      tmText = '';
    }
  }

  if (!data.tm[key]) {
    data.tm[key] = tmText;
    addedCount++;
  }

  // Ensure ru and en exist; if not, copy tm as placeholder
  if (!data.ru[key]) data.ru[key] = data.tm[key] || '';
  if (!data.en[key]) data.en[key] = data.tm[key] || '';
}

// Save back language files (pretty JSON)
for (const l of langs) {
  const p = path.join(languagesDir, l + '.json');
  fs.writeFileSync(p, JSON.stringify(data[l], null, 2), 'utf8');
}

console.log('Added TM keys:', addedCount);
console.log('Backups saved to', backupDir);
console.log('Done.');
