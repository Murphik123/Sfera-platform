#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.4de — cards 360×227 + premium balance (quick actions)
 * Объединено: не зависим от отдельного j.js.
 * - .cards-grid: repeat(auto-fill, 360px)
 * - .card-item: 360×227
 * - .balance-card: flex-column (main + quick actions)
 * - Quick actions: → Перевод / ↓ Получить / 📊 История
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT3.4de';
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

// ---------------------- 1. HTML: balance-card → main + quick actions ----------------------
function patchHtmlBalance() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:html`)) return log(`-- html: already patched`);

  const anchor = `            <div class="balance-card">
                <div>
                    <div class="balance-label" data-i18n="total_balance">Jemi balans</div>
                    <div>
                        <span class="balance-amount" id="totalBalance">0.00</span>
                        <span class="balance-currency">TMT</span>
                    </div>
                    <div class="account-number"><span data-i18n="account_label">Hasap:</span> <span id="mainAccount">1234 5678 9012 3456</span></div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:14px; color:#bdd0df;" data-i18n="premium_label">★ Premium hyzmat</div>
                    <div style="font-size:12px; color:#9fb5c8;"><span data-i18n="active_since_label">Işjeň:</span> <span id="activeSince">2024</span></div>
                </div>
            </div>`;

  if (!r.content.includes(anchor)) return warn(`html: balance-card anchor not found — пришли grep -A5 "balance-card" public/bank.html`);

  const replacement = `            <!-- ${TAG}:html -->
            <div class="balance-card">
                <div class="balance-main">
                    <div>
                        <div class="balance-label" data-i18n="total_balance">Jemi balans</div>
                        <div>
                            <span class="balance-amount" id="totalBalance">0.00</span>
                            <span class="balance-currency">TMT</span>
                        </div>
                        <div class="account-number"><span data-i18n="account_label">Hasap:</span> <span id="mainAccount">1234 5678 9012 3456</span></div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:14px; color:#bdd0df;" data-i18n="premium_label">★ Premium hyzmat</div>
                        <div style="font-size:12px; color:#9fb5c8;"><span data-i18n="active_since_label">Işjeň:</span> <span id="activeSince">2024</span></div>
                    </div>
                </div>
                <div class="balance-quick-actions">
                    <button type="button" class="qa-btn" data-qa-tab="transfer">
                        <span class="qa-icon">→</span>
                        <span data-i18n="tab_transfer">Geçiriş</span>
                    </button>
                    <button type="button" class="qa-btn" data-qa-tab="receive">
                        <span class="qa-icon">↓</span>
                        <span data-i18n="tab_receive">Almak</span>
                    </button>
                    <button type="button" class="qa-btn" data-qa-tab="history">
                        <span class="qa-icon">📊</span>
                        <span data-i18n="tab_history">Taryh</span>
                    </button>
                </div>
            </div>`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

// ---------------------- 2. CSS: cards 360×227 + premium balance ----------------------
function patchCss() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:css`)) return log(`-- css: already patched`);

  const anchor = `        /* SFERA-PATCH:SPRINT3.4c:css — align tabs + tab-content с balance-card (920px) */`;
  if (!r.content.includes(anchor)) return warn(`css: SPRINT3.4c anchor not found — пришли grep -n "SPRINT3.4c" public/bank.html`);

  const block = `        /* ${TAG}:css — cards 360×227 + premium balance */
        .cards-grid {
            grid-template-columns: repeat(auto-fill, 360px);
            justify-content: start;
        }
        .card-item {
            width: 360px;
            height: 227px;
            box-sizing: border-box;
        }
        .balance-card {
            flex-direction: column;
            align-items: stretch;
            gap: 18px;
        }
        .balance-main {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            width: 100%;
        }
        .balance-quick-actions {
            display: flex;
            gap: 10px;
            padding-top: 16px;
            border-top: 1px solid rgba(0,212,255,.15);
            width: 100%;
        }
        .balance-quick-actions .qa-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 16px;
            background: rgba(255,255,255,.04);
            border: 1px solid rgba(0,212,255,.2);
            border-radius: 12px;
            color: #dbe9ff;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: transform .25s, background .25s, border-color .25s, color .25s;
            font-family: inherit;
        }
        .balance-quick-actions .qa-btn:hover {
            background: rgba(0,212,255,.12);
            border-color: rgba(0,212,255,.55);
            color: #00d4ff;
            transform: translateY(-2px);
        }
        .balance-quick-actions .qa-btn:active {
            transform: translateY(0);
        }
        .balance-quick-actions .qa-icon {
            font-size: 18px;
            line-height: 1;
        }
        @media (max-width: 640px) {
            .cards-grid {
                grid-template-columns: 1fr;
            }
            .card-item {
                width: 100%;
                max-width: 360px;
                height: auto;
                min-height: 200px;
            }
            .balance-quick-actions {
                flex-wrap: wrap;
            }
            .balance-quick-actions .qa-btn {
                flex: 1 1 calc(50% - 5px);
                font-size: 13px;
                padding: 10px 12px;
            }
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 3. JS: bindBalanceQuickActions ----------------------
function patchJs() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:js`)) return log(`-- js: already patched`);

  const anchor = `        function activateTab(tab, updateHash=true) {`;
  if (!r.content.includes(anchor)) return warn(`js: activateTab anchor not found`);

  const block = `        // ${TAG}:js — quick actions
        function bindBalanceQuickActions() {
            const btns = document.querySelectorAll('.balance-quick-actions .qa-btn[data-qa-tab]');
            btns.forEach(btn => {
                if (btn.dataset.bound === '1') return;
                btn.dataset.bound = '1';
                btn.addEventListener('click', () => {
                    const tab = btn.dataset.qaTab;
                    if (tab && typeof activateTab === 'function') activateTab(tab);
                });
            });
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 4. init: bindBalanceQuickActions ----------------------
function patchInit() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:init`)) return log(`-- init: already patched`);

  const anchor = `        // SFERA-PATCH:SPRINT2.2b2-fix:init — при первой загрузке skeleton
        loadBankData({ skeleton: true });
        populateUsername();`;
  if (!r.content.includes(anchor)) return warn(`init: loadBankData init anchor not found`);

  const replacement = `        // SFERA-PATCH:SPRINT2.2b2-fix:init — при первой загрузке skeleton
        loadBankData({ skeleton: true });
        populateUsername();
        // ${TAG}:init
        bindBalanceQuickActions();`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.4de - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- HTML balance-main + quick actions --'); patchHtmlBalance();
  log('\n-- CSS cards 360×227 + premium balance --'); patchCss();
  log('\n-- JS bindBalanceQuickActions --'); patchJs();
  log('\n-- init bindBalanceQuickActions --'); patchInit();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3k.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }
