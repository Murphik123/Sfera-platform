#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.4n — card reveal UI (👁 + модалка + auto-hide)
 * v2: CSS вставляется как отдельный <style> блок ПЕРЕД </head> (не в существующий <style>).
 * Anchor </head> — уникален, не зависит от того, какие <script> перенесены в body.
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT3.4n';
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

function validate(content) {
  if (!content.startsWith('<!DOCTYPE html>')) return { ok: false, reason: 'DOCTYPE not first line' };
  const inlineIdx = content.indexOf('SFERA BANK — approval candidate v22');
  if (inlineIdx === -1) return { ok: false, reason: 'inline marker not found' };
  for (const file of ['/socket.io/socket.io.js', '/js/api.js', '/scripts/auto_translate_i18n.js']) {
    const idx = content.indexOf(file);
    if (idx === -1) return { ok: false, reason: `${file} MISSING` };
    if (idx > inlineIdx) return { ok: false, reason: `${file} AFTER inline` };
  }
  const m = [...content.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
  try { new Function(m.map(x => x[1]).join('\n;\n')); }
  catch (e) { return { ok: false, reason: `inline JS: ${e.message}` }; }
  for (const fn of ['function renderCards', 'function activateTab', 'window.showToast', 'function toggleCardFreeze']) {
    if (!content.includes(fn)) return { ok: false, reason: `missing ${fn}` };
  }
  return { ok: true };
}

function writePatched(rel, content, before) {
  const p = path.join(ROOT, rel);
  if (content === before) { log(`-- ${rel}: no change`); return true; }

  const v1 = validate(content);
  if (!v1.ok) { bad(`VALIDATE fail: ${v1.reason} — файл НЕ записан`); return false; }

  if (DRY) { log(`-- ${rel}: will change`); return true; }

  const bak = backup(p);
  const r = read(rel);
  const out = r.originalEol === '\r\n' ? content.replace(/\n/g, '\r\n') : content;
  fs.writeFileSync(p, out, 'utf8');
  ok(`${rel}  <-  ${path.basename(bak)}`);

  const after = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const v2 = validate(after);
  if (!v2.ok) { bad(`POST-CHECK fail: ${v2.reason} -> REVERT`); fs.copyFileSync(bak, p); return false; }
  ok(`post-check ok: DOCTYPE + order + inline JS + functions`);
  return true;
}

// ---------------------- CSS: отдельный <style> блок ----------------------
function buildCss() {
  return `    <style>
        /* ${TAG}:css — reveal card modal */
        .reveal-card-btn {
            margin-top: auto;
            padding: 7px 14px;
            border-radius: 10px;
            border: 1px solid rgba(0,212,255,.35);
            background: rgba(0,212,255,.08);
            color: #dbe9ff;
            font-size: 12px;
            cursor: pointer;
            transition: .2s;
        }
        .reveal-card-btn:hover {
            background: rgba(0,212,255,.2);
            border-color: rgba(0,212,255,.7);
            color: #00d4ff;
        }
        .card-actions-row {
            margin-top: auto;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .reveal-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(3,8,14,.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            padding: 20px;
        }
        .reveal-modal-box {
            background: #08131d;
            border: 1px solid rgba(0,212,255,.4);
            border-radius: 18px;
            padding: 28px;
            max-width: 420px;
            width: 100%;
            color: #fff;
            position: relative;
            overflow: hidden;
        }
        .reveal-modal-title {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 16px;
            background: linear-gradient(135deg, #ffffff, #b4d7ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .reveal-modal-hint {
            color: #9fb5c8;
            font-size: 13px;
            margin-bottom: 16px;
        }
        .reveal-input {
            width: 100%;
            padding: 11px 14px;
            border-radius: 10px;
            border: 1px solid rgba(0,212,255,.2);
            background: rgba(255,255,255,.05);
            color: #fff;
            font-size: 14px;
            margin-bottom: 14px;
            outline: none;
        }
        .reveal-input:focus {
            border-color: #00d4ff;
        }
        .reveal-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        .reveal-data {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 16px;
        }
        .reveal-row {
            padding: 12px 14px;
            background: rgba(0,212,255,.06);
            border: 1px solid rgba(0,212,255,.2);
            border-radius: 10px;
        }
        .reveal-row-label {
            font-size: 11px;
            color: #9fb5c8;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
        }
        .reveal-row-value {
            font-family: 'Courier New', monospace;
            font-size: 15px;
            font-weight: 600;
            color: #00d4ff;
            letter-spacing: 1px;
            word-break: break-all;
            cursor: pointer;
            user-select: all;
        }
        .reveal-row-value:hover {
            color: #00ffa3;
        }
        .reveal-progress {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            background: linear-gradient(90deg, #00d4ff, #00ffa3);
            transition: width 1s linear;
        }
        .reveal-error {
            color: #ff6b6b;
            font-size: 13px;
            margin-bottom: 12px;
            padding: 10px;
            background: rgba(255,107,107,.1);
            border: 1px solid rgba(255,107,107,.3);
            border-radius: 8px;
        }
    </style>
`;
}

function patchCss() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:css`)) return log(`-- css: already patched`);

  const anchor = `</head>`;
  if (!r.content.includes(anchor)) return warn(`css: </head> not found`);

  // Вставляем полный <style> блок ПЕРЕД </head>. </head> остаётся один — в конце insertion.
  const insertion = buildCss() + `</head>`;
  const next = r.content.replace(anchor, insertion);
  writePatched(F.html, next, r.content);
}

// ---------------------- renderCards: 👁 кнопка ----------------------
function patchRenderCards() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:renderCards`)) return log(`-- renderCards: already patched`);

  const anchor = `                card.append(type, num, exp, logo, badge, btn);
                grid.appendChild(card);`;

  if (!r.content.includes(anchor)) return warn(`renderCards: anchor not found — пришли grep -A10 "function renderCards" public/bank.html`);

  const replacement = `                // ${TAG}:renderCards — добавляем 👁 кнопку
                var revealBtn = document.createElement('button');
                revealBtn.type = 'button';
                revealBtn.className = 'reveal-card-btn';
                revealBtn.dataset.action = 'reveal';
                revealBtn.dataset.cardId = String(c.id || c._id || '');
                revealBtn.textContent = '👁 Реквизиты';

                var actionsRow = document.createElement('div');
                actionsRow.className = 'card-actions-row';
                actionsRow.appendChild(btn);
                actionsRow.appendChild(revealBtn);

                card.append(type, num, exp, logo, badge, actionsRow);
                grid.appendChild(card);`;

  let c = r.content.replace(anchor, replacement);

  const freezeHandlerAnchor = `            grid.querySelectorAll('button[data-action="toggle-freeze"]').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleCardFreeze(b.dataset.cardId, b.dataset.frozen === 'true');
                });
            });`;

  if (!c.includes(freezeHandlerAnchor)) return warn(`renderCards: freeze handler anchor not found`);

  const freezeHandlerRepl = freezeHandlerAnchor + `

            // ${TAG}:reveal-handler
            grid.querySelectorAll('button[data-action="reveal"]').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openRevealPasswordModal(b.dataset.cardId);
                });
            });`;

  c = c.replace(freezeHandlerAnchor, freezeHandlerRepl);
  writePatched(F.html, c, r.content);
}

// ---------------------- JS: reveal функции ----------------------
function patchJs() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:js`)) return log(`-- js: already patched`);

  const anchor = `        function activateTab(tab, updateHash=true) {`;
  if (!r.content.includes(anchor)) return warn(`js: activateTab anchor not found`);

  const jsBlock = `        // ${TAG}:js — reveal card modal
        var _revealTimer = null;
        var _revealCurrentCardId = null;

        function openRevealPasswordModal(cardId) {
            _revealCurrentCardId = cardId;
            var existing = document.getElementById('revealPasswordModal');
            if (existing) existing.remove();

            var ov = document.createElement('div');
            ov.className = 'reveal-modal-overlay';
            ov.id = 'revealPasswordModal';
            ov.innerHTML = '<div class="reveal-modal-box">'
                + '<div class="reveal-modal-title">Реквизиты карты</div>'
                + '<div class="reveal-modal-hint">Введите пароль от аккаунта для просмотра</div>'
                + '<div id="revealErr" class="reveal-error" style="display:none;"></div>'
                + '<input type="password" class="reveal-input" id="revealPasswordInput" placeholder="Пароль..." autocomplete="current-password" />'
                + '<div class="reveal-actions">'
                + '<button type="button" class="btn btn-outline" id="revealCancel">Отмена</button>'
                + '<button type="button" class="btn btn-primary" id="revealSubmit">Показать</button>'
                + '</div></div>';
            document.body.appendChild(ov);

            var input = document.getElementById('revealPasswordInput');
            setTimeout(function() { input && input.focus(); }, 50);

            var submit = async function() {
                var pwd = (input && input.value || '').trim();
                if (!pwd) { showRevealError('Введите пароль'); return; }
                var btn = document.getElementById('revealSubmit');
                if (btn) { btn.disabled = true; btn.textContent = '...'; }
                try {
                    var res = await fetch('/api/bank/cards/' + cardId + '/reveal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
                        body: JSON.stringify({ password: pwd })
                    });
                    var body = await res.json().catch(function(){ return {}; });
                    if (!res.ok) {
                        if (res.status === 401) showRevealError('Неверный пароль');
                        else if (res.status === 429) showRevealError('Слишком много попыток. Подождите 5 минут.');
                        else if (res.status === 403) showRevealError('Карта заморожена');
                        else showRevealError(body.message || ('Ошибка ' + res.status));
                        return;
                    }
                    ov.remove();
                    showRevealData(cardId, body.data);
                } catch (e) {
                    showRevealError('Сеть: ' + e.message);
                } finally {
                    if (btn) { btn.disabled = false; btn.textContent = 'Показать'; }
                }
            };

            document.getElementById('revealCancel').onclick = function() { ov.remove(); };
            document.getElementById('revealSubmit').onclick = submit;
            input.addEventListener('keydown', function(e) { if (e.key === 'Enter') submit(); });
            ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
        }

        function showRevealError(msg) {
            var el = document.getElementById('revealErr');
            if (el) { el.textContent = msg; el.style.display = 'block'; }
        }

        function formatCardPan(pan) {
            var s = String(pan || '').replace(/\\s+/g, '');
            return s.replace(/(.{4})/g, '$1 ').trim();
        }

        function showRevealData(cardId, data) {
            _revealCurrentCardId = cardId;
            if (_revealTimer) { clearInterval(_revealTimer); _revealTimer = null; }

            var existing = document.getElementById('revealDataModal');
            if (existing) existing.remove();

            var ov = document.createElement('div');
            ov.className = 'reveal-modal-overlay';
            ov.id = 'revealDataModal';

            ov.innerHTML = '<div class="reveal-modal-box" style="position:relative;">'
                + '<div class="reveal-modal-title">Реквизиты карты</div>'
                + '<div class="reveal-modal-hint">Скрыть через <span id="revealCountdown">15</span> сек. Клик по значению — копирует.</div>'
                + '<div class="reveal-data">'
                + '<div class="reveal-row"><div class="reveal-row-label">Номер</div><div class="reveal-row-value" data-copy="' + data.fullNumber + '">' + formatCardPan(data.fullNumber) + '</div></div>'
                + '<div class="reveal-row"><div class="reveal-row-label">CVV</div><div class="reveal-row-value" data-copy="' + data.cvv + '">' + data.cvv + '</div></div>'
                + '<div class="reveal-row"><div class="reveal-row-label">Срок действия</div><div class="reveal-row-value" data-copy="' + data.expiry + '">' + data.expiry + '</div></div>'
                + '</div>'
                + '<div class="reveal-actions">'
                + '<button type="button" class="btn btn-outline" id="revealClose">Скрыть</button>'
                + '</div>'
                + '<div class="reveal-progress" id="revealProgress" style="width:100%;"></div>'
                + '</div>';
            document.body.appendChild(ov);

            ov.querySelectorAll('[data-copy]').forEach(function(el) {
                el.addEventListener('click', async function() {
                    try {
                        await navigator.clipboard.writeText(el.dataset.copy);
                        showToast('Скопировано: ' + el.dataset.copy, 'success');
                    } catch (e) {
                        showToast('Не удалось скопировать', 'error');
                    }
                });
            });

            var close = function() {
                if (_revealTimer) { clearInterval(_revealTimer); _revealTimer = null; }
                ov.remove();
            };
            document.getElementById('revealClose').onclick = close;
            ov.addEventListener('click', function(e) { if (e.target === ov) close(); });

            var remaining = 15;
            var prog = document.getElementById('revealProgress');
            _revealTimer = setInterval(function() {
                remaining--;
                var cd = document.getElementById('revealCountdown');
                if (cd) cd.textContent = String(Math.max(0, remaining));
                if (prog) prog.style.width = Math.max(0, (remaining / 15) * 100) + '%';
                if (remaining <= 0) close();
            }, 1000);
        }

${anchor}`;

  const next = r.content.replace(anchor, jsBlock);
  writePatched(F.html, next, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.4n (Card reveal UI) - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found'); process.exit(1);
  }
  log('-- CSS reveal modal --'); patchCss();
  log('\n-- renderCards: 👁 кнопка --'); patchRenderCards();
  log('\n-- JS: reveal функции --'); patchJs();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3s.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }