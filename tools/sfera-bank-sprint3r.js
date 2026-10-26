#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.4m — Card reveal (CVV + fullNumber с re-auth)
 * - models/CardReveal.js — audit log
 * - utils/cardNumber.js + generateCvv (HMAC, не хранится)
 * - bankController.revealCard — password → verify → rate limit → audit → return
 * - bankRoutes POST /cards/:id/reveal
 * Atomic: pre-check → write → post-check → rollback при провале
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TAG = 'SFERA-PATCH:SPRINT3.4m';
const ROOT = path.resolve(__dirname, '..');
const DRY = !process.argv.includes('--apply');

const F = {
  revealModel: 'server/src/models/CardReveal.js',
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

// ---------------------- 1. CardReveal model ----------------------
const REVEAL_MODEL = `// ${TAG}:reveal-model
const mongoose = require('mongoose');

const cardRevealSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cardId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true, index: true },
  ip:        { type: String, default: '' },
  userAgent: { type: String, default: '' },
  success:   { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('CardReveal', cardRevealSchema);
`;

// ---------------------- 2. cardNumber.js + generateCvv ----------------------
function patchCardUtils() {
  const r = read(F.cardUtils); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:cvv`)) return log(`-- cvv: already patched`);

  const anchor = `module.exports = { generateCardNumber, formatMasked, generateExpiry };`;
  if (!r.content.includes(anchor)) return warn(`cvv: module.exports anchor not found`);

  const cvvFn = `// ${TAG}:cvv — детерминированный CVV через HMAC(cardId + secret), НЕ хранится
const cryptoMod = require('crypto');
function generateCvv(cardId) {
  const secret = process.env.CARD_CVV_SECRET || 'sfera-default-cvv-secret-change-me';
  const h = cryptoMod.createHmac('sha256', secret).update(String(cardId)).digest();
  const num = (h.readUInt32BE(0) % 900) + 100; // 100-999
  return String(num);
}

module.exports = { generateCardNumber, formatMasked, generateExpiry, generateCvv };`;

  const next = r.content.replace(anchor, cvvFn);
  writePatched(F.cardUtils, next, r.content);
}

// ---------------------- 3. bankController.revealCard ----------------------
function patchController() {
  const r = read(F.controller); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:reveal`)) return log(`-- reveal: already patched`);

  let c = r.content;

  // 3a. requires — bcrypt + User + CardReveal + generateCvv
  if (!c.includes(`require('../models/CardReveal')`)) {
    const anchor = `const Card = require('../models/Card');`;
    if (!c.includes(anchor)) return warn(`controller: Card require not found`);
    c = c.replace(anchor,
      anchor + `\nconst CardReveal = require('../models/CardReveal');\nconst User = require('../models/User');`
    );
  }
  if (!c.includes(`generateCvv`)) {
    const anchor = `const { generateCardNumber, formatMasked, generateExpiry } = require('../utils/cardNumber');`;
    if (!c.includes(anchor)) return warn(`controller: cardNumber require not found`);
    c = c.replace(anchor,
      `const { generateCardNumber, formatMasked, generateExpiry, generateCvv } = require('../utils/cardNumber');`
    );
  }
  if (!c.includes(`require('bcrypt')`) && !c.includes(`require('bcryptjs')`)) {
    // определим, какой доступен
    let bcryptLib = 'bcrypt';
    try { require.resolve('bcrypt'); } catch (e) {
      try { require.resolve('bcryptjs'); bcryptLib = 'bcryptjs'; } catch (e2) { bcryptLib = 'bcrypt'; }
    }
    const anchor = `const Notification = require('../models/Notification');`;
    if (c.includes(anchor)) {
      c = c.replace(anchor, anchor + `\nconst bcrypt = require('${bcryptLib}');`);
    } else {
      const txReq = `const Transaction = require('../models/Transaction');`;
      if (!c.includes(txReq)) return warn(`controller: Transaction require not found`);
      c = c.replace(txReq, txReq + `\nconst bcrypt = require('${bcryptLib}');`);
    }
  }

  // 3b. rate limit Map (in-memory)
  if (!c.includes(`_revealAttempts`)) {
    const anchor = `exports.getCards = async (req, res, next) => {`;
    if (!c.includes(anchor)) return warn(`controller: getCards anchor not found`);
    c = c.replace(anchor, `// ${TAG}:rate-limit-map\nconst _revealAttempts = new Map();\nconst REVEAL_WINDOW_MS = 5 * 60 * 1000;\nconst REVEAL_MAX = 3;\n\n` + anchor);
  }

  // 3c. revealCard после freezeCard
  const found = (function(content, fnHeader) {
    const start = content.indexOf(fnHeader);
    if (start === -1) return null;
    const braceOpen = content.indexOf('{', start);
    if (braceOpen === -1) return null;
    let depth = 0, inStr = null, inLine = false, inBlock = false;
    for (let i = braceOpen; i < content.length; i++) {
      const ch = content[i], next = content[i + 1];
      if (inLine) { if (ch === '\n') inLine = false; continue; }
      if (inBlock) { if (ch === '*' && next === '/') { inBlock = false; i++; } continue; }
      if (inStr) { if (ch === '\\') { i++; continue; } if (ch === inStr) inStr = null; continue; }
      if (ch === '/' && next === '/') { inLine = true; i++; continue; }
      if (ch === '/' && next === '*') { inBlock = true; i++; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return { start, end: i + 1 }; }
    }
    return null;
  })(c, 'exports.freezeCard = async');

  if (!found) return warn(`controller: freezeCard function not found`);

  const revealHandler = `

// ${TAG}:reveal
exports.revealCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const password = String((req.body && req.body.password) || '');

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid card id' });
    }
    if (!password) {
      return res.status(400).json({ success: false, code: 'PASSWORD_REQUIRED', message: 'Password required' });
    }

    // Rate limit: 3 attempts / 5 min per user
    const now = Date.now();
    const key = String(req.userId);
    const attempts = (_revealAttempts.get(key) || []).filter(t => now - t < REVEAL_WINDOW_MS);
    if (attempts.length >= REVEAL_MAX) {
      return res.status(429).json({ success: false, code: 'RATE_LIMIT', message: 'Too many attempts' });
    }
    attempts.push(now);
    _revealAttempts.set(key, attempts);

    // Verify password
    const user = await User.findById(req.userId).select('password');
    if (!user || !user.password) {
      return res.status(401).json({ success: false, code: 'AUTH', message: 'Authentication failed' });
    }
    const okPwd = await bcrypt.compare(password, user.password);
    if (!okPwd) {
      try {
        await CardReveal.create({
          userId: req.userId, cardId: id,
          ip: req.ip || '', userAgent: req.get('user-agent') || '',
          success: false
        });
      } catch (e) {}
      return res.status(401).json({ success: false, code: 'INVALID_PASSWORD', message: 'Invalid password' });
    }

    // Load card
    const card = await Card.findOne({ _id: id, userId: req.userId }).lean();
    if (!card) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Card not found' });
    }
    if (card.frozen) {
      return res.status(403).json({ success: false, code: 'CARD_FROZEN', message: 'Card is frozen' });
    }

    // Audit
    try {
      await CardReveal.create({
        userId: req.userId, cardId: id,
        ip: req.ip || '', userAgent: req.get('user-agent') || '',
        success: true
      });
    } catch (e) { console.warn('[$TAG] audit fail:', e.message); }

    // Deterministic CVV (не хранится)
    const cvv = generateCvv(id);

    return res.status(200).json({
      success: true,
      data: {
        fullNumber: card.fullNumber,
        cvv: cvv,
        expiry: card.expiry,
        type: card.type
      }
    });
  } catch (error) { next(error); }
};`;

  c = c.slice(0, found.end) + revealHandler + c.slice(found.end);
  writePatched(F.controller, c, r.content);
}

// ---------------------- 4. bankRoutes ----------------------
function patchRoutes() {
  const r = read(F.routes); if (!r) return warn(`not found`);
  if (r.content.includes(`${TAG}:routes`)) return log(`-- routes: already patched`);

  let c = r.content;

  const oldReq = `const { getBalance, getTransactions, getNotifications, markNotificationRead, exportTransactions, getCards, createCard, freezeCard } = require('../controllers/bankController');`;
  if (!c.includes(oldReq)) return warn(`routes: controller require not found`);
  c = c.replace(oldReq,
    `const { getBalance, getTransactions, getNotifications, markNotificationRead, exportTransactions, getCards, createCard, freezeCard, revealCard } = require('../controllers/bankController');`
  );

  const anchor = `router.patch('/cards/:id', freezeCard);`;
  if (!c.includes(anchor)) return warn(`routes: freezeCard anchor not found`);
  c = c.replace(anchor, anchor + `\n// ${TAG}:routes\nrouter.post('/cards/:id/reveal', revealCard);`);

  writePatched(F.routes, c, r.content);
}

function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.4m (Card reveal) - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'server', 'src'))) {
    bad('server/src not found'); process.exit(1);
  }
  log('-- CardReveal model --');
  ensureFile(F.revealModel, REVEAL_MODEL, `${TAG}:reveal-model`);
  log('\n-- cardNumber.generateCvv --');
  patchCardUtils();
  log('\n-- bankController.revealCard --');
  patchController();
  log('\n-- bankRoutes /cards/:id/reveal --');
  patchRoutes();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3r.js --apply' : 'Done.'}\n`);
}
try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }