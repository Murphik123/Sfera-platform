// SFERA-PATCH:SPRINT3.2a:pdf
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
