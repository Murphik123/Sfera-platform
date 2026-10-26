// SFERA-PATCH:SPRINT3.2a:pdf
// v3: DD.MM.YYYY HH:MM (без запятой/секунд), расширенная колонка даты
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

      // Колонки: date 40→155 (115px), type 155→250 (95px), desc 250→465 (215px), amount 465+
      const X = { date: 40, type: 155, desc: 250, amount: 465 };
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

        // Дата DD.MM.YYYY HH:MM — без запятой, без секунд, в одну строку
        let date = '—';
        if (tx.createdAt) {
          const d = new Date(tx.createdAt);
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          const hh = String(d.getHours()).padStart(2, '0');
          const mi = String(d.getMinutes()).padStart(2, '0');
          date = dd + '.' + mm + '.' + yyyy + ' ' + hh + ':' + mi;
        }

        const type = String(tx.type || '—');
        const desc = String(tx.description || '').slice(0, 40);
        const amount = Number(tx.amount || 0).toFixed(2) + ' ' + (tx.currency || 'TMT');

        doc.text(date, X.date, y, { width: 110, lineBreak: false });
        doc.text(type, X.type, y, { width: 90, lineBreak: false });
        doc.text(desc, X.desc, y, { width: 210, lineBreak: false });
        doc.text(amount, X.amount, y, { width: 110, lineBreak: false });
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