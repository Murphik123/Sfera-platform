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

// ---------- Load existing language files ----------
const langs = ['tm', 'ru', 'en'];
const data = {};
for (const l of langs) {
  const p = path.join(languagesDir, l + '.json');
  if (fs.existsSync(p)) {
    try {
      data[l] = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      console.error('Failed to parse', p, e);
      data[l] = {};
    }
    fs.writeFileSync(path.join(backupDir, l + '.json.bak'), JSON.stringify(data[l], null, 2));
  } else {
    data[l] = {};
  }
}

// ---------- FIX: helpers ----------
const VOID_TAGS = new Set([
  'input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'base',
  'col', 'embed', 'param', 'source', 'track', 'wbr'
]);

/**
 * Strip HTML tags + decode entities + collapse whitespace.
 */
function stripHtml(html) {
  let text = html.replace(/<[^>]*>/g, ' ');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'");
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * FIX #1: extract the human-readable text of the element at attrPos,
 * stripping nested tags (works with <button><span>Text</span></button>).
 */
function extractElementText(content, attrPos) {
  // 1. find start of opening tag
  let tagStart = attrPos;
  while (tagStart > 0 && content[tagStart] !== '<') tagStart--;
  if (content[tagStart] !== '<') return '';

  // 2. tag name
  const tagSlice = content.slice(tagStart, tagStart + 80);
  const tagMatch = tagSlice.match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!tagMatch) return '';
  const tagName = tagMatch[1].toLowerCase();

  // 3. void tags — no text content
  if (VOID_TAGS.has(tagName)) return '';

  // 4. find end of opening tag '>' (skip quoted attribute values)
  let gtPos = attrPos;
  let quote = null;
  while (gtPos < content.length) {
    const ch = content[gtPos];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      break;
    }
    gtPos++;
  }
  if (gtPos >= content.length) return '';

  // 5. self-closing tag — no text content
  if (content[gtPos - 1] === '/') return '';

  // 6. find matching closing tag with depth counter
  let depth = 1;
  let i = gtPos + 1;
  while (i < content.length && depth > 0) {
    const nextLt = content.indexOf('<', i);
    if (nextLt === -1) break;

    if (content[nextLt + 1] === '/') {
      // closing tag
      const closeEnd = content.indexOf('>', nextLt);
      if (closeEnd === -1) break;
      const closeName = content
        .slice(nextLt + 2, closeEnd)
        .trim()
        .split(/\s+/)[0]
        .toLowerCase();
      if (closeName === tagName) {
        depth--;
        if (depth === 0) {
          return stripHtml(content.slice(gtPos + 1, nextLt));
        }
      }
      i = closeEnd + 1;
    } else if (/[a-zA-Z]/.test(content[nextLt + 1] || '')) {
      // opening tag
      const openEnd = content.indexOf('>', nextLt);
      if (openEnd === -1) break;
      const openContent = content.slice(nextLt + 1, openEnd);
      const openName = openContent.trim().split(/\s+/)[0].replace(/\/$/, '').toLowerCase();
      const isSelfClose = openContent.trimEnd().endsWith('/');
      if (openName === tagName && !isSelfClose && !VOID_TAGS.has(openName)) {
        depth++;
      }
      i = openEnd + 1;
    } else {
      // comments, doctype, etc. — skip
      const skipEnd = content.indexOf('>', nextLt);
      if (skipEnd === -1) break;
      i = skipEnd + 1;
    }
  }

  return '';
}

/**
 * FIX #2: extract value of a specific attribute inside the given tag.
 * Used for data-i18n-placeholder / -title / -value.
 */
function extractAttributeValue(content, attrPos, attrName) {
  let tagStart = attrPos;
  while (tagStart > 0 && content[tagStart] !== '<') tagStart--;
  const tagEnd = content.indexOf('>', attrPos);
  if (tagEnd === -1) return '';
  const tagHtml = content.slice(tagStart, tagEnd + 1);

  // Require whitespace or start-of-tag before the attribute name
  // so that "placeholder" doesn't accidentally match inside "data-i18n-placeholder".
  const re = new RegExp('(?:\\s|^)' + attrName + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')');
  const m = tagHtml.match(re);
  if (!m) return '';
  return (m[1] !== undefined ? m[1] : m[2] || '').trim();
}

// ---------- Collect keys from HTML files ----------
const htmlFiles = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));
console.log('HTML files:', htmlFiles);

const keyMap = {};

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(htmlDir, file), 'utf8');
  const attrRegex = /(data-i18n(?:-placeholder|-title|-value)?)\s*=\s*"([^"]+)"/g;
  let m;

  while ((m = attrRegex.exec(content)) !== null) {
    const attr = m[1];
    const key = m[2];
    const attrPos = m.index;
    if (!key) continue;

    if (!keyMap[key]) keyMap[key] = { attrs: new Set(), examples: [] };
    keyMap[key].attrs.add(attr);

    // FIX: pick source depending on attribute type
    let text = '';
    if (attr === 'data-i18n') {
      text = extractElementText(content, attrPos);
    } else if (attr === 'data-i18n-placeholder') {
      text = extractAttributeValue(content, attrPos, 'placeholder');
    } else if (attr === 'data-i18n-title') {
      text = extractAttributeValue(content, attrPos, 'title');
    } else if (attr === 'data-i18n-value') {
      text = extractAttributeValue(content, attrPos, 'value');
    }

    if (text) keyMap[key].examples.push({ file, text, attr });
  }
}

console.log('Found keys:', Object.keys(keyMap).length);

// ---------- Merge into language files ----------
let addedCount = 0;
let emptyCount = 0;

for (const [key, info] of Object.entries(keyMap)) {
  let tmText = data.tm[key];

  if (!tmText) {
    const candidates = (info.examples || [])
      .map(e => e.text)
      .filter(t => t && t.length > 0);

    tmText = candidates[0] || '';

    if (!tmText) {
      emptyCount++;
      console.warn(`⚠️  No text extracted for key "${key}" (${[...info.attrs].join(', ')}) — checked ${info.examples.length} example(s)`);
    } else {
      data.tm[key] = tmText;
      addedCount++;
    }
  }

  if (!data.ru[key]) data.ru[key] = tmText || '';
  if (!data.en[key]) data.en[key] = tmText || '';
}

// ---------- Save ----------
for (const l of langs) {
  const p = path.join(languagesDir, l + '.json');
  fs.writeFileSync(p, JSON.stringify(data[l], null, 2), 'utf8');
}

console.log('Added TM keys:', addedCount);
console.log('Keys with no extractable text:', emptyCount);
console.log('Backups saved to', backupDir);
console.log('Done.');
