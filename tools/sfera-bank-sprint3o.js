#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.4i — CSS cascade fix + defer scripts
 * 1. CSS !important для card-number + card-logo (перебивает 3.4b)
 * 2. defer на 4 <script src> в <head> — не блокируют рендер (убирает белый экран)
 * 3. Обернуть inline <script> в DOMContentLoaded — ждёт defer-скрипты
 *
 * v2: patchInlineWrap использует end-anchor по `bindBalanceQuickActions();`
 *     вместо `</script>\n</body>` (который не матчится).
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT3.4i';
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
function checkHtml(p, before) {
  const after = fs.readFileSync(p, 'utf8');
  if (!after.includes('</html>')) return { ok: false, reason: 'no </html>' };
  const o = (after.match(/<script\b/g) || []).length;
  const c = (after.match(/<\/script>/g) || []).length;
  if (o !== c) return { ok: false, reason: `script ${o}/${c}` };
  const ratio = after.length / Math.max(before.length, 1);
  if (ratio < 0.98 || ratio > 1.1) return { ok: false, reason: `size ratio ${ratio.toFixed(2)}` };
  return { ok: true };
}
function writePatched(rel, content, before) {
  const p = path.join(ROOT, rel);
  if (content === before) { log(`-- ${rel}: no change`); return true; }
  if (DRY) { log(`-- ${rel}: will change`); return true; }
  const bak = backup(p);
  const r = read(rel);
  const out = r.originalEol === '\r\n' ? content.replace(/\n/g, '\r\n') : content;
  fs.writeFileSync(p, out, 'utf8');
  ok(`${rel}  <-  ${path.basename(bak)}`);
  const chk = checkHtml(p, before);
  if (!chk.ok) { bad(`post-check fail -> revert: ${chk.reason}`); fs.copyFileSync(bak, p); return false; }
  ok(`post-check ok: ${rel}`);
  return true;
}

// ---------------------- 1. CSS cascade fix ----------------------
function patchCss() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:css`)) return log(`-- css: already patched`);

  const anchor = `</head>`;
  if (!r.content.includes(anchor)) return warn(`css: </head> not found`);

  const block = `    <style>
        /* ${TAG}:css — cascade override (побеждает 3.4b) */
        .card-item .card-number {
            font-size: 20px !important;
            letter-spacing: 2px !important;
            padding-right: 0 !important;
            white-space: nowrap !important;
        }
        .card-item .card-logo {
            top: 14px !important;
            right: 20px !important;
            font-size: 24px !important;
            line-height: 1 !important;
        }
    </style>
${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 2. defer на 4 script tags ----------------------
function patchDefer() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:defer`)) return log(`-- defer: already patched`);

  let c = r.content;
  let count = 0;

  const replacements = [
    [`<script src="/socket.io/socket.io.js"></script>`, `<script src="/socket.io/socket.io.js" defer></script>`],
    [`<script src="/js/qrcode.min.js"></script>`, `<script src="/js/qrcode.min.js" defer></script>`],
    [`<script src="/js/api.js"></script>`, `<script src="/js/api.js" defer></script>`],
    [`<script src="/scripts/auto_translate_i18n.js"></script>`, `<script src="/scripts/auto_translate_i18n.js" defer></script>`],
  ];

  for (const [from, to] of replacements) {
    if (c.includes(from)) { c = c.split(from).join(to); count++; }
  }

  if (count === 0) return warn(`defer: no matching script tags`);
  log(`-- defer: ${count}/4 script tags updated`);
  writePatched(F.html, c, r.content);
}

// ---------------------- 3. Обернуть inline script в DOMContentLoaded ----------------------
function patchInlineWrap() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:wrap`)) return log(`-- wrap: already patched`);

  // Начало inline script — уникальный комментарий
  const startAnchor = `    <script>
        /* ============================================================
           SFERA BANK — approval candidate v22`;
  if (!r.content.includes(startAnchor)) return warn(`wrap: start anchor not found`);

  const wrappedStart = `    <script>
        // ${TAG}:wrap — ждём defer-скрипты
        document.addEventListener('DOMContentLoaded', function() {
        /* ============================================================
           SFERA BANK — approval candidate v22`;

  let c = r.content.replace(startAnchor, wrappedStart);

  // Конец — anchor по последней строке inline (из SPRINT3.4e:init)
  // Ищем `bindBalanceQuickActions();` — вызов в init (не определение функции)
  // и добавляем `});` сразу после него
  const endAnchor = `        bindBalanceQuickActions();`;
  if (!c.includes(endAnchor)) return warn(`wrap: end anchor (bindBalanceQuickActions) not found`);

  // Заменяем ТОЛЬКО первое вхождение — это init-вызов
  const idx = c.indexOf(endAnchor);
  if (idx === -1) return warn(`wrap: init bindBalanceQuickActions not found`);

  const wrappedEnd = `        bindBalanceQuickActions();
        }); // ${TAG}:wrap end`;

  c = c.slice(0, idx) + wrappedEnd + c.slice(idx + endAnchor.length);

  writePatched(F.html, c, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.4i - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found'); process.exit(1);
  }
  log('-- CSS cascade !important --'); patchCss();
  log('\n-- defer на 4 <script src> --'); patchDefer();
  log('\n-- wrap inline в DOMContentLoaded --'); patchInlineWrap();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3o.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }
