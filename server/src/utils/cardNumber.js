// SFERA-PATCH:SPRINT3.4a:card-utils
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
