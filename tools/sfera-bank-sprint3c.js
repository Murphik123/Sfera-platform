#!/usr/bin/env node
/**
 * SFERA · Bank · Sprint 3.2a — PDF/CSV export backend
 * - utils/exportCsv.js — UTF-8 BOM CSV
 * - utils/exportPdf.js — pdfkit + DejaVuSans (кириллица)
 * - bankController.exportTransactions — GET /api/bank/transactions/export?format=pdf|csv
 * - bankRoutes — роут
 * - Скачивает DejaVuSans.ttf в server/src/assets/fonts/ (если нет)
 *
 * v2: patchController использует findFunctionBlock (bracket counting) —
 *     работает с паттерном `exports.xxx = async ...`, без `module.exports = {}`.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const TAG = 'SFERA-PATCH:SPRINT3.2a';
const ROOT = path.resolve(__dirname, '..');
const DRY = !process.argv.includes('--apply');

const F = {
  controller: 'server/src/controllers/bankController.js',
  routes:     'server/src/routes/bankRoutes.js',
  csv:        'server/src/utils/exportCsv.js',
  pdf:        'server/src/utils/exportPdf.js',
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

// ---------------------- 1. Проверка pdfkit ----------------------
function checkPdfkit() {
  const p = path.join(ROOT, 'server', 'node_modules', 'pdfkit', 'package.json');
  if (!fs.existsSync(p)) {
    bad('pdfkit не установлен. Сначала: cd server && npm install pdfkit');
    process.exit(1);
  }
  log('-- pdfkit: OK');
}

// ---------------------- 2. Скачивание шрифта ----------------------
async function downloadFont() {
  const fontDir = path.join(ROOT, 'server', 'src', 'assets', 'fonts');
  const fontPath = path.join(fontDir, 'DejaVuSans.ttf');
  if (fs.existsSync(fontPath) && fs.statSync(fontPath).size > 100000) {
    return log(`-- font: already exists (${fs.statSync(fontPath).size} bytes)`);
  }
  if (DRY) return log(`-- will download: ${path.relative(ROOT, fontPath)}`);

  fs.mkdirSync(fontDir, { recursive: true });
  const url = 'https://cdn.jsdelivr.net/gh/dejavu-fonts/dejavu-fonts@master/ttf/DejaVuSans.ttf';
  log(`-- downloading: ${url}`);
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(fontPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(fontPath); } catch(_) {}
        return reject(new Error('HTTP ' + res.statusCode));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(() => resolve()); });
    }).on('error', (e) => {
      file.close();
      try { fs.unlinkSync(fontPath); } catch(_) {}
      reject(e);
    });
  });
  ok(`font: ${path.relative(ROOT, fontPath)} (${fs.statSync(fontPath).size} bytes)`);
}

// ---------------------- 3. exportCsv.js ----------------------
const CSV_CONTENT = `// ${TAG}:csv
function toCsv(transactions) {
  const header = ['ID','Тип','Статус','Сумма','Валюта','Описание','Дата','Отправитель','Получатель'];
  const rows = transactions.map(tx => [
    String(tx._id || ''),
    String(tx.type || ''),
    String(tx.status || ''),
    Number(tx.amount || 0).toFixed(2),
    String(tx.currency || 'TMT'),
    String(tx.description || ''),
    tx.createdAt ? new Date(tx.createdAt).toISOString() : '',
    String(tx.fromAccountId || tx.sender || ''),
    String(tx.toAccount || tx.recipient || '')
  ]);
  const esc = v => {
    const s = String(v == null ? '' : v);
    if (s.includes(',') || s.includes('"') || s.includes('\\n') || s.includes('\\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  return '\\uFEFF' + [header, ...rows].map(r => r.map(esc).join(',')).join('\\r\\n');
}
module.exports = { toCsv };
`;

// ---------------------- 4. exportPdf.js ----------------------
const PDF_CONTENT = `// ${TAG}:pdf
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const FONT_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');

function buildPdf(transactions, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', b => chunks.push(b));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const hasFont = fs.existsSync(FONT_PATH);
      if (hasFont) {
        doc.registerFont('body', FONT_PATH);
        doc.font('body');
      }

      doc.fontSize(18).text('SFERA Bank — История транзакций', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(10).fillColor('#666666');
      const period = (opts.from || '—') + ' — ' + (opts.to || '—');
      doc.text('Период: ' + period, { align: 'center' });
      doc.text('Всего транзакций: ' + transactions.length, { align: 'center' });
      doc.fillColor('#000000');
      doc.moveDown(0.8);

      const X = { date: 40, type: 120, desc: 210, amount: 440 };
      let y = doc.y;
      doc.fontSize(9).fillColor('#666666');
      doc.text('Дата', X.date, y);
      doc.text('Тип', X.type, y);
      doc.text('Описание', X.desc, y);
      doc.text('Сумма', X.amount, y);
      doc.moveTo(40, y + 12).lineTo(555, y + 12).strokeColor('#cccccc').stroke();
      doc.fillColor('#000000');
      y += 20;

      const lineH = 14;
      const maxY = 790;

      transactions.forEach(tx => {
        if (y > maxY) {
          doc.addPage();
          if (hasFont) doc.font('body');
          y = 60;
        }
        doc.fontSize(8);
        const date = tx.createdAt ? new Date(tx.createdAt).toLocaleString('ru-RU') : '—';
        const type = String(tx.type || '—');
        const desc = String(tx.description || '').slice(0, 40);
        const amount = Number(tx.amount || 0).toFixed(2) + ' ' + (tx.currency || 'TMT');
        doc.text(date, X.date, y, { width: 75 });
        doc.text(type, X.type, y, { width: 85 });
        doc.text(desc, X.desc, y, { width: 220 });
        doc.text(amount, X.amount, y, { width: 110 });
        y += lineH;
      });

      if (!transactions.length) {
        doc.fontSize(11).fillColor('#999999').text('Нет транзакций за указанный период.', 40, y, { align: 'center' });
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { buildPdf };
`;

// ---------------------- 5. bankController: require + exportTransactions ----------------------
function patchController() {
  const r = read(F.controller); if (!r) return warn(`${F.controller}: not found`);
  if (r.content.includes(`${TAG}:exports`)) return log(`-- controller: already patched`);

  let c = r.content;

  // 1. require utils — после Notification или Transaction
  if (!c.includes(`require('../utils/exportCsv')`)) {
    const reqAnchor = `const Notification = require('../models/Notification');`;
    if (c.includes(reqAnchor)) {
      c = c.replace(
        reqAnchor,
        reqAnchor + `\nconst { toCsv } = require('../utils/exportCsv');\nconst { buildPdf } = require('../utils/exportPdf');`
      );
    } else {
      const txReq = `const Transaction = require('../models/Transaction');`;
      if (!c.includes(txReq)) return warn(`controller: Transaction require not found`);
      c = c.replace(txReq, txReq + `\nconst { toCsv } = require('../utils/exportCsv');\nconst { buildPdf } = require('../utils/exportPdf');`);
    }
  }

  // 2. вставка exportTransactions ПОСЛЕ последнего exports.* блока
  //    Приоритет: markNotificationRead (точно есть после 2.1) → getTransactions → getNotifications → getBalance
  const candidates = [
    'exports.markNotificationRead = async',
    'exports.getTransactions = async',
    'exports.getNotifications = async',
    'exports.getBalance = async'
  ];
  let found = null;
  for (const cand of candidates) {
    const f = findFunctionBlock(c, cand);
    if (f) { found = f; break; }
  }
  if (!found) return warn(`controller: не найден ни один exports.* блок — пришли grep "^exports\\." bankController.js`);

  const block = `

// ${TAG}:exports
exports.exportTransactions = async (req, res, next) => {
  try {
    const format = String(req.query.format || 'csv').toLowerCase();
    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({ success: false, code: 'INVALID_FORMAT', message: 'format must be csv or pdf' });
    }
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
      const safeSearch = search.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&');
      query.description = { $regex: safeSearch, $options: 'i' };
    }
    if (from || to) {
      query.createdAt = {};
      if (from && !isNaN(from.getTime())) query.createdAt.$gte = from;
      if (to   && !isNaN(to.getTime()))   query.createdAt.$lte = to;
      if (!Object.keys(query.createdAt).length) delete query.createdAt;
    }

    const transactions = await Transaction.find(query).sort({ createdAt: -1 }).limit(1000).lean();
    const ts = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const csv = toCsv(transactions);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="sfera-bank-' + ts + '.csv"');
      return res.send(csv);
    }

    const pdfBuffer = await buildPdf(transactions, { from: req.query.from || '', to: req.query.to || '' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="sfera-bank-' + ts + '.pdf"');
    res.setHeader('Content-Length', String(pdfBuffer.length));
    return res.end(pdfBuffer);
  } catch (error) { next(error); }
};
`;

  c = c.slice(0, found.end) + block + c.slice(found.end);
  writePatched(F.controller, c, r.content);
}

// ---------------------- 6. bankRoutes: route ----------------------
function patchRoutes() {
  const r = read(F.routes); if (!r) return warn(`${F.routes}: not found`);
  if (r.content.includes(`${TAG}:routes`)) return log(`-- routes: already patched`);

  let c = r.content;

  const oldReq = `const { getBalance, getTransactions, getNotifications, markNotificationRead } = require('../controllers/bankController');`;
  if (!c.includes(oldReq)) return warn(`routes: controller require not found`);
  c = c.replace(
    oldReq,
    `const { getBalance, getTransactions, getNotifications, markNotificationRead, exportTransactions } = require('../controllers/bankController');`
  );

  const txAnchor = `router.get('/transactions', getTransactions);`;
  if (!c.includes(txAnchor)) return warn(`routes: /transactions anchor not found`);
  c = c.replace(
    txAnchor,
    txAnchor + `\n// ${TAG}:routes\nrouter.get('/transactions/export', exportTransactions);`
  );

  writePatched(F.routes, c, r.content);
}

async function main() {
  log(`\n${DRY ? 'DRY-RUN' : 'APPLY'} - SFERA Bank Sprint 3.2a (PDF/CSV backend) - ROOT=${ROOT}\n`);
  if (!fs.existsSync(path.join(ROOT, 'server', 'src'))) {
    bad('server/src not found - run from repo root'); process.exit(1);
  }

  log('-- pdfkit --'); checkPdfkit();
  log('\n-- Font (DejaVuSans для кириллицы) --'); await downloadFont();
  log('\n-- utils/exportCsv.js --');  ensureFile(F.csv,  CSV_CONTENT, `${TAG}:csv`);
  log('\n-- utils/exportPdf.js --');  ensureFile(F.pdf,  PDF_CONTENT, `${TAG}:pdf`);
  log('\n-- bankController.exportTransactions --'); patchController();
  log('\n-- bankRoutes /transactions/export --'); patchRoutes();
  log(`\n${DRY ? 'Dry-run. Apply: node tools/sfera-bank-sprint3c.js --apply' : 'Done.'}\n`);
}
main().catch(e => { bad(e.stack || e.message); process.exit(1); });