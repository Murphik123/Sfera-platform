// SFERA-PATCH:SPRINT1:ibanGen
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
