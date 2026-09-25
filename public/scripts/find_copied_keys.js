const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '..', 'languages');
const tm = JSON.parse(fs.readFileSync(path.join(dir, 'tm.json'), 'utf8'));
const ru = JSON.parse(fs.readFileSync(path.join(dir, 'ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));

const ruCopied = [];
const enCopied = [];
for (const k of Object.keys(tm)) {
  const t = (tm[k] || '').trim();
  const r = (ru[k] || '').trim();
  const e = (en[k] || '').trim();
  if (!r || r === t) ruCopied.push(k);
  if (!e || e === t) enCopied.push(k);
}

console.log('ruCopiedCount', ruCopied.length);
console.log(ruCopied.join('\n'));
console.log('---');
console.log('enCopiedCount', enCopied.length);
console.log(enCopied.join('\n'));
