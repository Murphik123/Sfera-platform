/**
 * Валидация IBAN (алгоритм mod-97, ISO 13616)
 */
function validateIban(iban) {
  if (!iban || typeof iban !== 'string') return false;
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(clean)) return false;

  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => (ch.charCodeAt(0) - 55).toString());
  const remainder = BigInt(numeric) % 97n;
  return remainder === 1n;
}

module.exports = { validateIban };