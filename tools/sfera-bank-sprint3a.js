#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.1a — Socket.IO backend
 * - bankService.transfer принимает io и эмитит balance_updated (out+in) + bank_notification
 * - bankRoutes передаёт io из req.app.get('io')
 * - sockets/index.js НЕ трогаем
 * - Idempotent path (existing) НЕ эмитит (деньги не двигаются)
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TAG = 'SFERA-PATCH:SPRINT3.1a';
const ROOT = path.resolve(__dirname, '..');
const DRY = !process.argv.includes('--apply');

const F = {
  service: 'server/src/services/bankService.js',
  routes:  'server/src/routes/bankRoutes.js',
};

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
function checkJs(p) {
  const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
  return r.status === 0 ? { ok: true } : { ok: false, out: r.stderr || r.stdout };
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
  const chk = checkJs(p);
  if (!chk.ok) { bad(`post-check fail -> revert: ${chk.out}`); fs.copyFileSync(bak, p); return false; }
  ok(`post-check ok: ${rel}`);
  return true;
}

// ---------------------- 1. bankService: io param + emit ----------------------
function patchService() {
  const r = read(F.service); if (!r) return warn(`${F.service}: not found`);
  if (r.content.includes(`${TAG}:service`)) return log(`-- service: already patched`);

  let c = r.content;

  // 1a. signature: add io to destructuring
  const sigAnchor = `async function transfer(userId, { fromAccountId, toAccount, amount, description, idempotencyKey }) {`;
  if (!c.includes(sigAnchor)) return warn(`service: signature anchor not found`);
  c = c.replace(
    sigAnchor,
    `// ${TAG}:service\nasync function transfer(userId, { fromAccountId, toAccount, amount, description, idempotencyKey, io }) {`
  );

  // 1b. emit after commitTransaction — перед notification block
  const notifAnchor = `    // SFERA-PATCH:SPRINT2.2a:notify — sender out + recipient in (best-effort, after commit)`;
  if (!c.includes(notifAnchor)) return warn(`service: notify anchor not found`);

  const emitBlock = `    // ${TAG}:emit — realtime balance_updated (только при реальном переводе)
    if (io) {
      try {
        const txId = String(tx._id);
        io.to(String(userId)).emit('balance_updated', {
          newBalance: sender.balance,
          transactionId: txId,
          direction: 'out',
          amount,
          counterparty: recipient.number || ''
        });
        if (recipient.userId) {
          io.to(String(recipient.userId)).emit('balance_updated', {
            newBalance: recipient.balance,
            transactionId: txId,
            direction: 'in',
            amount,
            counterparty: sender.number || ''
          });
        }
      } catch (e) {
        console.warn('[${TAG}] io emit failed:', e.message);
      }
    }

${notifAnchor}`;
  c = c.replace(notifAnchor, emitBlock);

  // 1c. bank_notification для recipient — после Notification.insertMany
  const insertAnchor = `      await Notification.insertMany(notes);
    } catch (e) {`;
  if (!c.includes(insertAnchor)) return warn(`service: insertMany anchor not found`);

  const notifEmit = `      await Notification.insertMany(notes);

      // ${TAG}:notify-emit — realtime notification для получателя
      if (io && recipient.userId) {
        try {
          io.to(String(recipient.userId)).emit('bank_notification', {
            type: 'transfer_in',
            message: 'Поступление ' + amount + ' ' + recipient.currency,
            transactionId: String(tx._id)
          });
        } catch (e) {
          console.warn('[${TAG}] notification emit failed:', e.message);
        }
      }
    } catch (e) {`;
  c = c.replace(insertAnchor, notifEmit);

  writePatched(F.service, c, r.content);
}

// ---------------------- 2. bankRoutes: pass io ----------------------
function patchRoutes() {
  const r = read(F.routes); if (!r) return warn(`${F.routes}: not found`);
  if (r.content.includes(`${TAG}:routes`)) return log(`-- routes: already patched`);

  let c = r.content;

  const anchor = `    const result = await transfer(req.userId, {
      fromAccountId: req.body.fromAccountId,
      toAccount: req.body.toAccount,
      amount: req.body.amount,
      description: req.body.description,
      idempotencyKey: req.headers['idempotency-key'] || req.body.idempotencyKey
    });`;
  if (!c.includes(anchor)) return warn(`routes: transfer call anchor not found`);

  const replacement = `    // ${TAG}:routes — io из app для realtime
    const io = req.app.get('io');
    const result = await transfer(req.userId, {
      fromAccountId: req.body.fromAccountId,
      toAccount: req.body.toAccount,
      amount: req.body.amount,
      description: req.body.description,
      idempotencyKey: req.headers['idempotency-key'] || req.body.idempotencyKey,
      io
    });`;
  c = c.replace(anchor, replacement);

  writePatched(F.routes, c, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.1a (backend) - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'server', 'src'))) {
    bad('server/src not found - run from repo root'); process.exit(1);
  }
  log('-- bankService: io param + emit balance_updated/notification --'); patchService();
  log('\n-- bankRoutes: pass io --'); patchRoutes();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3a.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }