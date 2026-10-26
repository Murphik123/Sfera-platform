#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.1b — Socket.IO frontend
 * - <script src="/socket.io/socket.io.js">
 * - socket.connect с auth token
 * - balance_updated → loadBankData({skeleton:false}) + toast
 * - bank_notification → prepend + renderNotifications
 * - disconnect → polling остаётся, reconnect → loadBankData
 * - polling скипается если socket.connected
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT3.1b';
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

// ---------------------- 1. <script src="/socket.io/socket.io.js"> ----------------------
function patchScriptTag() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:script`)) return log(`-- script tag: already patched`);

  const anchor = `    <script src="/js/api.js"></script>`;
  if (!r.content.includes(anchor)) return warn(`script tag: api.js anchor not found`);

  const replacement = `    <!-- ${TAG}:script — Socket.IO client -->
    <script src="/socket.io/socket.io.js"></script>
${anchor}`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

// ---------------------- 2. socket init + handlers ----------------------
function patchSocketInit() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:init`)) return log(`-- socket init: already patched`);

  // вставляем после init при загрузке (после loadBankData({skeleton:true}))
  const anchor = `        // SFERA-PATCH:SPRINT2.2b2-fix:init — при первой загрузке skeleton
        loadBankData({ skeleton: true });
        populateUsername();`;
  if (!r.content.includes(anchor)) return warn(`socket init: init anchor not found`);

  const block = `${anchor}

        // ${TAG}:init — Socket.IO realtime
        (function initBankSocket(){
            if (typeof io !== 'function') {
                console.warn('[${TAG}] io not loaded — polling only');
                return;
            }
            const token = getAuthToken();
            if (!token) {
                console.warn('[${TAG}] no token — polling only');
                return;
            }

            let socket;
            try {
                socket = io({ auth: { token: token }, transports: ['websocket', 'polling'] });
            } catch (e) {
                console.warn('[${TAG}] io init failed:', e.message);
                return;
            }

            window._bankSocket = socket;

            socket.on('connect', () => {
                console.log('[${TAG}] connected', socket.id);
            });

            socket.on('balance_updated', (payload) => {
                console.log('[${TAG}] balance_updated', payload);
                // Тихое обновление без skeleton — WS уже принёс новый баланс
                if (typeof loadBankData === 'function') {
                    loadBankData({ skeleton: false });
                }
                if (payload && payload.direction === 'in' && payload.amount) {
                    showMessage('Поступление: +' + Number(payload.amount).toFixed(2) + ' TMT', 'success');
                }
            });

            socket.on('bank_notification', (payload) => {
                console.log('[${TAG}] bank_notification', payload);
                if (!payload) return;
                const note = {
                    _id: payload.transactionId || ('ws-' + Date.now()),
                    type: payload.type || 'info',
                    message: payload.message || '',
                    read: false,
                    createdAt: new Date().toISOString()
                };
                if (!Array.isArray(bankState.notifications)) bankState.notifications = [];
                // Не дублируем
                const exists = bankState.notifications.some(n => String(n._id) === String(note._id));
                if (!exists) {
                    bankState.notifications.unshift(note);
                    renderNotifications();
                }
            });

            socket.on('disconnect', (reason) => {
                console.warn('[${TAG}] disconnected:', reason, '— polling continues');
            });

            socket.on('connect_error', (err) => {
                console.warn('[${TAG}] connect_error:', err.message);
            });
        })();`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 3. polling skip если socket connected ----------------------
function patchPolling() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:polling`)) return log(`-- polling: already patched`);

  const anchor = `        setInterval(() => {
            if (document.visibilityState === 'visible') loadBankData();
        }, 30000);`;
  if (!r.content.includes(anchor)) return warn(`polling: setInterval anchor not found`);

  const replacement = `        // ${TAG}:polling — skip если WS жив (WS обновляет сам), иначе fallback
        setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            const s = window._bankSocket;
            if (s && s.connected) return; // WS активен — polling не нужен
            loadBankData();
        }, 30000);`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.1b (frontend) - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- Script tag (socket.io client) --'); patchScriptTag();
  log('\n-- Socket init + handlers --'); patchSocketInit();
  log('\n-- Polling skip если WS жив --'); patchPolling();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3b.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }