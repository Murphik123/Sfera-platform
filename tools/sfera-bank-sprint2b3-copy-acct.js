#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 2.2b-2 COPY-ACCT
 * - IBAN в account-card (.acct-number) копируется по клику (event delegation)
 * - CSS: cursor pointer + hover цвет + базовый цвет светлее
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT2.2b2-copy-acct';
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
  const ratio = after.length / Math.max(before.length, 1);
  if (ratio < 0.98 || ratio > 1.2) return { ok: false, reason: `size ratio ${ratio.toFixed(2)}` };
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

// ---------------------- 1. CSS: cursor + hover для .acct-number ----------------------
function patchCss() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:css`)) return log(`-- css: already patched`);

  const anchor = `        /* SFERA-PATCH:SPRINT2.2b2:css — skeleton loading */`;
  if (!r.content.includes(anchor)) return warn(`css: skeleton css anchor not found`);

  const block = `        /* ${TAG}:css — clickable IBAN в account-card */
        .account-card .acct-number {
            cursor: pointer;
            color: #dbe9ff;
            transition: color .2s ease, text-shadow .2s ease;
        }
        .account-card .acct-number:hover {
            color: #00d4ff;
            text-shadow: 0 0 8px rgba(0,212,255,.5);
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 2. Event delegation на #accountsGrid ----------------------
function patchClickHandler() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:click`)) return log(`-- click: already patched`);

  const anchor = `// SFERA-PATCH:SPRINT2.2b2-fix:refresh — refreshBtn с skeleton`;
  if (!r.content.includes(anchor)) return warn(`click: refresh anchor not found`);

  const block = `        // ${TAG}:click — IBAN в account-card копируется (event delegation)
        (function () {
            const grid = document.getElementById('accountsGrid');
            if (!grid || grid.dataset.copyBound === '1') return;
            grid.dataset.copyBound = '1';
            grid.addEventListener('click', async (e) => {
                const num = e.target.closest('.acct-number');
                if (!num) return;
                const iban = (num.textContent || '').trim();
                if (!iban || iban.length < 10) return;
                try {
                    await navigator.clipboard.writeText(iban);
                    showMessage('IBAN скопирован: ' + iban, 'success');
                } catch (err) {
                    showMessage('Не удалось скопировать (браузер запретил)', 'error');
                }
            });
        })();

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 2.2b-2 COPY-ACCT - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- CSS (.acct-number clickable) --'); patchCss();
  log('\n-- Click handler (accountsGrid delegation) --'); patchClickHandler();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint2b3-copy-acct.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }