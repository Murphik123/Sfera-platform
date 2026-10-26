#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.3 — QR-код для получения перевода
 * - Копирует dist/qrcode.js из node_modules в public/js/qrcode.min.js (UMD, проверено)
 * - Новая вкладка "Almak" (Получить) с QR + IBAN + кнопки
 * - renderReceive() при активации вкладки
 * - Кнопки: копировать IBAN, скачать QR
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT3.3';
const ROOT = path.resolve(__dirname, '..');
const DRY = !process.argv.includes('--apply');
const F = { html: 'public/bank.html' };
const QR_DEST = 'public/js/qrcode.min.js';

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
  if (ratio < 0.98 || ratio > 1.35) return { ok: false, reason: `size ratio ${ratio.toFixed(2)}` };
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

// ---------------------- 1. Копирование qrcode.js ----------------------
function copyQrcode() {
  const dest = path.join(ROOT, QR_DEST);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) {
    return log(`-- qrcode: already exists (${fs.statSync(dest).size} bytes)`);
  }
  const candidates = [
    'server/node_modules/qrcode-generator/dist/qrcode.js',
    'server/node_modules/qrcode-generator/qrcode.js',
    'server/node_modules/qrcode-generator/js/qrcode.js',
    'server/node_modules/qrcode-generator/dist/qrcode_UTF8.js',
  ];
  let src = null;
  for (const c of candidates) {
    const p = path.join(ROOT, c);
    if (fs.existsSync(p)) { src = p; break; }
  }
  if (!src) return warn(`qrcode: source not found. Проверь: ls server/node_modules/qrcode-generator/dist/`);

  if (DRY) return log(`-- qrcode: will copy ${path.relative(ROOT, src)} -> ${QR_DEST}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  ok(`qrcode: ${QR_DEST} (${fs.statSync(dest).size} bytes)`);
}

// ---------------------- 2. <script src="/js/qrcode.min.js"> ----------------------
function patchScriptTag() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:script`)) return log(`-- script: already patched`);

  const anchor = `    <script src="/js/api.js"></script>`;
  if (!r.content.includes(anchor)) return warn(`script: api.js anchor not found`);

  const replacement = `    <!-- ${TAG}:script — QR lib (UMD) -->
    <script src="/js/qrcode.min.js"></script>
${anchor}`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

// ---------------------- 3. Кнопка вкладки ----------------------
function patchTabButton() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:tab`)) return log(`-- tab: already patched`);

  const anchor = `                <button data-tab="notifications" data-i18n="tab_notifications">Bildirişler</button>`;
  if (!r.content.includes(anchor)) return warn(`tab: notifications button anchor not found`);

  const replacement = `${anchor}
                <button data-tab="receive" data-i18n="tab_receive">Almak</button>`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

// ---------------------- 4. Контент вкладки ----------------------
function patchTabContent() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:content`)) return log(`-- content: already patched`);

  const anchor = `            <div class="tab-content" id="tab-notifications">
                <div id="notificationsList"></div>
                <div class="empty-state" id="emptyNotif" style="display:none;">
                    <div class="icon">🔔</div>
                    <p data-i18n="no_notifications">Täze bildiriş ýok</p>
                </div>
            </div>`;

  if (!r.content.includes(anchor)) return warn(`content: notifications tab anchor not found`);

  const replacement = `${anchor}

            <!-- ${TAG}:content -->
            <div class="tab-content" id="tab-receive">
                <div class="qr-section">
                    <h3 class="qr-title" data-i18n="receive_title">Получить перевод</h3>
                    <p class="qr-hint" data-i18n="receive_hint">Отсканируйте QR в мобильном банке или скопируйте IBAN</p>
                    <div class="qr-container">
                        <div id="qrCodeBox" class="qr-code">Загрузка...</div>
                    </div>
                    <div class="qr-iban-block">
                        <label class="qr-label" data-i18n="your_iban">Ваш IBAN</label>
                        <div class="qr-iban" id="qrIbanText">—</div>
                    </div>
                    <div class="qr-actions">
                        <button type="button" class="btn btn-primary" id="qrCopyBtn">📋 <span data-i18n="copy_iban">Копировать IBAN</span></button>
                        <button type="button" class="btn btn-outline" id="qrDownloadBtn">💾 <span data-i18n="download_qr">Скачать QR</span></button>
                    </div>
                </div>
            </div>`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

// ---------------------- 5. CSS ----------------------
function patchCss() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:css`)) return log(`-- css: already patched`);

  const anchor = `        /* SFERA-PATCH:SPRINT3.2b:css — export button + dropdown */`;
  if (!r.content.includes(anchor)) return warn(`css: SPRINT3.2b css anchor not found`);

  const block = `        /* ${TAG}:css — QR receive */
        .qr-section {
            max-width: 480px;
            margin: 0 auto;
            text-align: center;
            padding: 12px 0;
        }
        .qr-title {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 8px;
            background: linear-gradient(135deg, #ffffff, #b4d7ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .qr-hint {
            color: #9fb5c8;
            font-size: 14px;
            margin-bottom: 24px;
        }
        .qr-container {
            display: flex;
            justify-content: center;
            margin-bottom: 20px;
        }
        .qr-code {
            background: #ffffff;
            padding: 16px;
            border-radius: 16px;
            border: 2px solid rgba(0,212,255,.4);
            box-shadow: 0 0 30px rgba(0,212,255,.2);
            min-width: 240px;
            min-height: 240px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            font-size: 12px;
        }
        .qr-code img {
            display: block;
            max-width: 100%;
            height: auto;
        }
        .qr-iban-block {
            margin-bottom: 20px;
            background: rgba(255,255,255,.04);
            border: 1px solid rgba(0,212,255,.2);
            border-radius: 12px;
            padding: 14px 16px;
        }
        .qr-label {
            display: block;
            color: #9fb5c8;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 6px;
        }
        .qr-iban {
            font-family: 'Courier New', monospace;
            font-size: 16px;
            color: #00d4ff;
            letter-spacing: 1px;
            word-break: break-all;
        }
        .qr-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
        }
        @media (max-width: 640px) {
            .qr-actions button { flex: 1 1 100%; }
            .qr-iban { font-size: 13px; }
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 6. JS: renderReceive + bindReceiveActions ----------------------
function patchJs() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:js`)) return log(`-- js: already patched`);

  const anchor = `        function activateTab(tab, updateHash=true) {`;
  if (!r.content.includes(anchor)) return warn(`js: activateTab anchor not found`);

  const block = `        // ${TAG}:js — renderReceive + actions
        function renderReceive(){
            const box = document.getElementById('qrCodeBox');
            const ibanEl = document.getElementById('qrIbanText');
            if (!box) return;

            const mainAcc = (bankState.accounts || []).find(a => a.currency === 'TMT' && a.number) || (bankState.accounts || [])[0];
            const iban = mainAcc && mainAcc.number ? mainAcc.number : '';

            if (ibanEl) ibanEl.textContent = iban || '—';
            box.replaceChildren();

            if (!iban) {
                box.textContent = 'IBAN не найден. Обновите страницу.';
                return;
            }

            if (typeof qrcode !== 'function') {
                box.textContent = 'QR-библиотека не загружена';
                return;
            }

            try {
                const qr = qrcode(0, 'M');
                qr.addData(iban);
                qr.make();
                box.innerHTML = qr.createImgTag(6, 4);
            } catch (e) {
                box.textContent = 'Ошибка QR: ' + e.message;
            }
        }

        function bindReceiveActions(){
            const copyBtn = document.getElementById('qrCopyBtn');
            const dlBtn = document.getElementById('qrDownloadBtn');
            if (copyBtn && copyBtn.dataset.bound !== '1') {
                copyBtn.dataset.bound = '1';
                copyBtn.addEventListener('click', async () => {
                    const iban = document.getElementById('qrIbanText')?.textContent || '';
                    if (!iban || iban === '—') return;
                    try {
                        await navigator.clipboard.writeText(iban);
                        showMessage('IBAN скопирован: ' + iban, 'success');
                    } catch (e) {
                        showMessage('Не удалось скопировать', 'error');
                    }
                });
            }
            if (dlBtn && dlBtn.dataset.bound !== '1') {
                dlBtn.dataset.bound = '1';
                dlBtn.addEventListener('click', () => {
                    const img = document.querySelector('#qrCodeBox img');
                    if (!img) return showMessage('QR ещё не сгенерирован', 'error');
                    const a = document.createElement('a');
                    a.href = img.src;
                    a.download = 'sfera-iban-qr.gif';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => a.remove(), 100);
                    showMessage('QR скачан', 'success');
                });
            }
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 7. activateTab: valid + renderReceive ----------------------
function patchActivateTab() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:activateTab`)) return log(`-- activateTab: already patched`);

  const validAnchor = `const valid = ['accounts','cards','transfer','history','notifications'];`;
  if (!r.content.includes(validAnchor)) return warn(`activateTab: valid array not found`);
  let c = r.content.replace(validAnchor, `const valid = ['accounts','cards','transfer','history','notifications','receive']; // ${TAG}`);

  const historyAnchor = `            if (tab === 'history' && typeof loadTransactions === 'function') {
                bindTxFilters();
                bindTxPagination();
                // SFERA-PATCH:SPRINT3.2b:activateTab
                if (typeof bindTxExport === 'function') bindTxExport();
                loadTransactions();
            }`;
  if (!c.includes(historyAnchor)) return warn(`activateTab: history block not found`);

  const historyRepl = `${historyAnchor}
            if (tab === 'receive' && typeof renderReceive === 'function') {
                renderReceive();
                bindReceiveActions();
            }`;

  c = c.replace(historyAnchor, historyRepl);
  writePatched(F.html, c, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.3 (QR) - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- Copy qrcode.js from node_modules --'); copyQrcode();
  log('\n-- <script src="/js/qrcode.min.js"> --'); patchScriptTag();
  log('\n-- Tab button "Almak" --'); patchTabButton();
  log('\n-- Tab content (QR + IBAN + buttons) --'); patchTabContent();
  log('\n-- CSS --'); patchCss();
  log('\n-- JS (renderReceive + actions) --'); patchJs();
  log('\n-- activateTab (valid + renderReceive) --'); patchActivateTab();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3f.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }