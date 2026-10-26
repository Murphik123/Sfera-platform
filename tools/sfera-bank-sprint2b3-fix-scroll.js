#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 2.2b-3 fix-scroll
 * Убирает горизонтальный скроллбар в transactions-list.
 * - убирает margin-left/right: -8px из .tx-item-clickable
 * - добавляет overflow-x: hidden на .transactions-list
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT2.2b3-fix-scroll';
const ROOT = path.resolve(__dirname, '..');
const DRY = !process.argv.includes('--apply');
const F = { html: 'public/bank.html' };

const log  = (...a) => console.log(...a);
const ok   = (...a) => console.log('OK', ...a);
const warn = (...a) => console.warn('WARN', ...a);
const bad  = (...a) => console.error('ERR', ...a);

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

function patchCss() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:css`)) return log(`-- css: already patched`);

  // 1. Убираем отрицательные margin из .tx-item-clickable
  const oldClickable = `        .transactions-list li.tx-item-clickable {
            cursor: pointer;
            transition: background .2s;
            padding-left: 8px;
            padding-right: 8px;
            margin-left: -8px;
            margin-right: -8px;
            border-radius: 6px;
        }`;
  const newClickable = `        /* ${TAG}:css — clickable row без горизонтального overflow */
        .transactions-list li.tx-item-clickable {
            cursor: pointer;
            transition: background .2s;
            border-radius: 6px;
        }`;

  // 2. overflow-x hidden на .transactions-list
  const oldList = `        .transactions-list {
            list-style: none;
            padding: 0;
            margin: 0;
            max-height: 400px;
            overflow-y: auto;
        }`;
  const newList = `        .transactions-list {
            list-style: none;
            padding: 0;
            margin: 0;
            max-height: 400px;
            overflow-y: auto;
            overflow-x: hidden; /* ${TAG} — убираем горизонтальный скролл */
        }`;

  let c = r.content;
  let changed = false;

  if (c.includes(oldClickable)) {
    c = c.replace(oldClickable, newClickable);
    changed = true;
  } else if (c.includes('.tx-item-clickable')) {
    warn(`tx-item-clickable: точный anchor не найден, но класс есть — правлю margin отдельно`);
    c = c.replace(/margin-left:\s*-8px;\s*\n\s*margin-right:\s*-8px;\s*\n/g, '');
    changed = true;
  } else {
    warn(`tx-item-clickable: не найден вообще`);
  }

  if (c.includes(oldList)) {
    c = c.replace(oldList, newList);
    changed = true;
  } else if (c.includes('.transactions-list {')) {
    warn(`.transactions-list: точный anchor не найден — правлю overflow-y отдельно`);
    c = c.replace(/overflow-y:\s*auto;(\s*\n\s*\})/g, `overflow-y: auto;\n            overflow-x: hidden; /* ${TAG} */$1`);
    changed = true;
  } else {
    warn(`.transactions-list: не найден`);
  }

  if (!changed) return warn(`css: ничего не изменено — все anchors отсутствуют`);
  writePatched(F.html, c, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 2.2b-3 fix-scroll - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- CSS fix (overflow-x + margin) --'); patchCss();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint2b3-fix-scroll.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }