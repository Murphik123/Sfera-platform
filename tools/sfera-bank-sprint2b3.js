#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 2.2b-3
 * Фильтры + пагинация + модалка деталей tx в Taryh.
 * loadBankData больше не трогает bankState.transactions (иначе polling сбрасывает фильтры).
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT2.2b3';
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

// ---------------------- 1. CSS ----------------------
function patchCss() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:css`)) return log(`-- css: already patched`);

  const anchor = `        /* SFERA-PATCH:SPRINT2.2b2-copy-acct:css — clickable IBAN в account-card */`;
  if (!r.content.includes(anchor)) return warn(`css: copy-acct anchor not found`);

  const block = `        /* ${TAG}:css — tx filters + pagination + clickable rows */
        .tx-filters {
            display: flex;
            gap: 10px;
            align-items: end;
            flex-wrap: wrap;
            margin-bottom: 16px;
            padding: 12px 14px;
            background: rgba(255,255,255,.03);
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 12px;
        }
        .tx-filter-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 12px;
            color: #9fb5c8;
        }
        .tx-filter-group select,
        .tx-filter-group input {
            padding: 8px 10px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,.15);
            background: rgba(255,255,255,.05);
            color: #ffffff;
            font-size: 13px;
            outline: none;
            color-scheme: dark;
            min-height: 36px;
        }
        .tx-filter-group select:focus,
        .tx-filter-group input:focus {
            border-color: #00d4ff;
            box-shadow: 0 0 0 2px rgba(0,212,255,.15);
        }
        .tx-filter-search {
            flex: 1;
            min-width: 180px;
        }
        .tx-pagination {
            display: flex;
            justify-content: center;
            gap: 12px;
            align-items: center;
            margin-top: 16px;
            padding: 8px 0;
        }
        .tx-pagination button {
            padding: 8px 16px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,.15);
            background: rgba(255,255,255,.05);
            color: #ffffff;
            cursor: pointer;
            font-size: 13px;
            transition: .2s;
        }
        .tx-pagination button:hover:not(:disabled) {
            background: rgba(0,212,255,.12);
            border-color: rgba(0,212,255,.55);
        }
        .tx-pagination button:disabled {
            opacity: .4;
            cursor: not-allowed;
        }
        .tx-pagination .tx-page-info {
            color: #bdd0df;
            font-size: 13px;
            min-width: 80px;
            text-align: center;
        }
        .transactions-list li.tx-item-clickable {
            cursor: pointer;
            transition: background .2s;
            padding-left: 8px;
            padding-right: 8px;
            margin-left: -8px;
            margin-right: -8px;
            border-radius: 6px;
        }
        .transactions-list li.tx-item-clickable:hover {
            background: rgba(0,212,255,.06);
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 2. HTML: filters + pagination ----------------------
function patchHtmlBlock() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:html`)) return log(`-- html: already patched`);

  const anchor = `            <div class="tab-content" id="tab-history">
                <ul class="transactions-list" id="transactionsList"></ul>`;
  if (!r.content.includes(anchor)) return warn(`html: tab-history anchor not found`);

  const replacement = `            <div class="tab-content" id="tab-history">
                <!-- ${TAG}:html -->
                <div class="tx-filters" id="txFilters">
                    <div class="tx-filter-group">
                        <label for="txFilterType">Тип</label>
                        <select id="txFilterType">
                            <option value="">Все</option>
                            <option value="transfer">Перевод</option>
                            <option value="deposit">Пополнение</option>
                            <option value="withdrawal">Списание</option>
                            <option value="payment">Оплата</option>
                        </select>
                    </div>
                    <div class="tx-filter-group">
                        <label for="txFilterFrom">С</label>
                        <input type="date" id="txFilterFrom" />
                    </div>
                    <div class="tx-filter-group">
                        <label for="txFilterTo">По</label>
                        <input type="date" id="txFilterTo" />
                    </div>
                    <div class="tx-filter-group tx-filter-search">
                        <label for="txFilterSearch">Поиск</label>
                        <input type="search" id="txFilterSearch" placeholder="Описание..." />
                    </div>
                    <button type="button" class="btn btn-outline" id="txFilterReset">Сброс</button>
                </div>
                <ul class="transactions-list" id="transactionsList"></ul>
                <div class="tx-pagination" id="txPagination" style="display:none;">
                    <button type="button" id="txPrevBtn">← Назад</button>
                    <span class="tx-page-info" id="txPageInfo">1 / 1</span>
                    <button type="button" id="txNextBtn">Вперёд →</button>
                </div>`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

// ---------------------- 3. JS funcs: loadTransactions, pagination, details ----------------------
function patchJsFuncs() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:funcs`)) return log(`-- js funcs: already patched`);

  const anchor = `        // SFERA-PATCH:SPRINT2.2b2-fix:init — при первой загрузке skeleton`;
  if (!r.content.includes(anchor)) return warn(`js funcs: init anchor not found`);

  const block = `        // ${TAG}:funcs
        var _txLoading = false;
        if (!bankState.txFilters) bankState.txFilters = { type: '', from: '', to: '', search: '' };
        if (typeof bankState.txPage !== 'number') bankState.txPage = 0;
        if (typeof bankState.txTotal !== 'number') bankState.txTotal = 0;
        if (typeof bankState.txLimit !== 'number') bankState.txLimit = 20;

        function getAuthToken(){
            try {
                return JSON.parse(localStorage.getItem('sfera_user') || '{}').token
                    || localStorage.getItem('token') || '';
            } catch(e) { return localStorage.getItem('token') || ''; }
        }

        async function loadTransactions(){
            if (_txLoading) return;
            _txLoading = true;
            try {
                const f = bankState.txFilters;
                const params = new URLSearchParams();
                params.set('limit', String(bankState.txLimit));
                params.set('skip', String(bankState.txPage * bankState.txLimit));
                if (f.type)   params.set('type', f.type);
                if (f.from)   params.set('from', f.from);
                if (f.to)     params.set('to', f.to);
                if (f.search) params.set('search', f.search);

                const res = await fetch('/api/bank/transactions?' + params.toString(), {
                    headers: { 'Authorization': 'Bearer ' + getAuthToken() }
                });
                if (res.status === 401) { location.href = 'login.html'; return; }
                if (!res.ok) throw new Error('HTTP ' + res.status);

                const body = await res.json();
                if (body && body.success && Array.isArray(body.data)) {
                    bankState.transactions = body.data;
                    bankState.txTotal = Number(body.total) || 0;
                    renderHistory();
                }
            } catch (e) {
                console.warn('[loadTransactions]', e.message);
            } finally {
                _txLoading = false;
            }
        }

        function updatePagination(){
            const el = document.getElementById('txPagination');
            if (!el) return;
            if (bankState.txTotal <= bankState.txLimit) { el.style.display = 'none'; return; }
            el.style.display = 'flex';
            const totalPages = Math.max(1, Math.ceil(bankState.txTotal / bankState.txLimit));
            const curPage = bankState.txPage + 1;
            const info = document.getElementById('txPageInfo');
            if (info) info.textContent = curPage + ' / ' + totalPages;
            const prev = document.getElementById('txPrevBtn');
            const next = document.getElementById('txNextBtn');
            if (prev) prev.disabled = bankState.txPage <= 0;
            if (next) next.disabled = bankState.txPage >= totalPages - 1;
        }

        function _txRow(k, v){
            return '<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);">'
                + '<span style="color:#9fb5c8;font-size:13px;flex-shrink:0;">' + k + '</span>'
                + '<span style="font-size:13px;max-width:65%;text-align:right;word-break:break-all;">' + String(v == null ? '—' : v) + '</span>'
                + '</div>';
        }

        function openTxDetails(tx){
            if (!tx) return;
            const date = tx.createdAt ? new Date(tx.createdAt).toLocaleString() : '—';
            const m = document.createElement('div');
            m.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(3,8,14,.75);z-index:9999;';
            m.innerHTML = '<div style="background:#08131d;border:1px solid rgba(0,212,255,.4);border-radius:18px;padding:28px;max-width:460px;width:90%;color:#fff;max-height:80vh;overflow:auto;">'
                + '<div style="font-weight:700;margin-bottom:16px;font-size:16px;">Детали транзакции</div>'
                + _txRow('ID', tx._id || tx.id)
                + _txRow('Тип', tx.type)
                + _txRow('Статус', tx.status)
                + _txRow('Сумма', Number(tx.amount||0).toFixed(2) + ' ' + (tx.currency||'TMT'))
                + _txRow('Описание', tx.description)
                + _txRow('Дата', date)
                + _txRow('Отправитель', tx.fromAccountId || tx.sender)
                + _txRow('Получатель', tx.toAccount || tx.recipient)
                + _txRow('Idempotency', tx.idempotencyKey)
                + '<div style="display:flex;justify-content:flex-end;margin-top:16px;">'
                + '<button type="button" class="btn btn-outline" id="txClose">Закрыть</button>'
                + '</div></div>';
            document.body.appendChild(m);
            const close = () => m.remove();
            m.querySelector('#txClose').onclick = close;
            m.addEventListener('click', (e) => { if (e.target === m) close(); });
        }

        function bindTxClick(){
            const list = document.getElementById('transactionsList');
            if (!list || list.dataset.txBound === '1') return;
            list.dataset.txBound = '1';
            list.addEventListener('click', (e) => {
                const li = e.target.closest('li[data-tx-id]');
                if (!li) return;
                const id = li.dataset.txId;
                const tx = bankState.transactions.find(t => String(t._id || t.id) === id);
                if (tx) openTxDetails(tx);
            });
        }

        function bindTxFilters(){
            const type = document.getElementById('txFilterType');
            const from = document.getElementById('txFilterFrom');
            const to   = document.getElementById('txFilterTo');
            const search = document.getElementById('txFilterSearch');
            const reset = document.getElementById('txFilterReset');
            if (!type || type.dataset.bound === '1') return;
            type.dataset.bound = '1';

            const apply = () => {
                bankState.txFilters.type = type.value || '';
                bankState.txFilters.from = from.value || '';
                bankState.txFilters.to = to.value || '';
                bankState.txFilters.search = (search.value || '').trim();
                bankState.txPage = 0;
                loadTransactions();
            };
            type.addEventListener('change', apply);
            from.addEventListener('change', apply);
            to.addEventListener('change', apply);
            let timer = null;
            search.addEventListener('input', () => {
                clearTimeout(timer);
                timer = setTimeout(apply, 300);
            });
            reset.addEventListener('click', () => {
                type.value = ''; from.value = ''; to.value = ''; search.value = '';
                apply();
            });
        }

        function bindTxPagination(){
            const prev = document.getElementById('txPrevBtn');
            const next = document.getElementById('txNextBtn');
            if (!prev || prev.dataset.bound === '1') return;
            prev.dataset.bound = '1';
            prev.addEventListener('click', () => {
                if (bankState.txPage > 0) { bankState.txPage--; loadTransactions(); }
            });
            next.addEventListener('click', () => {
                const totalPages = Math.ceil(bankState.txTotal / bankState.txLimit);
                if (bankState.txPage < totalPages - 1) { bankState.txPage++; loadTransactions(); }
            });
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 4. renderHistory: data-id + click + updatePagination ----------------------
function patchRenderHistory() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:renderHistory`)) return log(`-- renderHistory: already patched`);

  const found = findFunctionBlock(r.content, 'function renderHistory()');
  if (!found) return warn(`renderHistory: function not found`);

  const newBody = `function renderHistory() {
            const list=$('transactionsList'); if(!list) return; list.replaceChildren();
            if(!bankState.transactions.length){
                $('emptyTx').style.display='block';
                updatePagination();
                return;
            }
            $('emptyTx').style.display='none';
            bankState.transactions.forEach(tx=>{
                const li=document.createElement('li');
                li.className = 'tx-item-clickable';
                li.dataset.txId = String(tx._id || tx.id || '');
                li.textContent=\`\${tx.description||'Transaction'} — \${Number(tx.amount||0).toFixed(2)} \${tx.currency||'TMT'}\`;
                list.appendChild(li);
            });
            bindTxClick();
            updatePagination();
        }`;

  const next = r.content.slice(0, found.start) + `// ${TAG}:renderHistory\n        ` + newBody + r.content.slice(found.end);
  writePatched(F.html, next, r.content);
}

// ---------------------- 5. activateTab: loadTransactions при 'history' ----------------------
function patchActivateTab() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:activateTab`)) return log(`-- activateTab: already patched`);

  const found = findFunctionBlock(r.content, 'function activateTab(');
  if (!found) return warn(`activateTab: function not found`);

  const newBody = `function activateTab(tab, updateHash=true) {
            const valid = ['accounts','cards','transfer','history','notifications'];
            if (!valid.includes(tab)) tab='accounts';
            bankState.activeTab=tab;
            document.querySelectorAll('.bank-tabs button').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===tab));
            document.querySelectorAll('.tab-content').forEach(panel=>panel.classList.toggle('active',panel.id===\`tab-\${tab}\`));
            if (tab === 'history' && typeof loadTransactions === 'function') {
                bindTxFilters();
                bindTxPagination();
                loadTransactions();
            }
            if (updateHash) history.replaceState(null,'',\`#\${tab}\`);
        }`;

  const next = r.content.slice(0, found.start) + `// ${TAG}:activateTab\n        ` + newBody + r.content.slice(found.end);
  writePatched(F.html, next, r.content);
}

// ---------------------- 6. loadBankData: НЕ трогает transactions + renderHistory ----------------------
function patchLoadBankData() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:load`)) return log(`-- loadBankData: already patched`);

  const found = findFunctionBlock(r.content, 'async function loadBankData');
  if (!found) return warn(`loadBankData: function not found`);
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
                bankState.notifications = Array.isArray(ndata.data)
                    ? ndata.data
                    : (Array.isArray(ndata) ? ndata : (Array.isArray(data.notifications) ? data.notifications : []));
                // bankState.transactions НЕ трогаем — источник теперь /api/bank/transactions через loadTransactions()
                renderAccounts(); renderCards(); renderNotifications();
                populateFromAccounts(); updateTotalBalance();
            } catch(err) {
                if (err && err.status === 401) { location.href = 'login.html'; return; }
                showMessage(err.message || t('bank_load_error','Ýüklemek başartmady'),'error');
            } finally {
                _bankLoading = false;
                hideSkeletons();
            }
        }`;

  const next = r.content.slice(0, found.start) + `// ${TAG}:load — не трогаем transactions, история через loadTransactions()\n        ` + newBody + r.content.slice(found.end);
  writePatched(F.html, next, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 2.2b-3 - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- CSS (filters/pagination/rows) --'); patchCss();
  log('\n-- HTML (filters + pagination block) --'); patchHtmlBlock();
  log('\n-- JS funcs (loadTransactions, openTxDetails, bind*) --'); patchJsFuncs();
  log('\n-- renderHistory (data-id + click) --'); patchRenderHistory();
  log('\n-- activateTab (loadTransactions on history) --'); patchActivateTab();
  log('\n-- loadBankData (не трогает transactions) --'); patchLoadBankData();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint2b3.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }