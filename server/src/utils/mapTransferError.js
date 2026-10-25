// SFERA-PATCH:SPRINT1:mapErr
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
