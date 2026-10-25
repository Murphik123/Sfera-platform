#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 1 · patcher v3.1
 * v3.1: patchAccount якорь — currency-блок (многострочный Account.js)
 * Запуск из корня репо:  node tools/sfera-bank-sprint1.js [--apply]
 * Без --apply — dry-run.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TAG  = 'SFERA-PATCH:SPRINT1';
const ROOT = path.resolve(__dirname, '..');
const DRY  = !process.argv.includes('--apply');

const F = {
  routes:     'server/src/routes/bankRoutes.js',
  controller: 'server/src/controllers/bankController.js',
  account:    'server/src/models/Account.js',
  transaction:'server/src/models/Transaction.js',
  html:       'public/bank.html',
  service:    'server/src/services/bankService.js',
  validate:   'server/src/middleware/validateBankTransfer.js',
  iban:       'server/src/utils/iban.js',
  ibanGen:    'server/src/utils/ibanGenerator.js',
  mapErr:     'server/src/utils/mapTransferError.js',
};

const log  = (...a) => console.log(...a);
const ok   = (...a) => console.log('OK', ...a);
const warn = (...a) => console.warn('WARN', ...a);
const bad  = (...a) => console.error('ERR', ...a);

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
function checkHtml(p, before) {
  const after = fs.readFileSync(p, 'utf8');
  if (!after.includes('</html>')) return { ok: false, reason: 'no </html>' };
  const o = (after.match(/<script\b/g) || []).length;
  const c = (after.match(/<\/script>/g) || []).length;
  if (o !== c) return { ok: false, reason: `script ${o}/${c}` };
  const ratio = after.length / Math.max(before.length, 1);
  if (ratio < 0.7 || ratio > 1.5) return { ok: false, reason: `size ratio ${ratio.toFixed(2)}` };
  return { ok: true };
}
function replaceBlock(content, start, end, replacement) {
  const i = content.indexOf(start);
  if (i === -1) return null;
  const j = content.indexOf(end, i + start.length);
  if (j === -1) return null;
  return content.slice(0, i) + replacement + content.slice(j);
}
function writePatched(rel, content, before, kind) {
  const p = path.join(ROOT, rel);
  if (content === before) { log(`-- ${rel}: no change`); return true; }
  if (DRY) { log(`-- ${rel}: will change`); return true; }
  const bak = backup(p);
  fs.writeFileSync(p, content, 'utf8');
  ok(`${rel}  <-  ${path.basename(bak)}`);
  const chk = kind === 'html' ? checkHtml(p, before) : checkJs(p);
  if (!chk.ok) { bad(`post-check fail (${chk.reason || chk.out}) -> revert ${rel}`); fs.copyFileSync(bak, p); return false; }
  ok(`post-check ok: ${rel}`);
  return true;
}
function ensureFile(rel, content, marker) {
  const p = path.join(ROOT, rel);
  if (fs.existsSync(p)) {
    const cur = fs.readFileSync(p, 'utf8');
    if (cur.includes(marker)) return log(`-- ${rel}: already exists`);
    warn(`${rel}: exists without marker - NOT touching`);
    return;
  }
  if (DRY) return log(`-- will create: ${rel}`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  ok(`created ${rel}`);
}

function patchAccount() {
  const r = read(F.account); if (!r) return warn(`${F.account}: not found`);
  if (r.content.includes(`${TAG}:account-number`)) return log(`-- ${F.account}: already patched`);
  const re = /(currency:\s*\{[^}]*\})/;
  if (!re.test(r.content)) return warn(`${F.account}: currency anchor not found`);
  const next = r.content.replace(
    re,
    `$1,\n  // ${TAG}:account-number\n  number: { type: String, unique: true, sparse: true }`
  );
  writePatched(F.account, next, r.content, 'js');
}

function patchTransaction() {
  const r = read(F.transaction); if (!r) return warn(`${F.transaction}: not found`);
  if (r.content.includes(`${TAG}:tx-fields`)) return log(`-- ${F.transaction}: already patched`);
  const anchor = `relatedListing:`;
  const i = r.content.indexOf(anchor);
  if (i === -1) return warn(`${F.transaction}: anchor not found`);
  const lineEnd = r.content.indexOf('\n', i);
  const next = r.content.slice(0, lineEnd + 1)
    + `  // ${TAG}:tx-fields\n`
    + `  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },\n`
    + `  fromAccountId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },\n`
    + `  toAccountId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },\n`
    + `  toAccount:      { type: String, default: '' },\n`
    + `  idempotencyKey: { type: String, index: true, sparse: true },\n`
    + r.content.slice(lineEnd + 1);
  writePatched(F.transaction, next, r.content, 'js');
}

const NEW = [
  [F.ibanGen, `${TAG}:ibanGen`, `// ${TAG}:ibanGen
const crypto = require('crypto');
function generateIban(prefix = 'TM') {
  const bban = Array.from({ length: 20 }, () => crypto.randomInt(0, 10)).join('');
  const rearranged = bban + prefix + '00';
  const numeric = rearranged.replace(/[A-Z]/g, ch => (ch.charCodeAt(0) - 55).toString());
  const rem = BigInt(numeric) % 97n;
  const check = (98n - rem).toString().padStart(2, '0');
  return prefix + check + bban;
}
module.exports = { generateIban };
`],
  [F.mapErr, `${TAG}:mapErr`, `// ${TAG}:mapErr
module.exports.mapTransferError = (err) => {
  const code = (err && err.code) || 'INTERNAL';
  const statusMap = {
    ACCOUNT_NOT_FOUND: 403, INSUFFICIENT_FUNDS: 409, RECIPIENT_NOT_FOUND: 404,
    SAME_ACCOUNT: 400, CURRENCY_MISMATCH: 400
  };
  const mapped = new Error((err && err.message) || code);
  mapped.status = statusMap[code] || 500;
  mapped.code = code;
  return mapped;
};
`],
  [F.iban, `${TAG}:iban`, `// ${TAG}:iban
function validateIban(iban) {
  if (!iban || typeof iban !== 'string') return false;
  const clean = iban.replace(/\\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(clean)) return false;
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, ch => (ch.charCodeAt(0) - 55).toString());
  try { return BigInt(numeric) % 97n === 1n; } catch (e) { return false; }
}
module.exports = { validateIban };
`],
  [F.validate, `${TAG}:validate`, `// ${TAG}:validate
const { validateIban } = require('../utils/iban');
module.exports = function validateBankTransfer(req, res, next) {
  const { fromAccountId, toAccount, amount } = req.body || {};
  if (!fromAccountId) return res.status(400).json({ success: false, code: 'FROM_REQUIRED', message: 'fromAccountId is required' });
  if (!toAccount || !validateIban(toAccount)) return res.status(400).json({ success: false, code: 'INVALID_IBAN', message: 'Invalid IBAN' });
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ success: false, code: 'INVALID_AMOUNT', message: 'Amount must be positive' });
  if (n > 1_000_000) return res.status(400).json({ success: false, code: 'LIMIT_EXCEEDED', message: 'Amount exceeds daily limit' });
  req.body.amount = Math.round(n * 100) / 100;
  next();
};
`],
  [F.service, `${TAG}:service`, `// ${TAG}:service
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

async function transfer(userId, { fromAccountId, toAccount, amount, description, idempotencyKey }) {
  if (idempotencyKey) {
    const existing = await Transaction.findOne({ userId, idempotencyKey }).lean();
    if (existing) {
      const acc = await Account.findOne({ userId }).lean();
      return { transactionId: existing._id, balance: acc ? acc.balance : 0, idempotent: true };
    }
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sender = await Account.findOne({ _id: fromAccountId, userId }).session(session);
    if (!sender) throw Object.assign(new Error('Sender account not found'), { code: 'ACCOUNT_NOT_FOUND' });
    if (sender.balance < amount) throw Object.assign(new Error('Insufficient funds'), { code: 'INSUFFICIENT_FUNDS' });
    const recipient = await Account.findOne({ number: String(toAccount).replace(/\\s+/g, '') }).session(session);
    if (!recipient) throw Object.assign(new Error('Recipient account not found'), { code: 'RECIPIENT_NOT_FOUND' });
    if (String(recipient._id) === String(sender._id)) throw Object.assign(new Error('Same account'), { code: 'SAME_ACCOUNT' });
    if (recipient.currency !== sender.currency) throw Object.assign(new Error('Currency mismatch'), { code: 'CURRENCY_MISMATCH' });
    sender.balance = Math.round((sender.balance - amount) * 100) / 100;
    recipient.balance = Math.round((recipient.balance + amount) * 100) / 100;
    await sender.save({ session });
    await recipient.save({ session });
    const [tx] = await Transaction.create([{
      userId,
      sender: userId,
      recipient: recipient.userId || null,
      fromAccountId: sender._id,
      toAccountId:   recipient._id,
      toAccount:     recipient.number,
      type: 'transfer',
      amount,
      currency: sender.currency,
      description: description || 'Transfer',
      status: 'completed',
      idempotencyKey: idempotencyKey || undefined
    }], { session });
    await session.commitTransaction();
    return { transactionId: tx._id, balance: sender.balance };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally { session.endSession(); }
}
module.exports = { transfer };
`]
];

function patchRoutes() {
  const r = read(F.routes); if (!r) return warn(`${F.routes}: not found`);
  if (r.content.includes(`${TAG}:routes`)) return log(`-- ${F.routes}: already patched`);
  const start = `const { getBalance, transfer, getTransactions }`;
  const end   = `module.exports = router;`;
  const block = `// ${TAG}:routes
const { getBalance, getTransactions } = require('../controllers/bankController');
const { transfer } = require('../services/bankService');
const validateBankTransfer = require('../middleware/validateBankTransfer');
const { mapTransferError } = require('../utils/mapTransferError');

router.use(authMiddleware);

router.get('/balance', getBalance);
router.post('/transfer', validateBankTransfer, async (req, res, next) => {
  try {
    const result = await transfer(req.userId, {
      fromAccountId: req.body.fromAccountId,
      toAccount: req.body.toAccount,
      amount: req.body.amount,
      description: req.body.description,
      idempotencyKey: req.headers['idempotency-key'] || req.body.idempotencyKey
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) { return next(mapTransferError(err)); }
});
router.get('/transactions', getTransactions);

`;
  const next = replaceBlock(r.content, start, end, block);
  if (next == null) return warn(`${F.routes}: markers not found`);
  writePatched(F.routes, next, r.content, 'js');
}

function patchController() {
  const r = read(F.controller); if (!r) return warn(`${F.controller}: not found`);
  if (r.content.includes(`${TAG}:overview`)) return log(`-- ${F.controller}: already patched`);

  const reqAnchor = `const Transaction = require('../models/Transaction');`;
  let c = r.content;
  if (!c.includes(`require('../utils/ibanGenerator')`)) {
    c = c.replace(reqAnchor, `${reqAnchor}\nconst { generateIban } = require('../utils/ibanGenerator');`);
  }

  const start = `exports.getBalance = async (req, res, next) => {`;
  const nextM = `exports.transfer = async (req, res, next) => {`;
  const block = `// ${TAG}:overview
exports.getBalance = async (req, res, next) => {
  try {
    let accounts = await Account.find({ userId: req.userId }).lean();
    if (!accounts.length) {
      const created = await Account.create({ userId: req.userId, balance: 0, currency: 'TMT', number: generateIban() });
      accounts = [created.toObject()];
    } else {
      for (const acc of accounts) {
        if (!acc.number) {
          const newNum = generateIban();
          await Account.updateOne({ _id: acc._id }, { $set: { number: newNum } });
          acc.number = newNum;
        }
      }
    }
    const ids = accounts.map(a => a._id);
    const transactions = await Transaction.find({
      $or: [
        { fromAccountId: { $in: ids } },
        { toAccountId:   { $in: ids } },
        { sender: req.userId },
        { recipient: req.userId }
      ]
    }).sort({ createdAt: -1 }).limit(20).lean();

    return res.status(200).json({
      success: true,
      data: {
        accounts: accounts.map(a => ({
          id: String(a._id), number: a.number || '', name: a.name || a.type || 'Account',
          type: a.type || 'main', balance: a.balance, currency: a.currency || 'TMT'
        })),
        cards: [], transactions, notifications: [],
        balance: accounts.reduce((s, a) => s + ((a.currency || 'TMT') === 'TMT' ? Number(a.balance || 0) : 0), 0),
        currency: 'TMT'
      }
    });
  } catch (error) { next(error); }
};

`;
  const patched = replaceBlock(c, start, nextM, block);
  if (patched == null) return warn(`${F.controller}: getBalance markers not found`);
  writePatched(F.controller, patched, r.content, 'js');
}

function patchHtml() {
  const r = read(F.html); if (!r) return warn(`${F.html}: not found`);
  if (r.content.includes(`${TAG}:html-load`)) return log(`-- ${F.html}: already patched`);

  let c = r.content;
  const loadStart = `async function loadBankData(){`;
  const loadEnd   = `        $('refreshBtn')?.addEventListener('click',loadBankData);`;
  const loadBlock = `        // ${TAG}:html-load
        let _bankLoading = false;
        async function loadBankData(){
            if (_bankLoading) return;
            _bankLoading = true;
            try {
                if(!window.api || typeof window.api.request!=='function') {
                    showMessage(t('bank_api_unavailable','Bank API unavailable'),'error'); return;
                }
                const response = await window.api.request('/bank/balance');
                const data = response?.data ?? response ?? {};
                bankState.accounts      = Array.isArray(data.accounts)      ? data.accounts      : [];
                bankState.cards         = Array.isArray(data.cards)         ? data.cards         : [];
                bankState.transactions  = Array.isArray(data.transactions)  ? data.transactions  : [];
                bankState.notifications = Array.isArray(data.notifications) ? data.notifications : [];
                renderAccounts(); renderCards(); renderHistory(); renderNotifications();
                populateFromAccounts(); updateTotalBalance();
            } catch(err) {
                if (err && err.status === 401) { location.href = 'login.html'; return; }
                showMessage(err.message || t('bank_load_error','Load failed'),'error');
            } finally { _bankLoading = false; }
        }

`;
  const c1 = replaceBlock(c, loadStart, loadEnd, loadBlock);
  if (c1 == null) return warn(`${F.html}: loadBankData markers not found`);
  c = c1;

  const subStart = `$('transferForm')?.addEventListener('submit',(e)=>{`;
  const subEnd   = `$('logoutBtn')?.addEventListener('click'`;
  const subBlock = `        // ${TAG}:html-submit
        function isValidIban(raw){
            if (!raw) return false;
            const s = String(raw).replace(/\\s+/g,'').toUpperCase();
            if (!/^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
            const rearr = s.slice(4) + s.slice(0,4);
            const num = rearr.replace(/[A-Z]/g, ch => (ch.charCodeAt(0)-55).toString());
            try { return BigInt(num) % 97n === 1n; } catch(e) { return false; }
        }
        function confirmTransfer(info){
            return new Promise(resolve => {
                const m = document.createElement('div');
                m.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(3,8,14,.75);z-index:9999;';
                m.innerHTML = '<div style="background:#08131d;border:1px solid rgba(0,212,255,.4);border-radius:18px;padding:28px;max-width:400px;width:90%;color:#fff;">'
                  + '<div style="font-weight:700;margin-bottom:14px;">' + t('confirm_transfer','Confirm') + '</div>'
                  + '<div style="color:#bdd0df;margin-bottom:8px;">' + t('to_account','To') + ': <b>' + info.toAccount + '</b></div>'
                  + '<div style="color:#bdd0df;margin-bottom:8px;">' + t('amount','Amount') + ': <b>' + Number(info.amount).toFixed(2) + ' TMT</b></div>'
                  + '<div style="color:#9fb5c8;font-size:12px;margin-bottom:16px;">' + (info.description || '') + '</div>'
                  + '<div style="display:flex;gap:10px;justify-content:flex-end;">'
                  + '<button type="button" class="btn btn-outline" id="cfNo">' + t('cancel','Cancel') + '</button>'
                  + '<button type="button" class="btn btn-primary" id="cfYes">' + t('confirm','Confirm') + '</button>'
                  + '</div></div>';
                document.body.appendChild(m);
                const done = (v) => { m.remove(); resolve(v); };
                m.querySelector('#cfYes').onclick = () => done(true);
                m.querySelector('#cfNo').onclick  = () => done(false);
            });
        }
        function handleTransferError(status, body){
            if (status === 401) { location.href = 'login.html'; return; }
            if (status === 403) return showMessage(t('err_forbidden','Forbidden'),'error');
            if (status === 404) return showMessage(t('err_recipient','Recipient not found'),'error');
            if (status === 409) return showMessage(t('err_funds','Insufficient funds'),'error');
            if (status === 429) return showMessage(t('err_rate','Too many requests'),'error');
            if (status === 400) return showMessage(t('err_input','Check data'),'error');
            showMessage(t('err_server','Server error'),'error');
        }
        $('transferForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fromAccountId = $('fromAccount')?.value;
            const toAccount = ($('toAccount')?.value || '').trim();
            const amount = Number($('transferAmount')?.value);
            const description = ($('transferDesc')?.value || '').trim();
            if (!fromAccountId) return showMessage(t('err_from','Select account'),'error');
            if (!isValidIban(toAccount)) return showMessage(t('err_iban','Invalid IBAN'),'error');
            if (!(amount > 0)) return showMessage(t('err_amount','Invalid amount'),'error');
            const confirmed = await confirmTransfer({ toAccount, amount, description });
            if (!confirmed) return;
            const btn = $('transferBtn');
            if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = '...'; }
            try {
                const token = (function(){
                    try { return JSON.parse(localStorage.getItem('sfera_user') || '{}').token || localStorage.getItem('token') || ''; }
                    catch(e) { return localStorage.getItem('token') || ''; }
                })();
                const idem = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
                const res = await fetch('/api/bank/transfer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Idempotency-Key': idem },
                    body: JSON.stringify({ fromAccountId, toAccount, amount, description })
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) return handleTransferError(res.status, body);
                showMessage(t('transfer_ok','Transfer completed'),'success');
                $('transferForm')?.reset();
                await loadBankData();
            } catch (err) {
                showMessage(t('net_error','Network error, try later'),'error');
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Send'; }
            }
        });

`;
  const c2 = replaceBlock(c, subStart, subEnd, subBlock);
  if (c2 == null) return warn(`${F.html}: submit markers not found`);

  writePatched(F.html, c2, r.content, 'html');
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 1 - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'server', 'src'))) {
    bad('server/src not found - run from repo root'); process.exit(1);
  }
  log('-- Schema --');       patchAccount(); patchTransaction();
  log('\n-- New files --'); for (const [rel, m, c] of NEW) ensureFile(rel, c, m);
  log('\n-- Patches --');     patchRoutes(); patchController(); patchHtml();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint1.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }