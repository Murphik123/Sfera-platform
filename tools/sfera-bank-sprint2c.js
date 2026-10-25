#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 2.2a
 * Создание Notification при успешном переводе (sender out + recipient in).
 * Идемпотентный путь (existing) — notification НЕ создаётся.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TAG = 'SFERA-PATCH:SPRINT2.2a';
const ROOT = path.resolve(__dirname, '..');
const DRY = !process.argv.includes('--apply');

const F = { service: 'server/src/services/bankService.js' };
const log = (...a) => console.log(...a);
const ok = (...a) => console.log('OK', ...a);
const warn = (...a) => console.warn('WARN', ...a);
const bad = (...a) => console.error('ERR', ...a);

function read(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? { path: p, content: fs.readFileSync(p, 'utf8') } : null;
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
  fs.writeFileSync(p, content, 'utf8');
  ok(`${rel}  <-  ${path.basename(bak)}`);
  const chk = checkJs(p);
  if (!chk.ok) { bad(`post-check fail -> revert ${rel}: ${chk.out}`); fs.copyFileSync(bak, p); return false; }
  ok(`post-check ok: ${rel}`);
  return true;
}

function patchService() {
  const r = read(F.service); if (!r) return warn(`${F.service}: not found`);
  if (r.content.includes(`${TAG}:notify`)) return log(`-- ${F.service}: already patched`);

  let c = r.content;

  if (!c.includes(`require('../models/Notification')`)) {
    const anchor = `const Transaction = require('../models/Transaction');`;
    if (!c.includes(anchor)) return warn(`${F.service}: Transaction require not found`);
    c = c.replace(anchor, anchor + `\nconst Notification = require('../models/Notification');`);
  }

  const anchor2 = `    await session.commitTransaction();
    return { transactionId: tx._id, balance: sender.balance };`;
  if (!c.includes(anchor2)) return warn(`${F.service}: commit block not found`);

  const block = `    await session.commitTransaction();

    // ${TAG}:notify — sender out + recipient in (best-effort, after commit)
    try {
      const notes = [
        {
          userId,
          type: 'transfer_out',
          message: 'Перевод ' + amount + ' ' + sender.currency + ' на ' + recipient.number,
          meta: { transactionId: tx._id, amount, direction: 'out', counterparty: recipient.number }
        }
      ];
      if (recipient.userId) {
        notes.push({
          userId: recipient.userId,
          type: 'transfer_in',
          message: 'Поступление ' + amount + ' ' + recipient.currency + ' от ' + (sender.number || 'счёта'),
          meta: { transactionId: tx._id, amount, direction: 'in', counterparty: sender.number || '' }
        });
      }
      await Notification.insertMany(notes);
    } catch (e) {
      console.warn('[${TAG}] Notification insert failed:', e.message);
    }

    return { transactionId: tx._id, balance: sender.balance };`;

  c = c.replace(anchor2, block);
  writePatched(F.service, c, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 2.2a - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'server', 'src'))) {
    bad('server/src not found - run from repo root'); process.exit(1);
  }
  log('-- bankService: notify on transfer --');
  patchService();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint2c.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }