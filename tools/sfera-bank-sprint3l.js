#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.4f — modern toast (Revolut/Monobank style)
 * - showToast(text, type) — правый нижний угол, иконка, slide-in, auto-dismiss
 * - Заменяет showMessage для карточных операций (create/freeze/unfreeze)
 * - showMessage остаётся для банковских ошибок/критичных (не трогаем)
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT3.4f';
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

// ---------------------- 1. CSS: modern toast ----------------------
function patchCss() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:css`)) return log(`-- css: already patched`);

  const anchor = `        /* SFERA-PATCH:SPRINT3.4de:css — cards 360×227 + premium balance */`;
  if (!r.content.includes(anchor)) return warn(`css: SPRINT3.4de anchor not found`);

  const block = `        /* ${TAG}:css — modern toast (bottom-right, Revolut-style) */
        .sfera-toast-container {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 380px;
            width: calc(100vw - 48px);
            pointer-events: none;
        }
        .sfera-toast {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 18px;
            background: rgba(8, 19, 29, 0.96);
            border: 1px solid rgba(0, 212, 255, 0.28);
            border-left: 3px solid #00d4ff;
            border-radius: 14px;
            box-shadow: 0 10px 40px rgba(0,0,0,.55), 0 0 30px rgba(0,212,255,.12);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            color: #dbe9ff;
            font-size: 14px;
            font-weight: 500;
            pointer-events: auto;
            animation: sferaToastIn .35s cubic-bezier(.16,1,.3,1);
            transition: opacity .3s ease, transform .35s ease;
        }
        .sfera-toast.success {
            border-left-color: #00ffa3;
            border-color: rgba(0,255,163,.28);
        }
        .sfera-toast.error {
            border-left-color: #ff6b6b;
            border-color: rgba(255,107,107,.28);
        }
        .sfera-toast.info {
            border-left-color: #00d4ff;
        }
        .sfera-toast-icon {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 800;
            flex-shrink: 0;
            background: rgba(0,212,255,.18);
            color: #00d4ff;
        }
        .sfera-toast.success .sfera-toast-icon {
            background: rgba(0,255,163,.18);
            color: #00ffa3;
        }
        .sfera-toast.error .sfera-toast-icon {
            background: rgba(255,107,107,.18);
            color: #ff6b6b;
        }
        .sfera-toast-body {
            flex: 1;
            line-height: 1.4;
        }
        @keyframes sferaToastIn {
            from { transform: translateX(120%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
        }
        .sfera-toast.hiding {
            opacity: 0;
            transform: translateX(120%);
        }
        @media (max-width: 640px) {
            .sfera-toast-container {
                bottom: 16px;
                right: 16px;
                left: 16px;
                width: auto;
            }
        }

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 2. JS: showToast ----------------------
function patchJs() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:js`)) return log(`-- js: already patched`);

  const anchor = `        // ${TAG}:js — quick actions`;
  // fallback на SPRINT3.4de:js если вдруг маркер другой
  const anchorActual = r.content.includes(anchor) ? anchor : `        // SFERA-PATCH:SPRINT3.4de:js — quick actions`;
  if (!r.content.includes(anchorActual)) return warn(`js: quick actions anchor not found`);

  const block = `        // ${TAG}:js — modern toast (Revolut-style)
        window.showToast = function(text, type) {
            type = type || 'success';
            let container = document.getElementById('sferaToastContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'sferaToastContainer';
                container.className = 'sfera-toast-container';
                document.body.appendChild(container);
            }
            const toast = document.createElement('div');
            toast.className = 'sfera-toast ' + type;
            const icon = document.createElement('div');
            icon.className = 'sfera-toast-icon';
            icon.textContent = (type === 'error') ? '✕' : (type === 'info' ? 'i' : '✓');
            const body = document.createElement('div');
            body.className = 'sfera-toast-body';
            body.textContent = text;
            toast.appendChild(icon);
            toast.appendChild(body);
            container.appendChild(toast);
            setTimeout(function() {
                toast.classList.add('hiding');
                setTimeout(function() { toast.remove(); }, 350);
            }, 2800);
        };

${anchorActual}`;

  const next = r.content.replace(anchorActual, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 3. Заменить showMessage → showToast в карточных операциях ----------------------
function patchCardToasts() {
  const r = read(F.html); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:replace`)) return log(`-- replace: already patched`);

  let c = r.content;
  let count = 0;

  // submitNewCard
  const pairs = [
    [`showMessage('Карта создана: ' + body.data.maskedNumber, 'success');`,
     `(window.showToast || showMessage)('Карта создана: ' + body.data.maskedNumber, 'success');`],
    [`showMessage('Ошибка: ' + (body.message || ('HTTP ' + res.status)), 'error');`,
     `(window.showToast || showMessage)('Ошибка: ' + (body.message || ('HTTP ' + res.status)), 'error');`],
    [`showMessage('Сеть: ' + err.message, 'error');`,
     `(window.showToast || showMessage)('Сеть: ' + err.message, 'error');`],
    [`showMessage(body.data.frozen ? 'Карта заморожена' : 'Карта разморожена', 'success');`,
     `(window.showToast || showMessage)(body.data.frozen ? 'Карта заморожена' : 'Карта разморожена', 'success');`]
  ];

  for (const [from, to] of pairs) {
    if (c.includes(from)) { c = c.split(from).join(to); count++; }
  }

  if (count === 0) return warn(`replace: ни одна строка не найдена`);
  c = `// ${TAG}:replace — заменил ${count} showMessage на showToast в картах\n` + c;
  writePatched(F.html, c, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.4f (modern toast) - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- CSS modern toast --'); patchCss();
  log('\n-- JS showToast --'); patchJs();
  log('\n-- Replace showMessage → showToast (cards) --'); patchCardToasts();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3l.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }