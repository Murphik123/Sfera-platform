#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 2.2b-2 (v2 — regex + bracket counting)
 * 1) FIX: loadBankData параллельно тянет /bank/notifications (badge оживает)
 * 2) Skeleton: серая заглушка на totalBalance + mainAccount
 *
 * v2: не требует exact-match loadBankData — заменяет всю функцию
 *     по паттерну "async function loadBankData" + подсчёт скобок.
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT2.2b2';
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

/**
 * Находит функцию по подстроке `fnHeader` и возвращает { start, end, body }
 * через подсчёт скобок. `end` — позиция СРАЗУ ПОСЛЕ закрывающей `}`.
 */
function findFunctionBlock(content, fnHeader) {
  const start = content.indexOf(fnHeader);
  if (start === -1) return null;
  const braceOpen = content.indexOf('{', start);
  if (braceOpen === -1) return null;
  let depth = 0;
  let inStr = null;     // ' " `
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = braceOpen; i < content.length; i++) {
    const ch = content[i];
    const prev = content[i - 1];
    const next = content[i + 1];

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
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return { start, end: i + 1, body: content.slice(start, i + 1) };
      }
    }
  }
  return null;
}

// ---------------------- 1. CSS skeleton ----------------------
function patchSkeletonCss() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:css`)) return log(`-- skeleton-css: already patched`);

  const anchor = `    </style>
    <script src="/js/api.js"></script>`;
  if (!r.content.includes(anchor)) return warn(`skeleton-css: </style>+api.js not found`);

  const block = `        /* ${TAG}:css — skeleton loading */
        .skeleton {
            background: linear-gradient(90deg,
                rgba(255,255,255,.04) 0%,
                rgba(255,255,255,.10) 50%,
                rgba(255,255,255,.04) 100%);
            background-size: 200% 100%;
            animation: skeletonShimmer 1.4s ease-in-out infinite;
            border-radius: 8px;
            color: transparent !important;
            user-select: none;
            pointer-events: none;
        }
        @keyframes skeletonShimmer {
            0%   { background-position:  200% 0; }
            100% { background-position: -200% 0; }
        }
    </style>
    <script src="/js/api.js"></script>`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 2. showSkeletons / hideSkeletons ----------------------
function patchSkeletonHelpers() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:helpers`)) return log(`-- skeleton-helpers: already patched`);

  const anchor = `        function showMessage(text, type='success') {`;
  if (!r.content.includes(anchor)) return warn(`skeleton-helpers: showMessage not found`);

  const block = `        // ${TAG}:helpers
        function showSkeletons() {
            ['totalBalance', 'mainAccount'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('skeleton');
            });
        }
        function hideSkeletons() {
            ['totalBalance', 'mainAccount'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('skeleton');
            });
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 3. loadBankData через bracket counting ----------------------
function patchLoadBankData() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:load`)) return log(`-- loadBankData: already patched`);

  const found = findFunctionBlock(r.content, 'async function loadBankData');
  if (!found) return warn(`loadBankData: function block not found (even with bracket counting)`);

  const oldBody = found.body;
  if (oldBody.length < 100) return warn(`loadBankData: suspicious short body (${oldBody.length} chars)`);
  if (!/window\.api/.test(oldBody)) return warn(`loadBankData: body doesn't reference window.api — not the function we expect`);

  const newBody = `async function loadBankData(){
            if (_bankLoading) return;
            _bankLoading = true;
            showSkeletons();
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

  if (DRY) {
    log(`-- loadBankData: будет заменена (${oldBody.length} → ${newBody.length} символов)`);
    log(`   первые 3 строки СТАРОЙ функции:`);
    oldBody.split('\n').slice(0, 3).forEach(l => log(`     | ${l.trimEnd()}`));
    return true;
  }

  const next = r.content.slice(0, found.start) + `// ${TAG}:load — parallel notifications + skeleton\n        ` + newBody + r.content.slice(found.end);
  writePatched(F.html, next, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 2.2b-2 (v2) - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- Skeleton CSS --'); patchSkeletonCss();
  log('\n-- Skeleton helpers --'); patchSkeletonHelpers();
  log('\n-- loadBankData (regex + bracket) --'); patchLoadBankData();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint2b2.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }