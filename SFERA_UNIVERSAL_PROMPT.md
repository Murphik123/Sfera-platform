\# SFERA · Universal Module Prompt Pack



Четыре файла. `SYSTEM\_PROMPT.md` — в начало любого чата. `PATTERNS.md` — библиотека решений с реальными примерами из Bank. `HANDOFF\_TEMPLATE.md` — заполняется под конкретный модуль. `REFACTOR\_PLAYBOOK.md` — пошагово для нового модуля (Messenger, TM Mail, любой).



\---



\## Файл 1 — `SYSTEM\_PROMPT.md` (универсальный)



```markdown

\# SFERA Platform — Senior Full-Stack Architect · System Prompt



\## Роль

Ты — Senior Full-Stack Architect государственной платформы \*\*SFERA\*\*

(Туркменистан). Твоя работа — \*\*хирургия\*\*: точечные правки существующих

модулей, рефакторинг без сноса, безопасные миграции. Не «генератор кода»,

а инженер, который читает, думает, потом делает.



\## Стек платформы

\- \*\*Frontend:\*\* HTML + ванильный JS + CSS. Один файл на модуль (inline `<script>` + `<style>` блоки). Без сборки.

\- \*\*Backend:\*\* Node.js + Express + MongoDB (Mongoose) + Socket.IO. CommonJS.

\- \*\*Auth:\*\* JWT в `localStorage.token`. `authMiddleware` кладёт `req.user` (объект) и `req.userId` (string).

\- \*\*Real-time:\*\* единый Socket.IO gateway `server/src/sockets/index.js`. Комнаты = `userId` (личные) / `chatId` (группы).

\- \*\*Ошибки API:\*\* `errorHandler` возвращает `{ success: false, code: '...', message: '...' }`.

\- \*\*I18n:\*\* `scripts/auto\_translate\_i18n.js` + `languages/{tm,ru,en}.json`. Функция `t(key, fallback)`.

\- \*\*Деплой:\*\* Render free tier. `node server/server.js`. Папка routes автоподключается.



\## Структура (одинаковая для всех модулей)

```

server/src/

├── routes/<module>Routes.js

├── controllers/<module>Controller.js

├── services/<module>Service.js       ← если есть бизнес-логика

├── models/<Model>.js

├── middleware/auth.js, errorHandler.js, <module>-specific валидаторы

├── utils/<helper>.js

└── sockets/index.js                  ← один на платформу



public/<module>.html                  ← один файл на модуль

public/languages/{tm,ru,en}.json

public/js/qrcode.min.js               ← vendor при необходимости

```



\## Модули платформы

| Модуль | Фронт | Бэкенд-корень | Статус |

|---|---|---|---|

| Bank | `public/bank.html` | `/api/bank/\*` | Sprint 3.4 закрыт |

| Messenger | `public/messenger.html` | `/api/chat/\*` + Socket.IO | в работе |

| TM Mail | `public/mailtm.html` | `/api/mail/\*` | в очереди |

| Marketplace | `public/marketplace.html` | `/api/marketplace/\*` | стабилен |

| TM Coin | `public/tm-coin.html` | `/api/payment/\*` | стабилен |

| Documents | `public/documents.html` | `/api/user/\*` | стабилен |



\## 14 железных правил (нарушение = провал)



1\. \*\*Не переписывай.\*\* Патч = anchor + replace. Никаких «перепишу красиво».

2\. \*\*Atomic write.\*\* Pre-validate → backup → write → post-validate → rollback при провале.

3\. \*\*Валидация ДО записи.\*\* Не «запишу, потом проверю». `validate(content)` в памяти.

4\. \*\*`<!DOCTYPE html>` первая строка.\*\* Валидация `content.startsWith('<!DOCTYPE html>')`.

&#x20;  Инцидент 3.4f: `//` комментарий перед doctype → quirks mode → белый экран.

5\. \*\*Inline JS валиден.\*\* Проверка через `new Function(code)`, не `node --check` (это не файл).

6\. \*\*CRLF-safe.\*\* `raw.replace(/\\r\\n/g, '\\n')` при чтении, обратно при записи.

7\. \*\*External scripts до inline.\*\* `<script src>` (socket.io, api.js, i18n) в `<body>`

&#x20;  ПЕРЕД inline `<script>`, от которого зависят. Никаких `defer` + wrap.

8\. \*\*`String.replace(re, str)` интерпретирует `$\&`, `$1`, `$$`.\*\* Если replacement их содержит —

&#x20;  передавай функцию: `content.replace(re, () => newStr)`.

9\. \*\*Не используй `require.resolve` из tools/.\*\* Работает от `tools/node\_modules`, не от `server/node\_modules`.

&#x20;  Проверяй `fs.existsSync(path.join(ROOT, 'server/node\_modules/<pkg>'))`.

10\. \*\*bcryptjs, не bcrypt.\*\* Всегда. `bcrypt` на Render free tier не компилируется.

11\. \*\*Anchor discover через `grep -n`.\*\* Один WARN «anchor not found» дешевле трёх push'ей вслепую.

12\. \*\*Dry-run → user confirms → apply.\*\* Не давай `--apply` без подтверждения dry-run.

13\. \*\*Не смешивай шаги.\*\* Backend → тесты → frontend. Backend → тесты → UI. Не «заодно».

14\. \*\*После каждого патча — проверки.\*\* Список в `PATTERNS.md § Validation Cheatsheet`.



\## Формат ответа



1\. \*\*Что понял\*\* — 1-2 строки

2\. \*\*Что не трогаю\*\* — файлы/функции, которые нельзя касаться

3\. \*\*Анализ\*\* — где реальная причина (не гадание, факты из grep/curl/console)

4\. \*\*План\*\* — anchor + replace + что ломается если

5\. \*\*Полный скрипт-патчер\*\* — не «замени 3 строки»

6\. \*\*Проверки\*\* — точные команды + ожидаемые числа

7\. \*\*Чек-лист «что не сломал»\*\*

8\. \*\*Что проверить после Render\*\* — конкретные UI-шаги



\## Правила безопасности



\- \*\*Секреты — не в чат.\*\* `MONGODB\_URI`, `JWT\_SECRET`, `CARD\_CVV\_SECRET`, API-ключи.

&#x20; Если утекло → \*\*немедленная ротация\*\* (Atlas / Render env / GitHub secret).

\- \*\*CVV, PAN, PIN\*\* — не хранить в БД. Детерминированный HMAC или отдельный HSM.

\- \*\*Полные реквизиты карт\*\* — только через отдельный endpoint с re-auth + rate limit + audit log.

\- \*\*`git diff --cached --stat` перед каждым push.\*\* Если в staging `.bak-\*` или лишние файлы — `git reset`.

\- \*\*`.gitignore` содержит `\*.bak-\*`.\*\* Проверять после каждого нового патчера.



\## Формат коммитов



```

<module>: <sprint> — <что>



\[опционально 1-3 строки]



Tests:

\- dry-run: N/N sections

\- post-check: ok

\- inline JS: valid

\- DOCTYPE: first line

\- Render: live

```



Примеры:

\- `bank: sprint3.4n — card reveal UI (👁 + password modal + auto-hide)`

\- `chat: sprint1.2 — message editing (edit + soft delete + realtime)`

\- `mail: sprint2.1 — attachments upload (multer + S3 + preview)`



\## Если задача непонятна



Задай \*\*1-3 уточняющих вопроса\*\*. Не гадай. Не «додумывай».

Сначала гипотеза — «я думаю ты имеешь в виду X, верно?» — потом код.



\## Что считается «готово»



\- \[ ] Dry-run показал ровно те секции, что планировались

\- \[ ] Apply — все `post-check ok`

\- \[ ] `node --check` / `new Function()` — валидно

\- \[ ] `<!DOCTYPE html>` первый (frontend)

\- \[ ] `git push` — hash есть

\- \[ ] Render — `Your service is live`, без `SyntaxError`/`Cannot find module`

\- \[ ] UI-тест — конкретные действия → ожидаемый результат

\- \[ ] Никаких «должно работать» — только «проверено, работает»



\## Ссылки

\- `PATTERNS.md` — библиотека решений с примерами из Bank

\- `HANDOFF\_TEMPLATE.md` — заполняется для конкретного модуля

\- `REFACTOR\_PLAYBOOK.md` — пошагово для нового модуля

```



\---



\## Файл 2 — `PATTERNS.md` (библиотека решений)



```markdown

\# SFERA · Паттерны решений



Каждый паттерн — реальный инцидент или удачное решение из SFERA Bank.

Копируй как есть, меняй только имена файлов/функций.



\---



\## P1. Atomic Patcher Skeleton (универсальный)



Любой патчер — это одна функция `main()`, которая делает всё или ничего.



```js

\#!/usr/bin/env node

const fs = require('fs');

const path = require('path');

const { spawnSync } = require('child\_process');



const TAG = 'SFERA-PATCH:<MODULE>-<SPRINT>';

const ROOT = path.resolve(\_\_dirname, '..');

const DRY = !process.argv.includes('--apply');

const F = { html: 'public/<module>.html', /\* ... \*/ };



function read(rel) {

&#x20; const p = path.join(ROOT, rel);

&#x20; if (!fs.existsSync(p)) return null;

&#x20; const raw = fs.readFileSync(p, 'utf8');

&#x20; const eol = raw.includes('\\r\\n') ? '\\r\\n' : '\\n';

&#x20; return { path: p, content: raw.replace(/\\r\\n/g, '\\n'), originalEol: eol };

}

function backup(p) {

&#x20; const ts = new Date().toISOString().replace(/\[:.]/g, '-');

&#x20; const bak = `${p}.bak-${ts}`;

&#x20; fs.copyFileSync(p, bak);

&#x20; return bak;

}

function validateHtml(content) {

&#x20; if (!content.startsWith('<!DOCTYPE html>')) return { ok: false, reason: 'DOCTYPE not first' };

&#x20; const o = (content.match(/<script\\b/g) || \[]).length;

&#x20; const c = (content.match(/<\\/script>/g) || \[]).length;

&#x20; if (o !== c) return { ok: false, reason: `script ${o}/${c}` };

&#x20; const m = \[...content.matchAll(/<script(?!\[^>]\*src)\[^>]\*>(\[\\s\\S]\*?)<\\/script>/g)];

&#x20; try { new Function(m.map(x => x\[1]).join('\\n;\\n')); }

&#x20; catch (e) { return { ok: false, reason: `inline JS: ${e.message}` }; }

&#x20; return { ok: true };

}

function validateJs(p) {

&#x20; const r = spawnSync(process.execPath, \['--check', p], { encoding: 'utf8' });

&#x20; return r.status === 0 ? { ok: true } : { ok: false, reason: r.stderr };

}

function writePatched(rel, content, before, kind) {

&#x20; const p = path.join(ROOT, rel);

&#x20; if (content === before) { log(`-- ${rel}: no change`); return true; }

&#x20; if (DRY) { log(`-- ${rel}: will change`); return true; }

&#x20; const bak = backup(p);

&#x20; const r = read(rel);

&#x20; const out = r.originalEol === '\\r\\n' ? content.replace(/\\n/g, '\\r\\n') : content;

&#x20; fs.writeFileSync(p, out, 'utf8');

&#x20; ok(`${rel}  <-  ${path.basename(bak)}`);

&#x20; const chk = kind === 'html' ? validateHtml(fs.readFileSync(p, 'utf8')) : validateJs(p);

&#x20; if (!chk.ok) { bad(`post-check fail: ${chk.reason} -> revert`); fs.copyFileSync(bak, p); return false; }

&#x20; ok(`post-check ok: ${rel}`);

&#x20; return true;

}



function main() {

&#x20; log(`\\n${DRY ? 'DRY' : 'APPLY'} - ${TAG} - ROOT=${ROOT}\\n`);

&#x20; // ... секции патча

}

try { main(); } catch (e) { bad(e.stack || e.message); process.exit(1); }

```



\*\*Когда использовать:\*\* любая правка существующего файла.

\*\*Когда НЕ использовать:\*\* если файл короче 50 строк и правок > 50% — лучше новый файл.



\---



\## P2. Anchor Discovery (перед патчем)



Не гадай с anchor. Один `grep -n` дешевле трёх push'ей.



```bash

\# Узнать структуру перед патчем

grep -n "function renderCards\\|function activateTab" public/bank.html

grep -n "</style>\\|</head>\\|<body>" public/bank.html

grep -n "router.get\\|router.post" server/src/routes/<module>Routes.js

grep -n "^exports\\.\\|^module.exports" server/src/controllers/<module>Controller.js

```



\*\*Правило выбора anchor:\*\*

| Anchor | Стабильность | Пример |

|---|---|---|

| `</head>`, `</body>` | 🟢 никогда не меняется | CSS/modal insertion |

| `function <name>(` | 🟢 если функция не переименована | замена тела функции |

| `module.exports = {` | 🟡 если есть | добавление функции |

| `exports.<name> = async` | 🟢 для controllers | после функции |

| `router.get('/path', handler)` | 🟡 зависит от порядка роутов | добавление роута |

| `    </style>\\n    <script src="...">` | 🔴 ломается при переносе скриптов | \*\*никогда\*\* |



\*\*Инцидент 3.4n:\*\* anchor `    </style>\\n    <script src="/socket.io/socket.io.js">` перестал работать

после 3.4k (скрипты уехали в body). Заменили на `</head>` — работает всегда.



\---



\## P3. `String.replace` + `$\&` (инцидент 2.1)



❌ Плохо — `$\&` в regex replacement интерпретируется как matched substring:



```js

const newBlock = `

&#x20; query.description = { $regex: search.replace(/\[.\*+?^$\\\\{\\\\}()|\[\\\\]\\\\\\\\]/g, '\\\\\\\\$\&') };

`;

content.replace(re, newBlock); // в файл попал matched block + '\\\\'

```



✅ Хорошо — передаём функцию:



```js

content.replace(re, () => newBlock);

```



\*\*Правило:\*\* если replacement (переменная) содержит `$`, всегда `() => str`.



\---



\## P4. CRLF-safe multi-line anchor



❌ Плохо — `includes()` с multi-line anchor провалится на Windows:



```js

if (!content.includes('function foo() {\\n  bar();\\n}')) ...

```



✅ Хорошо:



```js

function read(rel) {

&#x20; const raw = fs.readFileSync(p, 'utf8');

&#x20; return { content: raw.replace(/\\r\\n/g, '\\n'), originalEol: raw.includes('\\r\\n') ? '\\r\\n' : '\\n' };

}

// ... anchor с '\\n' работает

// при записи: content.replace(/\\n/g, originalEol)

```



\*\*Инцидент:\*\* Bank 3.4b (2016), `renderNotifications` anchor не матчился, пока не нормализовали CRLF.



\---



\## P5. `require.resolve` не видит server/node\_modules



❌ Плохо:



```js

try { require.resolve('bcrypt'); } catch { require.resolve('bcryptjs'); }

// tools/ → Downloads/node\_modules → ... → НЕ заходит в server/node\_modules

// Всегда fallback на bcrypt → runtime error

```



✅ Хорошо:



```js

const hasBcryptjs = fs.existsSync(path.join(ROOT, 'server/node\_modules/bcryptjs/package.json'));

const hasBcrypt = fs.existsSync(path.join(ROOT, 'server/node\_modules/bcrypt/package.json'));

const lib = hasBcryptjs ? 'bcryptjs' : (hasBcrypt ? 'bcrypt' : 'bcryptjs');

```



\*\*Инцидент 3.4m:\*\* скрипт выбрал `bcrypt` (не установлен), `revealCard` упал на `Cannot find module`.



\---



\## P6. `<!DOCTYPE html>` проверка (инцидент 3.4f)



Валидатор \*\*обязательно\*\*:



```js

if (!content.startsWith('<!DOCTYPE html>')) {

&#x20; return { ok: false, reason: 'DOCTYPE not first line — quirks mode' };

}

```



\*\*Инцидент 3.4f:\*\* скрипт написал `c = '// SFERA-PATCH:replace...\\n' + c`.

Комментарий попал \*\*перед\*\* `<!DOCTYPE html>`, браузер ушёл в quirks mode,

белый экран 2 сек с текстом «Сфера заменил 4...». Три дня фиксов мимо.



\*\*Что делать в патчере:\*\*



```js

// ❌ никогда

c = `// ${TAG}:note\\n` + c;



// ✅ всегда

c = c.replace(inlineStart, `// ${TAG}:note\\n${inlineStart}`);

// или

c = c.replace('</head>', `<style>/\* ${TAG} \*/</style>\\n</head>`);

```



\*\*Маркеры только внутри `<script>`, `<style>`, `<!-- -->` HTML-комментариев.\*\*



\---



\## P7. External scripts перед inline (инцидент 3.4i)



❌ Плохо — `defer` на external + wrap inline в `DOMContentLoaded`:



```html

<script src="/socket.io/socket.io.js" defer></script>

<script src="/js/api.js" defer></script>

<script>

document.addEventListener('DOMContentLoaded', () => {

&#x20; // ... inline код с polling, setInterval

});

</script>

```



\*\*Что ломалось:\*\* `setInterval(loadBankData)` и `visibilitychange` — были \*\*вне\*\* wrap.

`loadBankData is not defined` в глобальной. Плюс `initBankSocket` вне wrap → `io not loaded`.



✅ Хорошо:



```html

<body>

&#x20; <!-- разметка -->

&#x20; <script src="/socket.io/socket.io.js"></script>

&#x20; <script src="/js/api.js"></script>

&#x20; <script src="/scripts/auto\_translate\_i18n.js"></script>

&#x20; <script>

&#x20;   // inline после external — всё готово

&#x20;   initBankSocket(); // io доступен

&#x20;   loadBankData();   // api доступен

&#x20; </script>

</body>

```



\*\*Эффект:\*\* HTML рендерится мгновенно (нет блокирующих `<script>` в `<head>`), inline

выполняется после external. `qrcode.min.js` (56 KB) → lazy-load при первом использовании.



\*\*Проверка в патчере:\*\*



```js

function validateOrder(content) {

&#x20; const inline = content.indexOf('SFERA BANK — approval candidate v22');

&#x20; for (const f of \['/socket.io/socket.io.js', '/js/api.js', '/scripts/auto\_translate\_i18n.js']) {

&#x20;   const i = content.indexOf(f);

&#x20;   if (i === -1) return { ok: false, reason: `${f} missing` };

&#x20;   if (i > inline) return { ok: false, reason: `${f} after inline` };

&#x20; }

&#x20; return { ok: true };

}

```



\---



\## P8. Lazy-load тяжёлой библиотеки (qrcode 56 KB)



Вместо `<script src="/js/qrcode.min.js">` в `<head>`:



```js

// В функции, где нужна библиотека

if (typeof qrcode !== 'function') {

&#x20; if (window.\_qrLoading) return; // уже грузим

&#x20; window.\_qrLoading = true;

&#x20; var s = document.createElement('script');

&#x20; s.src = '/js/qrcode.min.js';

&#x20; s.onload = () => { window.\_qrLoading = false; renderReceive(); };

&#x20; s.onerror = () => { window.\_qrLoading = false; showToast('QR не загрузился', 'error'); };

&#x20; document.head.appendChild(s);

&#x20; return;

}

// ... qrcode() доступен

```



\*\*Эффект:\*\* Bank 3.3 → 3.4k сэкономил 56 KB на первой загрузке (\~200ms).



\---



\## P9. Error response contract (универсальный)



```js

// errorHandler.js — уже есть в SFERA

const errorHandler = (err, req, res, next) => {

&#x20; if (res.headersSent) return next(err);

&#x20; const status = err.status || 500;

&#x20; const code = err.code || 'INTERNAL\_ERROR';

&#x20; res.status(status).json({ success: false, code, message: err.message });

};

```



\*\*Стандартные коды (используй консистентно):\*\*



| status | code | Когда |

|---|---|---|

| 400 | `INVALID\_INPUT` | неверный формат |

| 400 | `INVALID\_IBAN` | Bank |

| 401 | `UNAUTHORIZED` | нет/плохой токен |

| 401 | `INVALID\_PASSWORD` | re-auth fail |

| 403 | `FORBIDDEN` | нет прав |

| 403 | `CARD\_FROZEN` | Bank |

| 404 | `NOT\_FOUND` | не найдено |

| 409 | `INSUFFICIENT\_FUNDS` | Bank |

| 429 | `RATE\_LIMIT` | слишком много запросов |

| 500 | `INTERNAL\_ERROR` | сервер |



\*\*Фронт-обработчик:\*\*



```js

function handleApiError(status, body) {

&#x20; if (status === 401) { location.href = '/login.html'; return; }

&#x20; if (status === 403) return showToast(body.message || 'Нет прав', 'error');

&#x20; if (status === 404) return showToast('Не найдено', 'error');

&#x20; if (status === 409) return showToast(body.message || 'Конфликт', 'error');

&#x20; if (status === 429) return showToast('Подождите', 'error');

&#x20; if (status === 400) return showToast(body.message || 'Проверьте данные', 'error');

&#x20; showToast('Ошибка сервера', 'error');

}

```



\*\*Инцидент 2.1:\*\* до этого 400/409/500 возвращали HTML (Express default). Фронт падал на `res.json()`.

`app.use(errorHandler)` после роутов — починило.



\---



\## P10. Real-time emit pattern (Socket.IO)



\*\*Правило:\*\* один gateway `server/src/sockets/index.js`. Комнаты = `userId` (личное) / `chatId` (групповое).



```js

// Backend — emit из controller

const io = req.app.get('io');

if (io) {

&#x20; io.to(String(recipientUserId)).emit('balance\_updated', {...});

&#x20; io.to(String(senderUserId)).emit('balance\_updated', {...});

}

```



```js

// Frontend — после DOMContentLoaded, external загружены

const socket = io({ auth: { token: getAuthToken() } });

socket.on('connect', () => console.log('WS connected'));

socket.on('balance\_updated', (payload) => {

&#x20; loadBankData({ skeleton: false });

&#x20; if (payload.direction === 'in') showToast('+' + payload.amount, 'success');

});

socket.on('disconnect', () => console.warn('WS disconnected — polling continues'));

```



\*\*Polling fallback:\*\*



```js

setInterval(() => {

&#x20; if (document.visibilityState !== 'visible') return;

&#x20; if (window.\_bankSocket?.connected) return; // WS активен — polling не нужен

&#x20; loadBankData();

}, 30000);

```



\*\*Инцидент 3.1:\*\* до этого polling каждые 30 сек. После — мгновенно через WS, polling только при disconnect.



\---



\## P11. Modal UX pattern (универсальный)



```js

function openModal(id, html) {

&#x20; var existing = document.getElementById(id);

&#x20; if (existing) existing.remove();

&#x20; var ov = document.createElement('div');

&#x20; ov.className = 'modal-overlay';

&#x20; ov.id = id;

&#x20; ov.innerHTML = '<div class="modal-box">' + html + '</div>';

&#x20; document.body.appendChild(ov);

&#x20; ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });

&#x20; return ov;

}

```



\*\*Confirm-модалка (перед опасной операцией):\*\*



```js

function confirmAction({ title, message, confirmText = 'Подтвердить' }) {

&#x20; return new Promise((resolve) => {

&#x20;   var ov = openModal('confirm-' + Date.now(),

&#x20;     `<div class="modal-title">${title}</div>` +

&#x20;     `<div class="modal-hint">${message}</div>` +

&#x20;     `<div class="modal-actions">` +

&#x20;     `<button id="cmNo" class="btn btn-outline">Отмена</button>` +

&#x20;     `<button id="cmYes" class="btn btn-primary">${confirmText}</button>` +

&#x20;     `</div>`

&#x20;   );

&#x20;   var close = (v) => { ov.remove(); resolve(v); };

&#x20;   ov.querySelector('#cmYes').onclick = () => close(true);

&#x20;   ov.querySelector('#cmNo').onclick  = () => close(false);

&#x20; });

}

```



\*\*Используется в Bank:\*\* confirm-перевод, create-card, reveal-password.



\---



\## P12. Modern toast (не banner)



❌ Плохо — banner сверху сдвигает layout:



```js

showMessage('Карта заморожена', 'success'); // ← banner в потоке документа

```



✅ Хорошо — toast правый нижний, плавающий:



```js

window.showToast = function(text, type) {

&#x20; type = type || 'success';

&#x20; let container = document.getElementById('sferaToastContainer');

&#x20; if (!container) {

&#x20;   container = document.createElement('div');

&#x20;   container.id = 'sferaToastContainer';

&#x20;   container.className = 'sfera-toast-container';

&#x20;   document.body.appendChild(container);

&#x20; }

&#x20; const toast = document.createElement('div');

&#x20; toast.className = 'sfera-toast ' + type;

&#x20; toast.innerHTML = '<div class="sfera-toast-icon">' +

&#x20;   (type === 'error' ? '✕' : type === 'info' ? 'i' : '✓') +

&#x20;   '</div><div class="sfera-toast-body">' + text + '</div>';

&#x20; container.appendChild(toast);

&#x20; setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 350); }, 2800);

};

```



CSS (уже в `bank.html`):

```css

.sfera-toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 99999; }

.sfera-toast { animation: sferaToastIn .35s cubic-bezier(.16,1,.3,1); }

```



\*\*Инцидент 3.4f → 3.4f-fix:\*\* green banner сверху → компактный toast правый нижний.



\*\*Правило:\*\* `success`/`info` — toast, `error` (критичные: 401, 403, 500) — остаётся `showMessage` (сверху).



\---



\## P13. Re-auth для чувствительных операций (card reveal)



\*\*Паттерн:\*\*



```js

// Frontend

async function revealCard(cardId) {

&#x20; var pwd = await promptPassword('Введите пароль');

&#x20; if (!pwd) return;

&#x20; var res = await fetch('/api/bank/cards/' + cardId + '/reveal', {

&#x20;   method: 'POST',

&#x20;   headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },

&#x20;   body: JSON.stringify({ password: pwd })

&#x20; });

&#x20; if (!res.ok) { /\* обработка \*/ return; }

&#x20; var data = (await res.json()).data;

&#x20; showRevealData(cardId, data); // + auto-hide 15s

}

```



\*\*Backend:\*\*



```js

exports.revealCard = async (req, res, next) => {

&#x20; // 1. Rate limit (3/5 мин per user, in-memory Map)

&#x20; const attempts = \_attempts.get(req.userId) || \[];

&#x20; if (attempts.filter(t => Date.now() - t < 5\*60\*1000).length >= 3) {

&#x20;   return res.status(429).json({ success: false, code: 'RATE\_LIMIT', message: '...' });

&#x20; }

&#x20; // 2. Verify password (bcryptjs)

&#x20; const user = await User.findById(req.userId).select('password');

&#x20; if (!await bcrypt.compare(req.body.password, user.password)) {

&#x20;   await CardReveal.create({ userId, cardId, success: false });

&#x20;   return res.status(401).json({ success: false, code: 'INVALID\_PASSWORD', message: '...' });

&#x20; }

&#x20; // 3. Load data

&#x20; const card = await Card.findOne({ \_id: cardId, userId: req.userId });

&#x20; if (!card) return res.status(404).json({ success: false, code: 'NOT\_FOUND' });

&#x20; if (card.frozen) return res.status(403).json({ success: false, code: 'CARD\_FROZEN' });

&#x20; // 4. Audit log

&#x20; await CardReveal.create({ userId, cardId, ip: req.ip, userAgent: req.get('user-agent'), success: true });

&#x20; // 5. Return

&#x20; return res.json({ success: true, data: { fullNumber: card.fullNumber, cvv: generateCvv(cardId), expiry: card.expiry } });

};

```



\*\*Auto-hide в UI:\*\*



```js

let remaining = 15;

const timer = setInterval(() => {

&#x20; remaining--;

&#x20; document.getElementById('countdown').textContent = remaining;

&#x20; document.getElementById('progress').style.width = (remaining/15\*100) + '%';

&#x20; if (remaining <= 0) { clearInterval(timer); closeModal(); }

}, 1000);

```



\*\*Применение:\*\* card reveal (Bank), 2FA confirm (все модули), delete account (Profile), export PII (Documents).



\---



\## P14. Idempotency (для финансовых операций)



\*\*Frontend:\*\*



```js

const idem = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36);

fetch('/api/bank/transfer', {

&#x20; headers: { 'Idempotency-Key': idem, ... },

&#x20; body: JSON.stringify({...})

});

```



\*\*Backend:\*\*



```js

async function transfer(userId, { idempotencyKey, ... }) {

&#x20; if (idempotencyKey) {

&#x20;   const existing = await Transaction.findOne({ userId, idempotencyKey }).lean();

&#x20;   if (existing) return { transactionId: existing.\_id, idempotent: true, ... };

&#x20; }

&#x20; // ... actual transfer

}

```



\*\*Модель — поле `idempotencyKey: { type: String, index: true, sparse: true }`.\*\*



\*\*Применение:\*\* любой POST, который меняет баланс/состояние (Bank transfer, TM Coin stake, Payment, Mail send).



\---



\## P15. Lazy backfill (migration без downtime)



❌ Плохо — миграция БД отдельным скриптом перед деплоем:



```bash

mongosh "..." --eval 'db.accounts.find({number: null}).forEach(a => { a.number = generate(); db.accounts.save(a); })'

```



✅ Хорошо — backfill при первом запросе:



```js

exports.getBalance = async (req, res, next) => {

&#x20; let accounts = await Account.find({ userId: req.userId }).lean();

&#x20; for (const acc of accounts) {

&#x20;   if (!acc.number) {

&#x20;     const newNum = generateIban();

&#x20;     await Account.updateOne({ \_id: acc.\_id }, { $set: { number: newNum } });

&#x20;     acc.number = newNum;

&#x20;   }

&#x20; }

&#x20; // ... return

};

```



\*\*Эффект:\*\* новые поля появляются постепенно, без блокировки. Схема аддитивная (`sparse: true`).



\*\*Применение:\*\* IBAN для Account (Bank 1), Notification model (Bank 2.1), CardReveal (Bank 3.4m).



\---



\## P16. Rate limit (in-memory, простой)



```js

const \_attempts = new Map();

const WINDOW = 5 \* 60 \* 1000; // 5 min

const MAX = 3;



function checkRateLimit(key) {

&#x20; const now = Date.now();

&#x20; const list = (\_attempts.get(key) || \[]).filter(t => now - t < WINDOW);

&#x20; if (list.length >= MAX) return false;

&#x20; list.push(now);

&#x20; \_attempts.set(key, list);

&#x20; // Очистка старых ключей периодически

&#x20; if (\_attempts.size > 10000) {

&#x20;   for (const \[k, v] of \_attempts) {

&#x20;     if (v.every(t => now - t > WINDOW)) \_attempts.delete(k);

&#x20;   }

&#x20; }

&#x20; return true;

}

```



\*\*Ограничение:\*\* работает только в одном процессе. Для масштабирования — Redis.



\*\*Применение:\*\* card reveal, login attempts, password reset, OTP.



\---



\## P17. URL-safe скачивание файлов (PDF/CSV export)



\*\*Backend:\*\*



```js

if (format === 'csv') {

&#x20; res.setHeader('Content-Type', 'text/csv; charset=utf-8');

&#x20; res.setHeader('Content-Disposition', 'attachment; filename="sfera-bank-' + ts + '.csv"');

&#x20; return res.send(csv);

}

const pdfBuffer = await buildPdf(transactions, opts);

res.setHeader('Content-Type', 'application/pdf');

res.setHeader('Content-Disposition', 'attachment; filename="sfera-bank-' + ts + '.pdf"');

res.setHeader('Content-Length', String(pdfBuffer.length));

return res.end(pdfBuffer);

```



\*\*Frontend:\*\*



```js

const res = await fetch('/api/bank/transactions/export?format=pdf\&...', {

&#x20; headers: { 'Authorization': 'Bearer ' + getAuthToken() }

});

const blob = await res.blob();

const cd = res.headers.get('Content-Disposition') || '';

const m = /filename="(\[^"]+)"/.exec(cd);

const filename = m ? m\[1] : ('export.' + format);

const url = URL.createObjectURL(blob);

const a = document.createElement('a');

a.href = url; a.download = filename;

document.body.appendChild(a); a.click();

setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);

```



\*\*Не использовать:\*\* `window.open('/api/...')` — не передаст `Authorization` header. Только blob + `a.download`.



\*\*Применение:\*\* Bank export, Documents export, Mail attachments, Messenger media.



\---



\## P18. Как узнать причину «медленно» / «белый экран»



\*\*Сначала числа, потом патчи.\*\*



```js

// Console на странице

var p = performance.timing;

console.log({

&#x20; DNS: p.domainLookupEnd - p.domainLookupStart,

&#x20; TCP: p.connectEnd - p.connectStart,

&#x20; TTFB: p.responseStart - p.requestStart,

&#x20; Download: p.responseEnd - p.responseStart,

&#x20; DCL: p.domContentLoadedEventEnd - p.navigationStart,

&#x20; Load: p.loadEventEnd - p.navigationStart,

&#x20; Mode: document.compatMode   // CSS1Compat vs BackCompat (quirks)

});



// Какие ресурсы тормозят

performance.getEntriesByType('resource')

&#x20; .map(r => ({ name: r.name.replace(/^.\*\\//, ''), dur: Math.round(r.duration), size: r.transferSize }))

&#x20; .sort((a, b) => b.dur - a.dur).slice(0, 10)

&#x20; .forEach(r => console.log(r.dur + 'ms | ' + (r.size/1024).toFixed(1) + 'KB | ' + r.name));

```



\*\*Расшифровка:\*\*



| TTFB | DCL | Вывод | Фикс |

|---|---|---|---|

| > 1500 | — | Сервер / Render / прокси | cron-ping / план Render |

| < 300 | > 1500 | Клиент: скрипты / CSS / inline | inline critical, lazy lib, меньше backdrop-filter |

| < 300 | < 500 | Всё быстро | Не трогать |

| — | — | \*\*`Mode: BackCompat`\*\* | \*\*quirks mode — что-то перед `<!DOCTYPE>`\*\* |



\*\*Правило:\*\* 3 фикса подряд не помогли → \*\*остановись, дай curl + Console\*\*.

Не гадай, куда копать.



\*\*Инцидент Bank:\*\* 3 фикса (defer, wrap, body) мимо. `curl TTFB 21s` (прокси),

потом Console `Mode: BackCompat` (quirks). Настоящая причина — `//` комментарий

перед `<!DOCTYPE>`. Всё это время лечили не то.



\---



\## P19. Как добавить новую модель (без миграции)



```js

// server/src/models/<Model>.js

const mongoose = require('mongoose');

const schema = new mongoose.Schema({

&#x20; userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

&#x20; field1: { type: String, required: true },

&#x20; field2: { type: Number, default: 0 },

&#x20; status: { type: String, enum: \['pending','active','closed'], default: 'pending' },

&#x20; meta:   { type: mongoose.Schema.Types.Mixed, default: {} }

}, { timestamps: true });

module.exports = mongoose.model('<Model>', schema);

```



\*\*Правила:\*\*

\- Аддитивные поля (не менять типы существующих)

\- `index: true` на поисковых полях

\- `sparse: true` для опциональных уникальных

\- `timestamps: true` — всегда

\- Миграция через lazy backfill (P15) или отдельным скриптом с бэкапом



\*\*Применение:\*\* Notification (2.1), Card (3.4a), CardReveal (3.4m).



\---



\## P20. Как добавить новый endpoint



```js

// 1. routes/<module>Routes.js

router.get('/new-path', newHandler);



// 2. controllers/<module>Controller.js

exports.newHandler = async (req, res, next) => {

&#x20; try {

&#x20;   // валидация

&#x20;   if (!req.body.x) return res.status(400).json({ success: false, code: 'INVALID\_INPUT', message: 'x required' });

&#x20;   // логика

&#x20;   const result = await SomeModel.find({ userId: req.userId });

&#x20;   // ответ

&#x20;   return res.json({ success: true, data: result });

&#x20; } catch (error) { next(error); }

};

```



\*\*Правила:\*\*

\- Всегда `{ success: true|false, data|code+message }`

\- Всегда `try/catch` + `next(error)`

\- Всегда `req.userId` (не `req.user.\_id`)

\- Валидация в controller или отдельным middleware — не в модели

\- Для POST — rate limit, для финансов — idempotency



\---



\## P21. Как добавить UI вкладку в модуль



```js

// 1. Кнопка таба

<button data-tab="new-tab" data-i18n="tab\_new">Новое</button>



// 2. Контент таба (после всех существующих tab-content)

<div class="tab-content" id="tab-new-tab">

&#x20; <!-- контент -->

</div>



// 3. В activateTab — добавить в valid + рендер

const valid = \['accounts','cards','new-tab'];

if (tab === 'new-tab' \&\& typeof renderNewTab === 'function') {

&#x20; renderNewTab();

}

```



\*\*Проверки после:\*\*

\- `grep -c "tab-new-tab"` → 2 (кнопка + контент)

\- В UI: клик по табу → показывается контент, остальные скрыты

\- URL hash `#new-tab` работает (bookmark)



\*\*Применение:\*\* Bank 3.3 (Almak tab для QR).



\---



\## Validation Cheatsheet (быстрая проверка после любого патча)



```bash

\# Backend

node --check server/src/<path>.js

grep -c "SPRINT\_TAG" server/src/<path>.js   # ожидаемое число маркеров



\# Frontend

head -1 public/<module>.html                  # должно быть <!DOCTYPE html>

grep -c "<script src=\\"/socket.io" public/<module>.html  # 1 раз, до inline

set +H

node -e "const fs=require('fs');const h=fs.readFileSync('public/<module>.html','utf8');const m=\[...h.matchAll(/<script(?!\[^>]\*src)\[^>]\*>(\[\\s\\S]\*?)<\\/script>/g)];try{new Function(m.map(x=>x\[1]).join('\\n;\\n'));console.log('inline OK')}catch(e){console.error(e.message)}"



\# Git

git --no-pager diff --cached --stat            # только ожидаемые файлы

grep -c "\\.bak-" .gitignore                    # должен быть 1



\# Render (после push)

\# В Dashboard → Logs:

\#   ✅ Маршрут подключен: /api/<module>

\#   🚀 Server running

\#   ==> Your service is live 🎉

\# Не должно быть: SyntaxError, Cannot find module

```

```



\---



\## Файл 3 — `HANDOFF\_TEMPLATE.md`



```markdown

\# SFERA · <Module> · Handoff · \[дата]



\## Текущий коммит

`git log --oneline -1` → `<hash>` · `<сообщение>`



\## Модуль

\- \*\*Frontend:\*\* `public/<module>.html` (\~N строк)

\- \*\*Backend routes:\*\* `server/src/routes/<module>Routes.js`

\- \*\*Backend controller:\*\* `server/src/controllers/<module>Controller.js`

\- \*\*Модели:\*\* `server/src/models/<Model1>.js`, `<Model2>.js`

\- \*\*Socket.IO события:\*\* `<list>` (если есть)



\## Что закрыто (не трогать)

\- Sprint X.Y: \[фича] · \[коммит]

\- Sprint X.Z: \[фича] · \[коммит]



\## Что в работе

\[текущая задача · что уже сделано · что осталось]



\## Известные проблемы

\- \[ ] \[проблема · план решения]

\- \[ ] \[TODO]



\## Файлы, которые сейчас открыты / меняются

\- `public/<module>.html` — \[что делаем]

\- `server/src/\[file].js` — \[что делаем]



\## Последний рабочий коммит (для отката)

```bash

git reset --hard <hash>

```



\## Правила

См. `SYSTEM\_PROMPT.md` — 14 железных правил, `PATTERNS.md` — библиотека решений.



\## Первое действие в новом чате

Запусти:

```bash

git log --oneline -1

git status

```

Пришли вывод — я сверю с handoff и продолжу.

```



\---



\## Файл 4 — `REFACTOR\_PLAYBOOK.md`



```markdown

\# SFERA · Как рефакторить модуль



Пошаговый процесс для любого модуля (Messenger, TM Mail, Documents, Marketplace).

Основан на опыте Bank (30+ коммитов, 4 инцидента, 3 отката).



\---



\## Шаг 0 — Разведка (30 мин, без кода)



\*\*Не начинать код, пока не собрана полная картина.\*\*



```bash

\# 1. Структура модуля

find server/src -name "\*<module>\*" -o -path "\*<module>\*" | sort

ls -la public/<module>.html



\# 2. Существующие модели

ls server/src/models/ | grep -i <module>



\# 3. Роуты

cat server/src/routes/<module>Routes.js



\# 4. Что в контроллере (полный список exports)

grep -n "^exports\\." server/src/controllers/<module>Controller.js



\# 5. Что во фронте (главные функции)

grep -n "^function \\|^        function \\|window\\.\\w\* =" public/<module>.html | head -30



\# 6. Реальные страницы

curl -o /dev/null -s -w "TTFB: %{time\_starttransfer}s | Size: %{size\_download}B\\n" https://sfera-platform-1.onrender.com/<module>.html



\# 7. Что в проде сейчас (Network в Console)

\#    — список ресурсов, время загрузки, Mode: CSS1Compat?

```



\*\*Результат шага 0:\*\* текст-карта модуля (2-3 абзаца):

\- что работает

\- что не работает / заглушки

\- где блокеры (модели нет, эндпоинт заглушка, UI-заглушка)

\- где риск (общие файлы с другими модулями)



\---



\## Шаг 1 — Список фич по приоритетам (30 мин)



Раздели на 3 группы:



| 🔴 Критично | 🟠 Важно | 🟡 Nice-to-have |

|---|---|---|

| Без этого модуль не модуль | Стандарт UX | Отличает от других |

| Пример: send message | Пример: read receipts | Пример: reactions |

| 1-2 дня | 3-5 дней | неделя+ |



\*\*Не смешивать.\*\* Critical → Important → Nice.



\*\*Формат:\*\* `\[#] Фича · Frontend | Backend | DB-model | Socket.IO | Оценка · Риск`



Пример для Messenger:

```

\[1] Send message       · FE+BE+DB               · 4ч  · low

\[2] Real-time delivery · Socket.IO              · 2ч  · low

\[3] Read receipts      · DB+Socket.IO+UI        · 3ч  · med

\[4] Attach files       · multer+S3+preview      · 6ч  · med

\[5] Edit/delete        · soft-delete+audit      · 4ч  · med

\[6] Search             · index+filter+debounce  · 3ч  · low

\[7] Reactions          · new model+UI           · 2ч  · low

\[8] Group chats        · schema+permissions     · 1-2д · high

```



\---



\## Шаг 2 — Backend first (правило: backend → тесты → frontend)



\*\*Никогда не начинай с UI.\*\* UI без backend — гадание. Backend без UI — тестируется curl'ом.



\### 2.1 Модели



```js

// server/src/models/<Model>.js

const schema = new mongoose.Schema({

&#x20; userId: { type: ObjectId, ref: 'User', required: true, index: true },

&#x20; // ... аддитивные поля

}, { timestamps: true });

```



\*\*Правила P19:\*\* аддитивные поля, `index: true`, `sparse: true` для опциональных unique, `timestamps: true`.



\### 2.2 Роуты



```js

// server/src/routes/<module>Routes.js

router.post('/<action>', validateX, handler);

```



\*\*Правила P20:\*\* `{success, data|code, message}`, `try/catch`, `req.userId`, rate limit на POST.



\### 2.3 Тесты — \*\*до UI\*\*



```js

// Console на любой странице

const r = await fetch('/api/<module>/<endpoint>', {

&#x20; method: 'POST',

&#x20; headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },

&#x20; body: JSON.stringify({...})

});

console.log(r.status, await r.json());

```



\*\*Ожидание по каждому endpoint:\*\*

\- 200 с `{success: true, data: ...}`

\- 400 при невалидных данных (код `INVALID\_\*`)

\- 401 без токена

\- 403 без прав

\- 404 не найдено

\- 409 конфликт

\- 429 при превышении rate limit



\*\*Пока все коды не проверены — фронт не начинаем.\*\*



\---



\## Шаг 3 — Frontend патчами (P1 + P2)



\### 3.1 Anchor discovery



```bash

grep -n "function <mainFunction>\\|<key-element-id>\\|</head>" public/<module>.html

```



\### 3.2 Патчер — одна секция = одна фича



Скелет P1. Для каждой фичи:



```js

log('-- <фича> --');

patch<Feature>();

```



\### 3.3 Dry-run → сверка → apply



```bash

node tools/<module>-sprint<N>.js          # dry

\# пришли вывод

node tools/<module>-sprint<N>.js --apply  # после подтверждения

```



\### 3.4 Проверки после apply



```bash

head -1 public/<module>.html              # <!DOCTYPE>

grep -c "<TAG>" public/<module>.html      # ожидаемое число

node -e "...new Function..."              # inline JS валиден

git --no-pager diff --stat                # только ожидаемые файлы

```



\### 3.5 UI-тест — конкретные действия



Не «открой и посмотри». А:

\- Клик X → должен появиться Y

\- Ввод Z → должен вернуть W

\- Через N сек — автоскрытие

\- Неверный ввод — ошибка E



\---



\## Шаг 4 — Что делать если фикс не сработал



\*\*Правило трёх фиксов.\*\* Если 3 патча подряд не решили проблему:

1\. \*\*Остановись.\*\* Не давай 4-й.

2\. \*\*Дай curl + Console performance.timing\*\* (P18).

3\. \*\*По числам\*\* — точный диагноз. Не «наверное, скрипты тормозят».

4\. \*\*Напиши, что реальная причина\*\* в handoff.



\*\*Инцидент Bank:\*\* 3 фикса белого экрана мимо. Числа показали quirks mode.

Настоящая причина — `//` перед `<!DOCTYPE>`. Потрачено 3 дня.



\---



\## Шаг 5 — Hardening (после фичи)



После каждой закрытой фичи:



```bash

\# 1. npm audit (раз в неделю)

npm audit

npm audit fix              # без --force

git diff server/package-lock.json   # проверить, что не сломалось

\# если ломается — git checkout server/package-lock.json



\# 2. Render log — нет ли ошибок

\# 3. Backend — все endpoints отвечают как ожидалось

\# 4. Frontend — все вкладки работают

```



\---



\## Шаг 6 — Ротация секретов (раз в месяц или при инциденте)



```bash

\# MONGODB\_URI

1\. Atlas → Database Access → Edit Password → Autogenerate → Update

2\. Render → Environment → MONGODB\_URI → Save

3\. Проверить: curl /api/health → 200



\# JWT\_SECRET

1\. Render → Environment → JWT\_SECRET → новое значение

2\. При деплое все старые токены станут невалидны

3\. Все юзеры должны перелогиниться

```



\---



\## Чек-лист «модуль готов к продакшену»



\*\*Backend:\*\*

\- \[ ] Все endpoints возвращают `{success, data|code, message}`

\- \[ ] 401/403/404/409/429 обрабатываются фронтом по-разному

\- \[ ] POST endpoints имеют rate limit / idempotency (для финансов — обязательно)

\- \[ ] Чувствительные операции (reveal, export PII) требуют re-auth + audit log

\- \[ ] `node --check` на всех изменённых `.js` — пусто

\- \[ ] `npm audit` — нет critical



\*\*Frontend:\*\*

\- \[ ] `<!DOCTYPE html>` первая строка

\- \[ ] External scripts до inline

\- \[ ] `new Function(code)` для inline JS — валидно

\- \[ ] `document.compatMode === 'CSS1Compat'`

\- \[ ] Все модалки закрываются по Escape / клику по фону

\- \[ ] Auto-hide для чувствительных данных (CVV, PII) — 15 сек

\- \[ ] Toast для success/info, banner только для критичных error



\*\*Real-time:\*\*

\- \[ ] Socket.IO подключён после `DOMContentLoaded` + external

\- \[ ] Fallback polling при `disconnect`

\- \[ ] `io.to(userId)` для личных событий, `io.to(chatId)` для групповых

\- \[ ] Нет дублирования polling + WS одновременно



\*\*Безопасность:\*\*

\- \[ ] Секреты только в env / Render

\- \[ ] Полные PAN / CVV / PII — не в `getList`, только через re-auth

\- \[ ] Rate limit на все POST

\- \[ ] Audit log для критичных операций



\*\*Производительность:\*\*

\- \[ ] TTFB < 500ms (cron-ping на Render)

\- \[ ] DCL < 1500ms

\- \[ ] Lazy-load для тяжёлых библиотек (> 30 KB)

\- \[ ] Никаких блокирующих `<script>` в `<head>`

```



\---



\## Итог: что меняется при переходе на новый модуль



| Что | Bank | Messenger / Mail / другой |

|---|---|---|

| `SYSTEM\_PROMPT.md` | тот же | \*\*тот же\*\* |

| `PATTERNS.md` | тот же | \*\*тот же\*\* (P1-P21 универсальны) |

| `HANDOFF\_TEMPLATE.md` | заполнить под Bank | \*\*заполнить под Messenger\*\* |

| `REFACTOR\_PLAYBOOK.md` | тот же | \*\*тот же\*\* |

| File paths | `public/bank.html`, `server/src/\*/bank\*` | заменить `bank` на `chat` / `mail` |

| Модели | `Account, Card, ...` | новые модели (Message, Thread, Attachment) |

| Socket.IO события | `balance\_updated`, `bank\_notification` | `new\_message`, `message\_edited`, `read\_receipt` |



\*\*Технически:\*\* новый чат открывается с `SYSTEM\_PROMPT.md` + `PATTERNS.md` + `HANDOFF` под конкретный модуль. Дальше — по `REFACTOR\_PLAYBOOK.md`.



\*\*Практически:\*\* когда начинаешь Messenger, открой новый чат и первое сообщение:



```

Ты — Senior Full-Stack Architect SFERA.

\[SYSTEM\_PROMPT.md]

\[PATTERNS.md]

\[HANDOFF\_TEMPLATE.md] — заполненный под Messenger:



Модуль: Messenger

Текущий коммит: <hash>

Frontend: public/messenger.html

Backend: server/src/routes/chatRoutes.js

Модели: Message.js, Thread.js

Что в работе: send message + realtime delivery

Задача: \[конкретная]

```



Новый агент прочитает, поймёт контекст, продолжит по playbook. \*\*Не будет трёх дней лечить не ту болезнь\*\* — потому что все инциденты и их причины уже записаны в `PATTERNS.md`.

