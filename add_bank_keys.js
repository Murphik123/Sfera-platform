const fs = require('fs');
const path = require('path');

const langsDir = path.join(__dirname, 'public', 'languages');
const backupDir = path.join(__dirname, 'bank_keys_backup_' + Date.now());
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

const newKeys = {
  tm: {
    no_accounts: 'Hasaplar elýeterli däl',
    bank_api_unavailable: 'Bank API elýeterli däl',
    bank_load_error: 'Bank maglumatlaryny ýüklemek başartmady',
    bank_transfer_contract_pending: 'Geçiriş API şertnamasy tassyklanylýança amal ýapyk'
  },
  ru: {
    no_accounts: 'Нет доступных счетов',
    bank_api_unavailable: 'Bank API недоступен',
    bank_load_error: 'Не удалось загрузить данные банка',
    bank_transfer_contract_pending: 'Перевод заблокирован до утверждения API-контракта'
  },
  en: {
    no_accounts: 'No accounts available',
    bank_api_unavailable: 'Bank API unavailable',
    bank_load_error: 'Failed to load bank data',
    bank_transfer_contract_pending: 'Transfer disabled until API contract is approved'
  }
};

for (const lang of ['tm', 'ru', 'en']) {
  const p = path.join(langsDir, lang + '.json');
  if (!fs.existsSync(p)) { console.warn(`⚠️  ${lang}.json не найден`); continue; }

  const raw = fs.readFileSync(p, 'utf8');
  let data;
  try { data = JSON.parse(raw); } catch (e) {
    console.error(`❌ ${lang}.json: ${e.message}`);
    process.exit(1);
  }

  fs.writeFileSync(path.join(backupDir, lang + '.json.bak'), raw, 'utf8');

  let added = 0;
  for (const [k, v] of Object.entries(newKeys[lang])) {
    if (!(k in data)) { data[k] = v; added++; }
  }

  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✅ ${lang}.json: +${added} ключей`);
}

console.log(`\n📁 Бэкапы: ${backupDir}`);