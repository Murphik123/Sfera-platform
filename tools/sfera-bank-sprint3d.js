#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.2b — frontend PDF/CSV export
 * - Кнопка "📥 Экспорт ▼" + dropdown в Taryh (рядом с фильтрами)
 * - Click → fetch /api/bank/transactions/export с текущими bankState.txFilters → blob → download
 * - Имя файла из Content-Disposition (создаётся бэком)
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT3.2b';
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
  if (ratio < 0.98 || ratio > 1.25) return { ok: false, reason: `size ratio ${ratio.toFixed(2)}` };
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

// ---------------------- 1. CSS ----------------------
function patchCss() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:css`)) return log(`-- css: already patched`);

  // вставляем после .tx-pagination стилей (перед маркером SPRINT2.2b3:css)
  const anchor = `        /* SFERA-PATCH:SPRINT2.2b3:css — tx filters + pagination + clickable rows */`;
  if (!r.content.includes(anchor)) return warn(`css: SPRINT2.2b3 css anchor not found`);

  const block = `        /* ${TAG}:css — export button + dropdown */
        .tx-export-wrap {
            position: relative;
            display: inline-flex;
        }
        .tx-export-btn {
            min-height: 42px;
            padding: 10px 18px;
            border-radius: 12px;
            border: 1px solid rgba(0,212,255,.28);
            background: rgba(255,255,255,.045);
            color: #ffffff;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: .25s;
            white-space: nowrap;
        }
        .tx-export-btn:hover {
            background: rgba(0,212,255,.12);
            border-color: rgba(0,212,255,.55);
        }
        .tx-export-menu {
            position: absolute;
            top: calc(100% + 4px);
            right: 0;
            min-width: 160px;
            background: #08131d;
            border: 1px solid rgba(0,212,255,.3);
            border-radius: 10px;
            padding: 6px;
            display: none;
            z-index: 100;
            box-shadow: 0 10px 30px rgba(0,0,0,.5);
        }
        .tx-export-menu.active {
            display: block;
        }
        .tx-export-menu button {
            display: block;
            width: 100%;
            text-align: left;
            padding: 8px 12px;
            background: transparent;
            border: none;
            color: #ffffff;
            font-size: 13px;
            cursor: pointer;
            border-radius: 6px;
        }
        .tx-export-menu button:hover {
            background: rgba(0,212,255,.12);
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 2. HTML: кнопка + dropdown ----------------------
function patchHtmlBlock() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:html`)) return log(`-- html: already patched`);

  // вставляем после кнопки Сброс в фильтрах Taryh
  const anchor = `                    <button type="button" class="btn btn-outline" id="txFilterReset">Сброс</button>
                </div>`;
  if (!r.content.includes(anchor)) return warn(`html: txFilterReset anchor not found`);

  const replacement = `                    <button type="button" class="btn btn-outline" id="txFilterReset">Сброс</button>
                    <!-- ${TAG}:html — export dropdown -->
                    <div class="tx-export-wrap" id="txExportWrap">
                        <button type="button" class="tx-export-btn" id="txExportBtn">📥 Экспорт ▼</button>
                        <div class="tx-export-menu" id="txExportMenu">
                            <button type="button" data-format="pdf">📄 PDF</button>
                            <button type="button" data-format="csv">📊 CSV</button>
                        </div>
                    </div>
                </div>`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

// ---------------------- 3. JS: bindTxExport ----------------------
function patchJs() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:js`)) return log(`-- js: already patched`);

  // вставляем перед bindTxFilters
  const anchor = `        function bindTxFilters(){`;
  if (!r.content.includes(anchor)) return warn(`js: bindTxFilters anchor not found`);

  const block = `        // ${TAG}:js — export button
        function bindTxExport(){
            const wrap = document.getElementById('txExportWrap');
            const btn  = document.getElementById('txExportBtn');
            const menu = document.getElementById('txExportMenu');
            if (!wrap || !btn || !menu) return;
            if (btn.dataset.bound === '1') return;
            btn.dataset.bound = '1';

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('active');
            });
            document.addEventListener('click', (e) => {
                if (!wrap.contains(e.target)) menu.classList.remove('active');
            });

            menu.querySelectorAll('button[data-format]').forEach(item => {
                item.addEventListener('click', async () => {
                    menu.classList.remove('active');
                    const format = item.dataset.format || 'pdf';
                    await downloadExport(format);
                });
            });
        }

        async function downloadExport(format){
            try {
                const f = bankState.txFilters || {};
                const params = new URLSearchParams();
                params.set('format', format);
                if (f.type)   params.set('type', f.type);
                if (f.from)   params.set('from', f.from);
                if (f.to)     params.set('to', f.to);
                if (f.search) params.set('search', f.search);

                showMessage('Готовлю ' + format.toUpperCase() + '...', 'success');

                const res = await fetch('/api/bank/transactions/export?' + params.toString(), {
                    headers: { 'Authorization': 'Bearer ' + getAuthToken() }
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    return showMessage('Экспорт: ' + (body.message || ('HTTP ' + res.status)), 'error');
                }

                const blob = await res.blob();
                const cd = res.headers.get('Content-Disposition') || '';
                const m = /filename="([^"]+)"/.exec(cd);
                const filename = m ? m[1] : ('sfera-bank.' + format);

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);

                showMessage('Скачано: ' + filename, 'success');
            } catch (e) {
                showMessage('Ошибка экспорта: ' + e.message, 'error');
            }
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 4. activateTab: bindTxExport ----------------------
function patchActivateTab() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:activateTab`)) return log(`-- activateTab: already patched`);

  const anchor = `            if (tab === 'history' && typeof loadTransactions === 'function') {
                bindTxFilters();
                bindTxPagination();
                loadTransactions();
            }`;
  if (!r.content.includes(anchor)) return warn(`activateTab: history anchor not found`);

  const replacement = `            if (tab === 'history' && typeof loadTransactions === 'function') {
                bindTxFilters();
                bindTxPagination();
                // ${TAG}:activateTab
                if (typeof bindTxExport === 'function') bindTxExport();
                loadTransactions();
            }`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.2b (frontend export) - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- CSS (export button + dropdown) --'); patchCss();
  log('\n-- HTML (кнопка + dropdown) --'); patchHtmlBlock();
  log('\n-- JS (bindTxExport + downloadExport) --'); patchJs();
  log('\n-- activateTab (bindTxExport при history) --'); patchActivateTab();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3d.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }