#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 2.2b-2 FIX
 * - skeleton только на #totalBalance (убрать #mainAccount — IBAN всегда виден)
 * - showSkeletons только по opts.skeleton === true (init + refreshBtn)
 * - hideSkeletons всегда в finally (страховка от залипания)
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT2.2b2-fix';
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

function findFunctionBlock(content, fnHeader) {
  const start = content.indexOf(fnHeader);
  if (start === -1) return null;
  const braceOpen = content.indexOf('{', start);
  if (braceOpen === -1) return null;
  let depth = 0, inStr = null, inLineComment = false, inBlockComment = false;
  for (let i = braceOpen; i < content.length; i++) {
    const ch = content[i], next = content[i + 1];
    if (inLineComment) { if (ch === '\n') inLineComment = false; continue; }
    if (inBlockComment) { if (ch === '*' && next === '/') { inBlockComment = false; i++; } continue; }
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return { start, end: i + 1, body: content.slice(start, i + 1) }; }
  }
  return null;
}

// 1. Helpers: только #totalBalance
function patchHelpers() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:helpers`)) return log(`-- helpers: already patched`);

  const showFound = findFunctionBlock(r.content, 'function showSkeletons()');
  if (!showFound) return warn(`showSkeletons: function not found`);
  const hideFound = findFunctionBlock(r.content, 'function hideSkeletons()');
  if (!hideFound) return warn(`hideSkeletons: function not found`);

  const newCode = `// ${TAG}:helpers
        function showSkeletons() {
            // только #totalBalance — IBAN (#mainAccount) всегда виден
            const el = document.getElementById('totalBalance');
            if (el) el.classList.add('skeleton');
        }
        function hideSkeletons() {
            // снимаем с обоих — страховка от залипания
            ['totalBalance', 'mainAccount'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('skeleton');
            });
        }`;

  const next = r.content.slice(0, showFound.start) + newCode + r.content.slice(hideFound.end);
  writePatched(F.html, next, r.content);
}

// 2. loadBankData: opts.skeleton, hide всегда
function patchLoadBankData() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:load`)) return log(`-- loadBankData: already patched`);

  const found = findFunctionBlock(r.content, 'async function loadBankData');
  if (!found) return warn(`loadBankData: function block not found`);
  if (!/window\.api/.test(found.body)) return warn(`loadBankData: body doesn't reference window.api`);

  const newBody = `async function loadBankData(opts){
            if (_bankLoading) return;
            _bankLoading = true;
            const showSk = !!(opts && opts.skeleton === true);
            if (showSk) showSkeletons();
            try {
                if(!window.api || typeof window.api.request!=='function') {
                    showMessage(t('bank_api_unavailable','Bank API elýeterli däl'),'error'); return;
                }
                const [response, notifResponse] = await Promise.all([
                    window.api.request('/bank/balance'),
                    window.api.request('/bank/notifications').catch(() => null)
                ]);
                const data  = response?.data ?? response ?? {};
                const ndata = notifResponse?.data ?? notifResponse ?? {};
                bankState.accounts      = Array.isArray(data.accounts)      ? data.accounts      : [];
                bankState.cards         = Array.isArray(data.cards)         ? data.cards         : [];
                bankState.transactions  = Array.isArray(data.transactions)  ? data.transactions  : [];
                bankState.notifications = Array.isArray(ndata.data)
                    ? ndata.data
                    : (Array.isArray(ndata) ? ndata : (Array.isArray(data.notifications) ? data.notifications : []));
                renderAccounts(); renderCards(); renderHistory(); renderNotifications();
                populateFromAccounts(); updateTotalBalance();
            } catch(err) {
                if (err && err.status === 401) { location.href = 'login.html'; return; }
                showMessage(err.message || t('bank_load_error','Ýüklemek başartmady'),'error');
            } finally {
                _bankLoading = false;
                hideSkeletons();
            }
        }`;

  const next = r.content.slice(0, found.start) + `// ${TAG}:load — skeleton только по opts.skeleton\n        ` + newBody + r.content.slice(found.end);
  writePatched(F.html, next, r.content);
}

// 3. refreshBtn: с skeleton
function patchRefreshBtn() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:refresh`)) return log(`-- refreshBtn: already patched`);

  const anchor = `$('refreshBtn')?.addEventListener('click',loadBankData);`;
  if (!r.content.includes(anchor)) return warn(`refreshBtn: anchor not found`);

  const replacement = `// ${TAG}:refresh — refreshBtn с skeleton
        $('refreshBtn')?.addEventListener('click', () => loadBankData({ skeleton: true }));`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

// 4. init: с skeleton
function patchInit() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:init`)) return log(`-- init: already patched`);

  const anchor = `        loadBankData();\n        populateUsername();`;
  if (!r.content.includes(anchor)) return warn(`init: loadBankData+populateUsername anchor not found`);

  const replacement = `        // ${TAG}:init — при первой загрузке skeleton
        loadBankData({ skeleton: true });
        populateUsername();`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 2.2b-2 FIX - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- Helpers (только #totalBalance) --'); patchHelpers();
  log('\n-- loadBankData (opts.skeleton) --'); patchLoadBankData();
  log('\n-- refreshBtn (skeleton) --'); patchRefreshBtn();
  log('\n-- init (skeleton) --'); patchInit();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint2b2-fix.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }