#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 2.1
 * 1) fix errorHandler: mount + JSON {success,code,message}
 * 2) extend getTransactions (filters + total)
 * 3) Notification model + handlers + routes
 *
 * Запуск из корня репо: node tools/sfera-bank-sprint2a.js [--apply]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TAG = 'SFERA-PATCH:SPRINT2';
const ROOT = path.resolve(__dirname, '..');
const DRY = !process.argv.includes('--apply');

const F = {
  server:      'server/server.js',
  errorHandler:'server/src/middleware/errorHandler.js',
  controller:  'server/src/controllers/bankController.js',
  notification:'server/src/models/Notification.js',
  routes:      'server/src/routes/bankRoutes.js',
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

// ---------- 1. server.js: mount errorHandler ----------
function patchServer() {
  const r = read(F.server); if (!r) return warn(`${F.server}: not found`);
  if (r.content.includes(`${TAG}:mount`)) return log(`-- ${F.server}: already patched`);

  let c = r.content;

  // 1a. require
  if (!c.includes(`require('./src/middleware/errorHandler')`)) {
    const anchor = `const initSocket = require('./src/sockets');`;
    if (!c.includes(anchor)) return warn(`${F.server}: initSocket anchor not found`);
    c = c.replace(anchor, anchor + `\nconst errorHandler = require('./src/middleware/errorHandler');`);
  }

  // 1b. app.use after healthcheck, before const PORT
  const portAnchor = `const PORT = process.env.PORT || 10000;`;
  if (!c.includes(portAnchor)) return warn(`${F.server}: PORT anchor not found`);
  const block = `// ${TAG}:mount — global error handler, MUST be after all routes
app.use(errorHandler);

`;
  c = c.replace(portAnchor, block + portAnchor);

  writePatched(F.server, c, r.content);
}

// ---------- 2. errorHandler.js: full replacement ----------
function patchErrorHandler() {
  const r = read(F.errorHandler); if (!r) return warn(`${F.errorHandler}: not found`);
  if (r.content.includes(`${TAG}:errorHandler`)) return log(`-- ${F.errorHandler}: already patched`);

  const newContent = `// ${TAG}:errorHandler
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('❌ Error:', (err && err.stack) || err);
  const status = (err && (err.status || err.statusCode)) || 500;
  const code = (err && err.code) || 'INTERNAL_ERROR';
  const message = (err && err.message) || 'Internal Server Error';
  res.status(status).json({ success: false, code, message });
};

module.exports = errorHandler;
`;
  writePatched(F.errorHandler, newContent, r.content);
}

// ---------- 3. getTransactions: filters + total ----------
function patchGetTransactions() {
  const r = read(F.controller); if (!r) return warn(`${F.controller}: not found`);
  if (r.content.includes(`${TAG}:getTransactions`)) return log(`-- ${F.controller}: getTransactions already patched`);

  const re = /exports\.getTransactions\s*=\s*async[\s\S]*?\n\};/;
  if (!re.test(r.content)) return warn(`${F.controller}: getTransactions block not matched`);

  const newBlock = `// ${TAG}:getTransactions
exports.getTransactions = async (req, res, next) => {
  try {
    const limit  = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip   = Math.max(Number(req.query.skip) || 0, 0);
    const type   = String(req.query.type || '').trim();
    const search = String(req.query.search || '').trim();
    const from   = req.query.from ? new Date(req.query.from) : null;
    const to     = req.query.to   ? new Date(req.query.to)   : null;

    const accounts = await Account.find({ userId: req.userId }).lean();
    const accountIds = accounts.map(a => a._id);

    const query = {
      $or: [
        { sender: req.userId },
        { recipient: req.userId },
        { fromAccountId: { $in: accountIds } },
        { toAccountId:   { $in: accountIds } }
      ]
    };

    const VALID_TYPES = ['transfer','deposit','withdrawal','payment','escrow_hold','escrow_release'];
    if (type && VALID_TYPES.includes(type)) query.type = type;

    if (search) {
      const safeSearch = search.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
      query.description = { $regex: safeSearch, $options: 'i' };
    }

    if (from || to) {
      query.createdAt = {};
      if (from && !isNaN(from.getTime())) query.createdAt.$gte = from;
      if (to   && !isNaN(to.getTime()))   query.createdAt.$lte = to;
      if (!Object.keys(query.createdAt).length) delete query.createdAt;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Transaction.countDocuments(query)
    ]);

    return res.status(200).json({ success: true, data: transactions, total, limit, skip });
  } catch (error) { next(error); }
};`;

   const next = r.content.replace(re, () => newBlock);
   writePatched(F.controller, next, r.content);
}

// ---------- 4. Notification model ----------
const NOTIFICATION = `// ${TAG}:notification
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:    { type: String, default: 'info' },
  message: { type: String, required: true },
  read:    { type: Boolean, default: false, index: true },
  meta:    { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
`;
function createNotificationModel() {
  ensureFile(F.notification, NOTIFICATION, `${TAG}:notification`);
}

// ---------- 5. Notification handlers ----------
function patchNotificationHandlers() {
  const r = read(F.controller); if (!r) return warn(`${F.controller}: not found`);
  if (r.content.includes(`${TAG}:getNotifications`)) return log(`-- ${F.controller}: notifications already added`);

  let c = r.content;

  // require
  if (!c.includes(`require('../models/Notification')`)) {
    const anchor = `const Transaction = require('../models/Transaction');`;
    if (!c.includes(anchor)) return warn(`${F.controller}: Transaction require not found`);
    c = c.replace(anchor, anchor + `\nconst Notification = require('../models/Notification');`);
  }

  const handlers = `

// ${TAG}:getNotifications
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(50).lean();
    const unread = notifications.filter(n => !n.read).length;
    return res.status(200).json({ success: true, data: notifications, unread });
  } catch (error) { next(error); }
};

// ${TAG}:markNotificationRead
exports.markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid id' });
    }
    await Notification.updateOne({ _id: id, userId: req.userId }, { $set: { read: true } });
    return res.status(200).json({ success: true });
  } catch (error) { next(error); }
};
`;

  c = c.trimEnd() + handlers;
  writePatched(F.controller, c, r.content);
}

// ---------- 6. bankRoutes ----------
function patchBankRoutes() {
  const r = read(F.routes); if (!r) return warn(`${F.routes}: not found`);
  if (r.content.includes(`${TAG}:routes`)) return log(`-- ${F.routes}: already patched`);

  let c = r.content;

  const oldReq = `const { getBalance, getTransactions } = require('../controllers/bankController');`;
  if (!c.includes(oldReq)) return warn(`${F.routes}: controller require anchor not found`);
  c = c.replace(oldReq, `const { getBalance, getTransactions, getNotifications, markNotificationRead } = require('../controllers/bankController');`);

  const txAnchor = `router.get('/transactions', getTransactions);`;
  if (!c.includes(txAnchor)) return warn(`${F.routes}: /transactions anchor not found`);
  c = c.replace(txAnchor, txAnchor + `\n\n// ${TAG}:routes\nrouter.get('/notifications', getNotifications);\nrouter.patch('/notifications/:id/read', markNotificationRead);`);

  writePatched(F.routes, c, r.content);
}

// ---------- MAIN ----------
function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 2.1 - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'server', 'src'))) {
    bad('server/src not found - run from repo root'); process.exit(1);
  }

  log('-- Fix errorHandler (mount + JSON) --');
  patchErrorHandler();
  patchServer();

  log('\n-- Extend getTransactions --');
  patchGetTransactions();

  log('\n-- Notification model --');
  createNotificationModel();

  log('\n-- Notification handlers --');
  patchNotificationHandlers();

  log('\n-- Routes --');
  patchBankRoutes();

  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint2a.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }