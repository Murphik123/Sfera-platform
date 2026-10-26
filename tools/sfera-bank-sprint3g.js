#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.4a — Cards backend
 * - Card model (userId, type, fullNumber, maskedNumber, expiry, frozen, limit)
 * - cardNumber utils (Luhn, mask, expiry)
 * - bankController: getCards, createCard, freezeCard
 * - getBalance: cards[] теперь реальные (не пустой массив)
 * - bankRoutes: GET/POST /cards, PATCH /cards/:id
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TAG = 'SFERA-PATCH:SPRINT3.4a';
const ROOT = path.resolve(__dirname, '..');
const DRY = !process.argv.includes('--apply');

const F = {
  card:        'server/src/models/Card.js',
  cardUtils:   'server/src/utils/cardNumber.js',
  controller:  'server/src/controllers/bankController.js',
  routes:      'server/src/routes/bankRoutes.js',
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

// ---------------------- 1. Card model ----------------------
const CARD_MODEL = `// ${TAG}:card-model
const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:         { type: String, enum: ['debit','credit','virtual'], default: 'debit' },
  fullNumber:   { type: String, required: true, unique: true },
  maskedNumber: { type: String, required: true },
  expiry:       { type: String, required: true },
  frozen:       { type: Boolean, default: false, index: true },
  limit:        { type: Number, default: 1000 }
}, { timestamps: true });

module.exports = mongoose.model('Card', cardSchema);
`;

// ---------------------- 2. cardNumber utils ----------------------
const CARD_UTILS = `// ${TAG}:card-utils
const crypto = require('crypto');

function generateCardNumber() {
  // Visa-like prefix 4, 16 digits with Luhn check
  let base = '4';
  for (let i = 0; i < 14; i++) base += crypto.randomInt(0, 10);

  const digits = (base + '0').split('').map(Number);
  let sum = 0;
  let alt = true;
  for (let i = 15; i >= 0; i--) {
    let d = digits[i];
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

function formatMasked(full) {
  return '•••• •••• •••• ' + String(full).slice(-4);
}

function generateExpiry() {
  const now = new Date();
  const futureYear = now.getFullYear() + 3;
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(futureYear % 100).padStart(2, '0');
  return mm + '/' + yy;
}

module.exports = { generateCardNumber, formatMasked, generateExpiry };
`;

// ---------------------- 3. bankController ----------------------
function patchController() {
  const r = read(F.controller); if (!r) return warn(`${F.controller}: not found`);
  if (r.content.includes(`${TAG}:cards`)) return log(`-- controller: already patched`);

  let c = r.content;

  // 3a. requires
  if (!c.includes(`require('../models/Card')`)) {
    const anchor = `const Transaction = require('../models/Transaction');`;
    if (!c.includes(anchor)) return warn(`controller: Transaction require not found`);
    c = c.replace(
      anchor,
      anchor + `\nconst Card = require('../models/Card');\nconst { generateCardNumber, formatMasked, generateExpiry } = require('../utils/cardNumber');`
    );
  }

  // 3b. getBalance: cards: [] -> реальные карты
  const cardsEmptyAnchor = `        cards: [], transactions, notifications: [],`;
  if (c.includes(cardsEmptyAnchor)) {
    // Заменяем `cards: []` на переменную cards, и добавляем const cards выше
    // Найдём начало getBalance для вставки запроса
    const gbStart = c.indexOf('exports.getBalance = async');
    if (gbStart === -1) return warn(`controller: getBalance not found`);
    const ibanLoopEnd = c.indexOf('const ids = accounts.map', gbStart);
    if (ibanLoopEnd === -1) return warn(`controller: accounts loop end not found`);

    // Вставляем запрос cards перед const ids
    c = c.slice(0, ibanLoopEnd) +
      `const cards = await Card.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();\n    ` +
      c.slice(ibanLoopEnd);

    // Меняем cards: [] на cards с маппингом
    c = c.replace(
      cardsEmptyAnchor,
      `        cards: cards.map(cd => ({ id: String(cd._id), _id: String(cd._id), type: cd.type, maskedNumber: cd.maskedNumber, expiry: cd.expiry, frozen: cd.frozen, limit: cd.limit })), transactions, notifications: [],`
    );
  }

  // 3c. вставка getCards/createCard/freezeCard после markNotificationRead
  const candidates = [
    'exports.markNotificationRead = async',
    'exports.getNotifications = async',
    'exports.exportTransactions = async',
    'exports.getTransactions = async'
  ];
  let found = null;
  for (const cand of candidates) {
    const f = findFunctionBlock(c, cand);
    if (f) { found = f; break; }
  }
  if (!found) return warn(`controller: не найден exports.* для вставки cards handlers`);

  const cardHandlers = `

// ${TAG}:cards
exports.getCards = async (req, res, next) => {
  try {
    const cards = await Card.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      data: cards.map(cd => ({
        id: String(cd._id), _id: String(cd._id), type: cd.type,
        maskedNumber: cd.maskedNumber, expiry: cd.expiry,
        frozen: cd.frozen, limit: cd.limit, createdAt: cd.createdAt
      }))
    });
  } catch (error) { next(error); }
};

exports.createCard = async (req, res, next) => {
  try {
    const { type = 'debit', limit = 1000 } = req.body || {};
    const VALID_TYPES = ['debit','credit','virtual'];
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, code: 'INVALID_TYPE', message: 'type must be debit, credit or virtual' });
    }
    const fullNumber = generateCardNumber();
    const maskedNumber = formatMasked(fullNumber);
    const expiry = generateExpiry();
    const card = await Card.create({
      userId: req.userId, type, fullNumber, maskedNumber, expiry,
      frozen: false, limit: Number(limit) || 1000
    });
    return res.status(201).json({
      success: true,
      data: {
        id: String(card._id), _id: String(card._id), type: card.type,
        maskedNumber: card.maskedNumber, expiry: card.expiry,
        frozen: card.frozen, limit: card.limit
      }
    });
  } catch (error) { next(error); }
};

exports.freezeCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid card id' });
    }
    const card = await Card.findOne({ _id: id, userId: req.userId });
    if (!card) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Card not found' });
    const frozen = typeof req.body.frozen === 'boolean' ? req.body.frozen : true;
    card.frozen = frozen;
    await card.save();
    return res.status(200).json({ success: true, data: { id: String(card._id), frozen: card.frozen } });
  } catch (error) { next(error); }
};
`;

  c = c.slice(0, found.end) + cardHandlers + c.slice(found.end);
  writePatched(F.controller, c, r.content);
}

// ---------------------- 4. bankRoutes ----------------------
function patchRoutes() {
  const r = read(F.routes); if (!r) return warn(`${F.routes}: not found`);
  if (r.content.includes(`${TAG}:routes`)) return log(`-- routes: already patched`);

  let c = r.content;

  // require cards handlers
  const oldReq = `const { getBalance, getTransactions, getNotifications, markNotificationRead, exportTransactions } = require('../controllers/bankController');`;
  if (!c.includes(oldReq)) return warn(`routes: controller require not found`);
  c = c.replace(
    oldReq,
    `const { getBalance, getTransactions, getNotifications, markNotificationRead, exportTransactions, getCards, createCard, freezeCard } = require('../controllers/bankController');`
  );

  // роуты после /transactions/export
  const anchor = `router.get('/transactions/export', exportTransactions);`;
  if (!c.includes(anchor)) return warn(`routes: /transactions/export anchor not found`);
  c = c.replace(
    anchor,
    anchor + `\n// ${TAG}:routes\nrouter.get('/cards', getCards);\nrouter.post('/cards', createCard);\nrouter.patch('/cards/:id', freezeCard);`
  );

  writePatched(F.routes, c, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.4a (Cards backend) - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'server', 'src'))) {
    bad('server/src not found - run from repo root'); process.exit(1);
  }
  log('-- Card model --'); ensureFile(F.card, CARD_MODEL, `${TAG}:card-model`);
  log('\n-- cardNumber utils --'); ensureFile(F.cardUtils, CARD_UTILS, `${TAG}:card-utils`);
  log('\n-- bankController: getCards/createCard/freezeCard + getBalance cards[] --'); patchController();
  log('\n-- bankRoutes: /cards routes --'); patchRoutes();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3g.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }