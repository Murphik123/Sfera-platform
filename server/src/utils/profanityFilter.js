/**
 * SFERA — матерный фильтр tm/ru/en
 * Токенизация + нормализация диакритиков. Покрывает типичные формы.
 */

const PROFANITY_WORDS = new Set([
  // --- RU (кириллица) ---
  'хуй', 'хуя', 'хую', 'хуе', 'хуё', 'хуи', 'хуем', 'хуёв', 'хуёвый', 'хуёвая', 'хуёвое',
  'хуйня', 'хуйню', 'хуйнёй', 'хуйни', 'хуйло', 'хуйла', 'хуйлом',
  'нахуй', 'нахуя', 'нихуя', 'похуй', 'похуя', 'охуеть', 'охуел', 'охуела', 'охуели', 'охуенно', 'охуенный',
  'пизда', 'пизды', 'пизде', 'пизду', 'пиздой', 'пиздец', 'пиздато', 'пиздатый', 'пиздеть', 'пиздит', 'пиздят',
  'пиздюк', 'пиздюки', 'распиздяй', 'распиздяйство', 'спиздил', 'спиздила', 'спиздили', 'спиздить',
  'бля', 'блядь', 'бляди', 'блядский', 'блядская', 'блядство', 'бляха', 'бляха-муха',
  'ебал', 'ебу', 'ебёт', 'ебет', 'ебан', 'ебать', 'ебаться', 'ебало', 'ебло', 'еботня',
  'еблан', 'ебланы', 'уебан', 'уебище', 'уёбок', 'уёбки',
  'заебал', 'заебала', 'заебали', 'заебало', 'заебись', 'заебись-то', 'заебёшь',
  'наебал', 'наебала', 'наебали', 'наебка', 'наебалово',
  'отъебись', 'отъебитесь', 'въебал', 'въебала', 'въебали', 'разъебал', 'разъебала', 'разъебали',
  'долбоёб', 'долбоеб', 'долбоёбы', 'долбоебы', 'остоебал', 'остоебенило',
  'пидор', 'пидар', 'пидорас', 'пидораска', 'пидорасы', 'пидорасня', 'педик', 'педики',
  'гандон', 'гондон', 'гандончик',
  'мудак', 'мудаки', 'мудила', 'мудило', 'мудозвон',
  'сука', 'сучка', 'сучки', 'сукин', 'сучонок',
  'залупа', 'залупой', 'залупу', 'залупе',
  'манда', 'мандавошка', 'мандавоха',
  'херня', 'херни', 'хернёй', 'херовой', 'херово', 'херовый', 'хер',
  'жопа', 'жопы', 'жопу', 'жопой', 'жопе',
  'говно', 'говна', 'говну', 'говном', 'говноед', 'говнюк', 'говнюки',
  'дерьмо', 'дерьма', 'дерьму', 'дерьмом',
  'срать', 'срал', 'срала', 'срали', 'сру', 'срёт', 'срет', 'срут',
  // --- EN ---
  'fuck', 'fucks', 'fucked', 'fucker', 'fuckers', 'fucking', 'fuckin',
  'motherfucker', 'motherfuckers', 'motherfucking', 'clusterfuck',
  'shit', 'shits', 'shitty', 'bullshit', 'shithead', 'shitheads', 'dipshit', 'apeshit', 'horseshit',
  'bitch', 'bitches', 'bitchy', 'sonofabitch',
  'cunt', 'cunts',
  'dick', 'dicks', 'dickhead', 'dickheads',
  'cock', 'cocks', 'cocksucker', 'cocksuckers',
  'asshole', 'assholes', 'arsehole',
  'bastard', 'bastards',
  'whore', 'whores',
  'slut', 'sluts', 'slutty',
  'piss', 'pissed', 'pissing', 'pisses',
  'damn', 'goddamn',
  'nigger', 'niggers', 'nigga',
  'retard', 'retards', 'retarded',
  // --- TM (туркменский / турецкие заимствования) ---
  'sik', 'sikim', 'siker', 'sikerim', 'siktir', 'sikdir', 'sikiş', 'sikis', 'sikik',
  'am', 'amı', 'amık', 'amcık', 'amcik', 'amına', 'amina', 'amını', 'amini',
  'göt', 'götveren', 'gotveren', 'götüne', 'gotune', 'götünə',
  'orospu', 'orospular', 'orospuçocuğu', 'orospuçocugu',
  'piç', 'pic', 'piçler', 'picler', 'piçlik',
  'pezevenk', 'pezevenkler',
  'kahpe', 'kahpeler',
  'yavşak', 'yavsak', 'yavşaklar',
  'sıç', 'sıçtım', 'sic', 'sictim', 'sıçma',
  'yarrak', 'yarak', 'yarraklar',
  'taşak', 'tasak', 'taşşak', 'tassak',
  'puşt', 'pust', 'puştlar',
  'haramzada', 'haramzadalar',
  'qancık', 'qancik',
  'godoş', 'godos', 'godosh'
]);

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ё/g, 'е');
}

function checkProfanity(text) {
  const norm = normalize(text);
  if (!norm) return false;
  const tokens = norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const token of tokens) {
    if (PROFANITY_WORDS.has(token)) return true;
  }
  return false;
}

function maskProfanity(text) {
  const norm = normalize(text);
  const tokens = norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let out = String(text || '');
  tokens.forEach(t => {
    if (PROFANITY_WORDS.has(t)) {
      out = out.replace(new RegExp(t, 'gi'), '*'.repeat(t.length));
    }
  });
  return out;
}

module.exports = { checkProfanity, maskProfanity, PROFANITY_WORDS };
