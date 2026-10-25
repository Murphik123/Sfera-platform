// SFERA-PATCH:SPRINT1:iban
function validateIban(iban) {
  if (!iban || typeof iban !== 'string') return false;
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(clean)) return false;
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, ch => (ch.charCodeAt(0) - 55).toString());
  try { return BigInt(numeric) % 97n === 1n; } catch (e) { return false; }
}
module.exports = { validateIban };
