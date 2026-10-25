#!/usr/bin/env node
/**
 * SFERA · минимальный фикс бага Sprint 1:
 * tx-поля вложены внутрь relatedListing вместо корня схемы.
 * v2: якорь на ref:'Listing' (устраняет lazy-обрыв на fromAccountId.default:null)
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'server/src/models/Transaction.js');
const DRY  = !process.argv.includes('--apply');

if (!fs.existsSync(FILE)) { console.error('NOT FOUND:', FILE); process.exit(1); }
const before = fs.readFileSync(FILE, 'utf8');

if (before.includes('SFERA-FIX:NESTING')) {
  console.log('already fixed (marker present)');
  process.exit(0);
}

// Якорь: relatedListing: { ... ref: 'Listing', default: null }
// Уникален для этой схемы, не обрывается на fromAccountId.
const re = /relatedListing:\s*\{[\s\S]*?ref:\s*'Listing'\s*,\s*default:\s*null\s*\}/;
if (!re.test(before)) {
  console.error('relatedListing block NOT matched — пришли текущий Transaction.js');
  process.exit(1);
}

const replacement = `relatedListing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing',
        default: null
    },
    // SFERA-FIX:NESTING
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    fromAccountId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    toAccountId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    toAccount:      { type: String, default: '' },
    idempotencyKey: { type: String, index: true, sparse: true }`;

const after = before.replace(re, replacement);

if (DRY) {
  const i = before.indexOf('relatedListing:');
  const j = after.indexOf('relatedListing:');
  console.log('--- BEFORE (original fragment) ---');
  console.log(before.slice(i, i + 320));
  console.log('\n--- AFTER (fragment) ---');
  console.log(after.slice(j, j + 640));
  console.log('\n--- AFTER (от relatedListing до } схемы) ---');
  const k = after.indexOf('relatedListing:');
  const endIdx = after.indexOf('timestamps: true', k);
  console.log(after.slice(k, endIdx));
  console.log('\nDry-run. Apply: node tools/sfera-fix-transaction-nesting.js --apply');
  process.exit(0);
}

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const bak = FILE + '.bak-' + ts;
fs.copyFileSync(FILE, bak);
fs.writeFileSync(FILE, after);
console.log('OK wrote', FILE, '<-', path.basename(bak));

const r = spawnSync(process.execPath, ['--check', FILE], { encoding: 'utf8' });
if (r.status !== 0) {
  console.error('SYNTAX FAIL:', r.stderr);
  fs.copyFileSync(bak, FILE);
  console.error('reverted from backup');
  process.exit(1);
}
console.log('OK syntax check passed');