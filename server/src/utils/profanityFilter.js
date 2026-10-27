/**
 * SFERA — profanity filter TM / RU / EN
 * Подход:
 *  - normalize(): lower + снятие диакритики (tm) + ё→е
 *  - длинные корни → regex substring (безопасно)
 *  - короткие слова → regex с prefix-boundary / \b (латиница)
 */

const RULES = [
  // ================= RU =================
  /хуйн/i,
  /пизд/i,
  /бля[дт]/i,
  /заеб|наеб|въеб|разъеб|отъеб|взъеб|выеб|проеб|долбо[её]б/i,
  /оху|наху|поху/i,
  /пидо|пидар|пидр/i,
  /муда|мудил/i,
  /залуп|манда/i,
  /херн|херов/i,
  /говн|дерьм/i,
  /гандон|гондон|у[её]б/i,
  /сук[аи]|суч[аеи]/i,
  /жоп[аыуе]/i,
  /сра[тл]|сру/i,
  // хуй-формы (с префиксом, чтобы не задеть "хуюже")
  /(?:^|[^а-яё])ху[йяюеё]/i,
  // еб-формы (хлебал, колебал — не срабатывают)
  /(?:^|[^а-яё])[её]б[аеиуё]/i,
  /(?:^|[^а-яё])[её]бал|[её]бёт|[её]бет/i,

  // ================= EN =================
  /fuck|shit|bitch|cunt|dick|asshole|bastard|whore|slut|piss/i,
  /retard|nigga|nigger|motherfuck/i,
  /dickhead|cocksuck|bullshit|horseshit|dipshit|shithead/i,
  /\bdamn\b/i,
  /\bass\b/i,

  // ================= TM =================
  /siktir|sikdir|sikik|siker|sikiş|sikis/i,
  /amcik|amin[ai]/i,
  /gotveren|götveren/i,
  /orospu|pezevenk|kahpe|yavsak|yavşak|yarrak|yarak/i,
  /tasak|taşak|taşşak|pust|puşt|haramzada|qancik|qancık|godoş|godos/i,
  /\bsik\b/i,
  /\bpi[cç]\b/i,
  /\bam[iı]\b/i
];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // убираем диакритику: ö→o, ü→u, ş→s, ç→c, ı→i
    .replace(/ё/g, 'е')
    .replace(/[ıİ]/g, 'i');
}

function checkProfanity(text) {
  const norm = normalize(text);
  if (!norm) return false;
  return RULES.some(re => re.test(norm));
}

function maskProfanity(text) {
  let out = String(text || '');
  RULES.forEach(re => {
    out = out.replace(re, (m) => '*'.repeat(m.length));
  });
  return out;
}

module.exports = { checkProfanity, maskProfanity, RULES };
