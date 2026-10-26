#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.4g — fix: card-logo overlaps card-number
 * - .card-logo: top 20→14, size 30→24 (уходит в строку DEBIT)
 * - .card-number: +padding-right 50 (страховка от overlap)
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT3.4g';
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

  const anchor = `        /* SFERA-PATCH:SPRINT3.4f:css — modern toast (bottom-right, Revolut-style) */`;
  if (!r.content.includes(anchor)) return warn(`css: SPRINT3.4f anchor not found`);

  const block = `        /* ${TAG}:css — fix card-logo overlap */
        .card-item .card-logo {
            top: 14px;
            right: 20px;
            font-size: 24px;
            line-height: 1;
        }
        .card-item .card-number {
            padding-right: 50px;
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.4g (fix card-logo overlap) - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- CSS fix card-logo --'); patchCss();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3m.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }