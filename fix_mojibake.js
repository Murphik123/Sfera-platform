const fs = require('fs');
const path = require('path');

// Полная карта соответствия CP1251 -> UTF-8 (все буквы и символы)
const charMap = {
  // Русский алфавит
  'Рђ': 'А', 'Р‘': 'Б', 'Р’': 'В', 'Р“': 'Г', 'Р”': 'Д', 'Р•': 'Е', 'РЃ': 'Ё',
  'Р–': 'Ж', 'Р—': 'З', 'РР': 'И', 'Р™': 'Й', 'Рљ': 'К', 'Р›': 'Л', 'Рњ': 'М',
  'Рќ': 'Н', 'Рћ': 'О', 'Рџ': 'П', 'Р ': 'Р ', 'РЎ': 'С', 'Рў': 'Т', 'РЈ': 'У',
  'Р¤': 'Ф', 'РҐ': 'Х', 'Р¦': 'Ц', 'Р§': 'Ч', 'РЁ': 'Ш', 'Р©': 'Щ', 'РЄ': 'Ъ',
  'Р«': 'Ы', 'Р¬': 'Ь', 'РЭ': 'Э', 'Р®': 'Ю', 'РЇ': 'Я',
  'Р°': 'а', 'Р±': 'б', 'РІ': 'в', 'Рі': 'г', 'Рґ': 'д', 'Рµ': 'е', 'С‘': 'ё',
  'Р¶': 'ж', 'Р·': 'з', 'Рё': 'и', 'Р№': 'й', 'Рє': 'к', 'Р»': 'л', 'Рј': 'м',
  'РЅ': 'н', 'Рѕ': 'о', 'Рї': 'п', 'СЂ': 'р', 'СЃ': 'с', 'С‚': 'т', 'Сѓ': 'у',
  'С„': 'ф', 'С…': 'х', 'С†': 'ц', 'С‡': 'ч', 'С€': 'ш', 'С‰': 'щ', 'СЉ': 'ъ',
  'С‹': 'ы', 'СЊ': 'ь', 'СЌ': 'э', 'СЋ': 'ю', 'СЏ': 'я',
  
  // Спецсимволы и стрелки
  'в†ђ': '←', 'в†’': '→', 'вЂ”': '—', 'вЂ“': '–', 'вЂў': '•', 'В©': '©',
  'в€™': '’', 'вЂњ': '“', 'вЂќ': '”', 'вЂ¦': '…', 'В»': '»', 'В«': '«',
  
  // Турецкие буквы (ломались в ai.html)
  'ГЅ': 'ý', 'Гј': 'ü', 'Г¤': 'ä', 'Г¶': 'ö', 'Г§': 'ç', 'Е€': 'ň', 'Еџ': 'ş',
  'ГЎ': 'á', 'Г©': 'é', 'Г¬': 'ì', 'Г ': 'à'
};

const filesToFix = [
  'public/ai.html',
  'public/bank.html',
  'public/tm-coin.html',
  'public/tm-pay.html'
  // Если увидишь кракозябры ещё где-то, просто добавь сюда путь к файлу
];

let fixedCount = 0;

for (const relativePath of filesToFix) {
  const filePath = path.join(__dirname, relativePath);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  ${relativePath} не найден, пропускаем`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let replacedChars = 0;

  // Проходим по карте и заменяем битые символы
  for (const [broken, fixed] of Object.entries(charMap)) {
    if (content.includes(broken)) {
      content = content.split(broken).join(fixed);
      replacedChars++;
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${relativePath}: исправлено (затронуто уникальных символов: ${replacedChars})`);
    fixedCount++;
  } else {
    console.log(`ℹ️  ${relativePath}: битых символов не найдено`);
  }
}

console.log(`\n🎉 Готово. Исправлено файлов: ${fixedCount}`);