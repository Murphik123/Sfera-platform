#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 2.2b-1
 * 1) Badge "Bildirişler (N)" на tab_notifications
 * 2) Копирование IBAN кликом по #mainAccount
 * 3) Empty-state CTA «Открыть счёт» в accounts
 *
 * v2: CRLF-safe (нормализация при чтении, восстановление при записи).
 * Запуск из корня репо: node tools/sfera-bank-sprint2b1.js [--apply]
 */
const fs = require('fs');
const path = require('path');

const TAG = 'SFERA-PATCH:SPRINT2.2b1';
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
  if (!chk.ok) { bad(`post-check fail -> revert ${rel}: ${chk.reason}`); fs.copyFileSync(bak, p); return false; }
  ok(`post-check ok: ${rel}`);
  return true;
}

// ---------------------- 1. Badge ----------------------
function patchBadge() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:badge`)) return log(`-- badge: already patched`);

  const anchor = `        function renderNotifications() {
            const list=$('notificationsList'); if(!list) return; list.replaceChildren();
            if(!bankState.notifications.length){ $('emptyNotif').style.display='block'; return; }
            $('emptyNotif').style.display='none';
            bankState.notifications.forEach(n=>{
                const item=document.createElement('div'); item.className='notification-item'; item.textContent=n.message||''; list.appendChild(item);
            });
        }`;

  if (!r.content.includes(anchor)) return warn(`badge: renderNotifications anchor not found`);

  const replacement = `        // ${TAG}:badge
        function renderNotifications() {
            const list=$('notificationsList'); if(!list) return; list.replaceChildren();
            if(!bankState.notifications.length){ $('emptyNotif').style.display='block'; }
            else { $('emptyNotif').style.display='none'; }
            bankState.notifications.forEach(n=>{
                const item=document.createElement('div');
                item.className='notification-item' + (n.read ? '' : ' unread');
                item.textContent=n.message||'';
                list.appendChild(item);
            });

            const tabBtn = document.querySelector('.bank-tabs button[data-tab="notifications"]');
            if (tabBtn) {
                const existing = tabBtn.querySelector('.notification-badge');
                if (existing) existing.remove();
                const unread = bankState.notifications.filter(n => !n.read).length;
                if (unread > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'notification-badge';
                    badge.textContent = String(unread);
                    tabBtn.appendChild(badge);
                }
            }
        }`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

// ---------------------- 2. Copy IBAN ----------------------
function patchCopyIban() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:copy-iban`)) return log(`-- copy-iban: already patched`);

  const anchor = `        $('refreshBtn')?.addEventListener('click',loadBankData);`;
  if (!r.content.includes(anchor)) return warn(`copy-iban: refreshBtn anchor not found`);

  const block = `        // ${TAG}:copy-iban
        (function () {
            const el = document.getElementById('mainAccount');
            if (!el) return;
            el.style.cursor = 'pointer';
            el.title = 'Клик — скопировать IBAN';
            el.addEventListener('click', async () => {
                const iban = (el.textContent || '').trim();
                if (!iban) return;
                try {
                    await navigator.clipboard.writeText(iban);
                    showMessage('IBAN скопирован: ' + iban, 'success');
                } catch (e) {
                    showMessage('Не удалось скопировать (браузер запретил)', 'error');
                }
            });
        })();

${anchor}`;

  const next = r.content.replace(anchor, block);
  writePatched(F.html, next, r.content);
}

// ---------------------- 3. Empty-state CTA ----------------------
function patchEmptyCta() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:empty-cta`)) return log(`-- empty-cta: already patched`);

  const anchor = `            if(!bankState.accounts.length) {
                const p=document.createElement('p'); p.className='empty-state'; p.textContent=t('no_accounts','Hasaplar elýeterli däl'); grid.appendChild(p); return;
            }`;

  if (!r.content.includes(anchor)) return warn(`empty-cta: renderAccounts empty anchor not found`);

  const replacement = `            if(!bankState.accounts.length) {
                // ${TAG}:empty-cta
                const wrap = document.createElement('div');
                wrap.className = 'empty-state';
                const icon = document.createElement('div');
                icon.className = 'icon';
                icon.textContent = '🏦';
                const msg = document.createElement('p');
                msg.textContent = t('no_accounts','Hasaplar elýeterli däl');
                const cta = document.createElement('button');
                cta.type = 'button';
                cta.className = 'btn btn-primary';
                cta.style.marginTop = '12px';
                cta.textContent = t('open_account_cta','Открыть счёт');
                cta.addEventListener('click', () => {
                    const role = localStorage.getItem('sfera_role') || 'user';
                    if (role === 'admin' || role === 'system_admin') {
                        location.href = 'admin.html';
                    } else {
                        showMessage(t('contact_support','Обратитесь в поддержку для открытия счёта'), 'error');
                    }
                });
                wrap.append(icon, msg, cta);
                grid.appendChild(wrap);
                return;
            }`;

  const next = r.content.replace(anchor, replacement);
  writePatched(F.html, next, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 2.2b-1 - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'public', 'bank.html'))) {
    bad('public/bank.html not found - run from repo root'); process.exit(1);
  }
  log('-- Badge (Bildirişler N) --'); patchBadge();
  log('\n-- Copy IBAN (#mainAccount click) --'); patchCopyIban();
  log('\n-- Empty-state CTA (accounts) --'); patchEmptyCta();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint2b1.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }