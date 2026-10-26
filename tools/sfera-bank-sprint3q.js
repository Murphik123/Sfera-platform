#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.4k — белый экран fix (v2, atomic)
 * - 3 external script из <head> → в конец body ПЕРЕД inline
 * - qrcode.min.js (56 KB) → lazy-load в renderReceive
 * - Inline JS не трогаем
 * - ОДНА транзакция: вырезать + вставить + проверить финальный контент + записать
 * - При провале check — ничего не пишем
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT3.4k';
const ROOT = path.resolve(__dirname, '..');
const DRY = !process.argv.includes('--apply');
const F = { html: 'public/bank.html' };

const log = (...a) => console.log(...a);
const ok = (...a) => console.log('OK', ...a);
const warn = (...a) => console.warn('WARN', ...a);
const bad = (...a) => console.error('ERR', ...a);

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return { path: p, content: raw.replace(/\r\n/g, '\n'), originalEol: eol };
}
function backup(p) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bak = `${p}.bak-${ts}`;
  fs.copyFileSync(p, bak);
  return bak;
}

/** Проверяет финальный контент: порядок external до inline, inline валиден, функции на месте */
function validateFinal(content) {
  const inlineIdx = content.indexOf('SFERA BANK — approval candidate v22');
  if (inlineIdx === -1) return { ok: false, reason: 'inline marker not found' };

  // 1. External до inline
  for (const file of ['/socket.io/socket.io.js', '/js/api.js', '/scripts/auto_translate_i18n.js']) {
    const idx = content.indexOf(file);
    if (idx === -1) return { ok: false, reason: `${file} MISSING` };
    if (idx > inlineIdx) return { ok: false, reason: `${file} AFTER inline` };
  }

  // 2. Ровно ОДНО вхождение каждого external (нет дубликатов)
  for (const file of ['/socket.io/socket.io.js', '/js/api.js', '/scripts/auto_translate_i18n.js']) {
    const count = (content.match(new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (count !== 1) return { ok: false, reason: `${file} found ${count} times (expected 1)` };
  }

  // 3. qrcode.min.js не должен быть в <script src>
  const qrScriptTags = (content.match(/<script[^>]*src="\/js\/qrcode\.min\.js"/g) || []).length;
  if (qrScriptTags > 0) return { ok: false, reason: `qrcode.min.js still in <script src> (${qrScriptTags})` };

  // 4. Inline JS валиден
  const m = [...content.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
  try { new Function(m.map(x => x[1]).join('\n;\n')); }
  catch (e) { return { ok: false, reason: `inline JS: ${e.message}` }; }

  // 5. Ключевые функции на месте
  for (const fn of ['function loadBankData', 'function initBankSocket', 'function renderReceive', 'function toggleCardFreeze']) {
    if (!content.includes(fn)) return { ok: false, reason: `missing ${fn}` };
  }

  return { ok: true };
}

function moveScriptsToBody() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:body-scripts`)) return log(`-- move: already patched`);

  let c = r.content;

  // 1. Вырезать 4 script из head
  const headPatterns = [
    `    <script src="/socket.io/socket.io.js"></script>\n`,
    `    <script src="/js/qrcode.min.js"></script>\n`,
    `    <script src="/js/api.js"></script>\n`,
    `    <script src="/scripts/auto_translate_i18n.js"></script>\n`,
  ];
  let removed = 0;
  for (const p of headPatterns) {
    if (c.includes(p)) { c = c.replace(p, ''); removed++; }
  }
  if (removed === 0) return warn(`move: no head scripts found`);
  log(`-- move: ${removed} scripts removed from head`);

  // 2. Вставить 3 external перед inline (qrcode → lazy, не вставляем)
  const inlineAnchor = `    <script>
        /* ============================================================
           SFERA BANK — approval candidate v22`;
  if (!c.includes(inlineAnchor)) return warn(`move: inline anchor not found`);

  const insertion = `    <!-- ${TAG}:body-scripts — external перед inline -->
    <script src="/socket.io/socket.io.js"></script>
    <script src="/js/api.js"></script>
    <script src="/scripts/auto_translate_i18n.js"></script>
${inlineAnchor}`;
  c = c.replace(inlineAnchor, insertion);

  // 3. Lazy qrcode в renderReceive
  const qrAnchor = `            if (typeof qrcode !== 'function') {
                box.textContent = 'QR-библиотека не загружена';
                return;
            }`;
  if (!c.includes(qrAnchor)) return warn(`move: qr anchor not found`);

  const qrReplacement = `            // ${TAG}:lazy-qr — qrcode.min.js грузится при первом открытии Almak
            if (typeof qrcode !== 'function') {
                if (window._qrLoading) { box.textContent = 'Загрузка QR...'; return; }
                window._qrLoading = true;
                box.textContent = 'Загрузка QR...';
                var script = document.createElement('script');
                script.src = '/js/qrcode.min.js';
                script.onload = function() { window._qrLoading = false; renderReceive(); };
                script.onerror = function() { window._qrLoading = false; box.textContent = 'QR не загрузился'; };
                document.head.appendChild(script);
                return;
            }`;
  c = c.replace(qrAnchor, qrReplacement);

  // 4. ВАЛИДАЦИЯ ФИНАЛЬНОГО КОНТЕНТА — до записи
  const valid = validateFinal(c);
  if (!valid.ok) {
    bad(`VALIDATE fail: ${valid.reason} — файл НЕ записан`);
    return false;
  }

  if (DRY) {
    log(`-- will change: 4 head scripts moved, 3 в body, qrcode lazy`);
    return true;
  }

  // 5. Запись
  const bak = backup(r.path);
  const out = r.originalEol === '\r\n' ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(r.path, out, 'utf8');
  ok(`${F.html}  <-  ${path.basename(bak)}`);

  // 6. Post-check на диске
  const after = fs.readFileSync(r.path, 'utf8').replace(/\r\n/g, '\n');
  const postValid = validateFinal(after);
  if (!postValid.ok) {
    bad(`POST-CHECK fail: ${postValid.reason} -> REVERT`);
    fs.copyFileSync(bak, r.path);
    return false;
  }
  ok(`post-check ok: order + inline JS + functions + no duplicates`);
  return true;
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.4k (v2 atomic) - ROOT=${ROOT}\n`);
  moveScriptsToBody();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3q.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }