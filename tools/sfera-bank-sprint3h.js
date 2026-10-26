#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.4b — Cards frontend
 * - Кнопка "+ Täze kart" над cardsGrid
 * - Модалка создания (тип select, лимит number) — anchor </body> (независимый)
 * - renderCards: badge frozen + кнопка Заморозить/Разморозить
 * - toggleCardFreeze через PATCH /api/bank/cards/:id
 * - CSS: карточка, чип, overlay, модалка
 *
 * v2: patchHtmlModal использует anchor </body> (не зависит от patchHtmlButton).
 *     В dry-run все 6 секций дают will change без ложных WARN.
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT3.4b';
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

// ---------------------- 1. HTML: кнопка + Täze kart над grid ----------------------
function patchHtmlButton() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:btn`)) return log(`-- btn: already patched`);

  const anchor = `            <div class="tab-content" id="tab-cards">
                <div class="cards-grid" id="cardsGrid"></div>
            </div>`;
  if (!r.content.includes(anchor)) return warn(`btn: tab-cards anchor not found`);

  const replacement = `            <div class="tab-content" id="tab-cards">
                <!-- ${TAG}:btn -->
                <div class="cards-toolbar">
                    <button type="button" class="btn btn-primary" id="newCardBtn">+ Täze kart</button>
                </div>
                <div class="cards-grid" id="cardsGrid"></div>
            </div>`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

// ---------------------- 2. HTML: модалка создания (anchor </body>) ----------------------
function patchHtmlModal() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:modal`)) return log(`-- modal: already patched`);

  // независимый anchor — есть в файле всегда, не зависит от patchHtmlButton
  const anchor = `</body>`;
  if (!r.content.includes(anchor)) return warn(`modal: </body> anchor not found — пришли grep -n "</body>" public/bank.html`);

  const modal = `    <!-- ${TAG}:modal -->
    <div class="modal-overlay" id="newCardModal" style="display:none;">
        <div class="modal-box">
            <h3 class="modal-title">Новая карта</h3>
            <form id="newCardForm">
                <div class="form-group">
                    <label for="newCardType">Тип карты</label>
                    <select id="newCardType" required>
                        <option value="debit">Дебетовая</option>
                        <option value="credit">Кредитная</option>
                        <option value="virtual">Виртуальная</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="newCardLimit">Лимит (TMT)</label>
                    <input type="number" id="newCardLimit" min="100" max="100000" value="5000" required />
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-outline" id="newCardCancel">Отмена</button>
                    <button type="submit" class="btn btn-primary" id="newCardSubmit">Создать</button>
                </div>
            </form>
        </div>
    </div>

</body>`;

  const next = r.content.replace(anchor, modal);
  writePatched(F.html, next, r.content);
}

// ---------------------- 3. CSS ----------------------
function patchCss() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:css`)) return log(`-- css: already patched`);

  const anchor = `        /* SFERA-PATCH:SPRINT3.3:css — QR receive */`;
  if (!r.content.includes(anchor)) return warn(`css: SPRINT3.3 anchor not found`);

  const block = `        /* ${TAG}:css — cards toolbar + card-item + modal */
        .cards-toolbar {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 16px;
        }
        .card-item {
            position: relative;
            background: linear-gradient(135deg, rgba(0,212,255,.18), rgba(31,107,255,.08));
            border-radius: 18px;
            padding: 24px;
            border: 1px solid rgba(0,212,255,.25);
            box-shadow: 0 8px 25px rgba(0,0,0,.25);
            color: #ffffff;
            backdrop-filter: blur(10px);
            min-height: 180px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: .3s;
        }
        .card-item:hover {
            transform: translateY(-3px);
            border-color: rgba(0,212,255,.55);
        }
        .card-item.frozen {
            opacity: .55;
            filter: grayscale(0.6);
        }
        .card-item .card-type {
            font-size: 12px;
            color: #00d4ff;
            text-transform: uppercase;
            letter-spacing: 1.5px;
        }
        .card-item .card-number {
            font-size: 22px;
            font-weight: 600;
            letter-spacing: 3px;
            margin: 12px 0;
            font-family: 'Courier New', monospace;
        }
        .card-item .card-expiry {
            font-size: 13px;
            color: #bdd0df;
        }
        .card-item .card-logo {
            font-size: 30px;
            position: absolute;
            top: 20px;
            right: 22px;
        }
        .card-item .card-frozen-badge {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255,107,107,.9);
            color: white;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1px;
            display: none;
            z-index: 5;
        }
        .card-item.frozen .card-frozen-badge {
            display: block;
        }
        .card-item .card-freeze-btn {
            margin-top: auto;
            align-self: flex-start;
            padding: 7px 14px;
            border-radius: 10px;
            border: 1px solid rgba(0,212,255,.35);
            background: rgba(255,255,255,.05);
            color: #ffffff;
            font-size: 12px;
            cursor: pointer;
            transition: .2s;
        }
        .card-item .card-freeze-btn:hover {
            background: rgba(0,212,255,.15);
            border-color: rgba(0,212,255,.7);
        }
        .card-item.frozen .card-freeze-btn {
            border-color: rgba(0,255,163,.6);
            background: rgba(0,255,163,.1);
        }
        /* Modal */
        .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(3,8,14,.78);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
        }
        .modal-box {
            background: #08131d;
            border: 1px solid rgba(0,212,255,.4);
            border-radius: 18px;
            padding: 28px;
            max-width: 440px;
            width: 100%;
            color: #fff;
        }
        .modal-title {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 20px;
            background: linear-gradient(135deg, #ffffff, #b4d7ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .modal-box .form-group {
            margin-bottom: 14px;
        }
        .modal-box .form-group label {
            display: block;
            font-size: 13px;
            color: #9fb5c8;
            margin-bottom: 6px;
        }
        .modal-box .form-group select,
        .modal-box .form-group input {
            width: 100%;
            padding: 10px 12px;
            border-radius: 10px;
            border: 1px solid rgba(0,212,255,.18);
            background: rgba(255,255,255,.05);
            color: #fff;
            font-size: 14px;
            color-scheme: dark;
            outline: none;
        }
        .modal-box .form-group select option {
            background-color: #08131d;
            color: #ffffff;
        }
        .modal-box .form-group input:focus,
        .modal-box .form-group select:focus {
            border-color: #00d4ff;
        }
        .modal-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 20px;
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 4. renderCards — переписать ----------------------
function patchRenderCards() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:renderCards`)) return log(`-- renderCards: already patched`);

  const found = findFunctionBlock(r.content, 'function renderCards()');
  if (!found) return warn(`renderCards: function not found`);

  const newBody = `// ${TAG}:renderCards
        function renderCards() {
            const grid=$('cardsGrid'); if(!grid) return; grid.replaceChildren();
            if(!bankState.cards.length){
                const p=document.createElement('p');
                p.className='empty-state';
                p.textContent=t('no_cards','Kartlar elýeterli däl');
                grid.appendChild(p);
                return;
            }
            bankState.cards.forEach(c=>{
                const card=document.createElement('div');
                card.className='card-item' + (c.frozen ? ' frozen' : '');
                card.dataset.cardId = String(c.id || c._id || '');

                const type=document.createElement('div');
                type.className='card-type';
                type.textContent=t(\`card_type_\${c.type}\`, (c.type||'Card').toUpperCase());

                const num=document.createElement('div');
                num.className='card-number';
                num.textContent=c.maskedNumber||'•••• •••• •••• ••••';

                const exp=document.createElement('div');
                exp.className='card-expiry';
                exp.textContent='Exp ' + (c.expiry||'—');

                const logo=document.createElement('div');
                logo.className='card-logo';
                logo.textContent='💳';

                const badge=document.createElement('div');
                badge.className='card-frozen-badge';
                badge.textContent='❄️ Заморожена';

                const btn=document.createElement('button');
                btn.type='button';
                btn.className='card-freeze-btn';
                btn.dataset.action='toggle-freeze';
                btn.dataset.cardId=String(c.id || c._id || '');
                btn.dataset.frozen=String(!!c.frozen);
                btn.textContent = c.frozen ? '🔥 Разморозить' : '❄️ Заморозить';

                card.append(type, num, exp, logo, badge, btn);
                grid.appendChild(card);
            });

            grid.querySelectorAll('button[data-action="toggle-freeze"]').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleCardFreeze(b.dataset.cardId, b.dataset.frozen === 'true');
                });
            });
        }`;

  const next = r.content.slice(0, found.start) + newBody + r.content.slice(found.end);
  writePatched(F.html, next, r.content);
}

// ---------------------- 5. JS: модалка + create + freeze + bind ----------------------
function patchJs() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:js`)) return log(`-- js: already patched`);

  const anchor = `        // SFERA-PATCH:SPRINT3.3:js — renderReceive + actions`;
  if (!r.content.includes(anchor)) return warn(`js: SPRINT3.3 anchor not found`);

  const block = `        // ${TAG}:js — card modal + create + freeze
        function openNewCardModal() {
            const modal = document.getElementById('newCardModal');
            if (!modal) return;
            modal.style.display = 'flex';
            const type = document.getElementById('newCardType');
            const limit = document.getElementById('newCardLimit');
            if (type) type.value = 'debit';
            if (limit) limit.value = '5000';
        }
        function closeNewCardModal() {
            const modal = document.getElementById('newCardModal');
            if (modal) modal.style.display = 'none';
        }
        async function submitNewCard(e) {
            if (e) e.preventDefault();
            const type = document.getElementById('newCardType')?.value || 'debit';
            const limit = Number(document.getElementById('newCardLimit')?.value || 5000);
            const btn = document.getElementById('newCardSubmit');
            if (btn) { btn.disabled = true; btn.textContent = '...'; }
            try {
                const res = await fetch('/api/bank/cards', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
                    body: JSON.stringify({ type, limit })
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) {
                    showMessage('Ошибка: ' + (body.message || ('HTTP ' + res.status)), 'error');
                    return;
                }
                if (Array.isArray(bankState.cards)) bankState.cards.unshift(body.data);
                else bankState.cards = [body.data];
                renderCards();
                closeNewCardModal();
                showMessage('Карта создана: ' + body.data.maskedNumber, 'success');
            } catch (err) {
                showMessage('Сеть: ' + err.message, 'error');
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = 'Создать'; }
            }
        }
        async function toggleCardFreeze(cardId, currentFrozen) {
            if (!cardId) return;
            try {
                const res = await fetch('/api/bank/cards/' + cardId, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
                    body: JSON.stringify({ frozen: !currentFrozen })
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) {
                    showMessage('Ошибка: ' + (body.message || ('HTTP ' + res.status)), 'error');
                    return;
                }
                const card = (bankState.cards || []).find(c => String(c.id || c._id) === String(cardId));
                if (card) card.frozen = body.data.frozen;
                renderCards();
                showMessage(body.data.frozen ? 'Карта заморожена' : 'Карта разморожена', 'success');
            } catch (err) {
                showMessage('Сеть: ' + err.message, 'error');
            }
        }
        function bindNewCardButton() {
            const btn = document.getElementById('newCardBtn');
            if (!btn || btn.dataset.bound === '1') return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', openNewCardModal);

            const cancel = document.getElementById('newCardCancel');
            if (cancel) cancel.addEventListener('click', closeNewCardModal);
            const form = document.getElementById('newCardForm');
            if (form) form.addEventListener('submit', submitNewCard);
            const modal = document.getElementById('newCardModal');
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) closeNewCardModal();
                });
            }
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 6. activateTab: bindNewCardButton ----------------------
function patchActivateTab() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:activateTab`)) return log(`-- activateTab: already patched`);

  const anchor = `            if (tab === 'receive' && typeof renderReceive === 'function') {
                renderReceive();
                bindReceiveActions();
            }`;
  if (!r.content.includes(anchor)) return warn(`activateTab: receive block not found`);

  const replacement = `${anchor}
            if (tab === 'cards' && typeof bindNewCardButton === 'function') {
                bindNewCardButton();
                renderCards();
            }`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.4b (Cards frontend) - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- HTML кнопка + Täze kart --'); patchHtmlButton();
  log('\n-- HTML модалка создания --'); patchHtmlModal();
  log('\n-- CSS (карточка + modal) --'); patchCss();
  log('\n-- renderCards (badge + freeze btn) --'); patchRenderCards();
  log('\n-- JS (modal + create + freeze) --'); patchJs();
  log('\n-- activateTab (bindNewCardButton) --'); patchActivateTab();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3h.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }