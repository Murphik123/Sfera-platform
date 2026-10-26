// SFERA-PATCH:SPRINT3.2a:csv
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
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  return '\uFEFF' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
}
module.exports = { toCsv };
