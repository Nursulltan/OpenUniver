// Клиент к univer.kaznu.kz: вход, запросы с куки, разбор HTML.
// Работает локально, ничего не отправляет никуда, кроме самого сайта.
import * as cheerio from 'cheerio';
import { MobileApi, ApiError, mapSchedule, mapUmkd, mapUmkdFull, mapExams } from './mobile-api.mjs';

const BASE = 'https://univer.kaznu.kz';
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36';
const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function parseServiceCatalog(html) {
  const $ = cheerio.load(html);
  return $('tr.link').toArray().flatMap(row => {
    const title = clean($(row).find('td').eq(1).text());
    const raw = $(row).find('a[href]').first().attr('href');
    if (!raw || !title) return [];
    let url;
    try { url = new URL(raw, BASE); } catch { return []; }
    if (url.origin !== BASE || url.username || url.password) return [];
    const form = url.pathname === '/ssc/StatementPage' && /^\d+$/.test(url.searchParams.get('serviceId') || '') && url.searchParams.get('stepId') === '1';
    const info = ['/student/fail/', '/student/payinfo/'].includes(url.pathname) && !url.search;
    if (!form && !info) return [];
    return [{ id: form ? url.searchParams.get('serviceId') : url.pathname, title, href: url.pathname + url.search, kind: form ? 'application' : 'information' }];
  });
}

export function parseStatements(html) {
  const $ = cheerio.load(html);
  return $('tr.link').toArray().flatMap(tr => {
    const statementId = $(tr).attr('id');
    if (!/^\d+$/.test(statementId || '')) return [];
    const c = $(tr).find('td').toArray().map(td => clean($(td).text()));
    if (c.length < 8) return [];
    return [{ id: c[1], statementId, service: c[5], date: c[6], status: c[7], href: '/ssc/StatementPage?statementId=' + statementId }];
  });
}

export class UniverError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Шифр со страницы входа (_lt4mwi): сдвиг каждого символа на позицию символа ключа.
function encode(text, key) {
  let k = key;
  while (k.length < text.length) k += k;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ci = ALPHA.indexOf(text[i]);
    out += ci > -1 ? ALPHA[(ALPHA.indexOf(k[i]) + ci) % ALPHA.length] : text[i];
  }
  return out;
}


// Поля формы входа в том же порядке, как их собирает скрипт страницы.
export function buildLoginFields(page, key, login, password) {
  const $ = cheerio.load(page);
  const loginId = $('#login_frm input[type=text]').attr('id');
  const passId = $('#login_frm input[type=password]').attr('id');
  const fields = [];
  const re = /\$\(["']<input\/>["'],\s*\{\s*type:\s*["'](\w+)["']\s*\}\)[^;]*;\s*(\w+)\.attr\("name",\s*'([^']*)'\);\s*\2\.attr\("value",\s*([^;]*)\);/g;
  let m;
  while ((m = re.exec(page))) {
    const [, , , name, expr] = m;
    let value;
    if (expr.includes(`#${loginId}`)) value = encode(login, key);
    else if (expr.includes(`#${passId}`)) value = encode(password, key);
    else value = expr.trim().replace(/^'|'$/g, '');
    fields.push([name, value]);
  }
  if (fields.length < 3) throw new UniverError('layout', 'Не удалось разобрать форму входа: сайт изменился');
  return fields;
}

// атрибуты узла, следующий соседний узел (вместе с текстом) и проверка тега
const at = (el) => el.attribs ?? Object.fromEntries([...(el.attributes ?? [])].map((a) => [a.name, a.value]));
const sib = (n) => (n.nextSibling !== undefined ? n.nextSibling : n.next) ?? null;
const tagIs = (n, name) => (n.type === 'tag' || n.nodeType === 1) && String(n.name ?? n.tagName ?? '').toLowerCase() === name;
const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

export class Univer {
  // transport: свой способ слать запросы (в Android-приложении — нативный HTTP с куками системы).
  // Без него — fetch из Node и собственная банка куки.
  constructor({ transport, clearCookies } = {}) {
    this.jar = {};
    this.creds = null; // только в памяти
    this.loggedIn = false;
    this._gen = 0; // номер текущей сессии на сайте (растёт после каждого входа)
    this._loginP = null; // идущий сейчас повторный вход — один на все запросы
    this._pages = new Map(); // скачанные страницы: путь -> { at, pending, p }
    this.transport = transport;
    this.clearCookies = clearCookies;
    this.mobile = new MobileApi({ transport, credentials: () => this.creds, language: () => this.lang || 'ru' });
    this._apiBackoff = new Map();
    this.dataSources = {};
  }

  // An unavailable/changed API must not remove an existing screen. Retry it after a minute.
  async _preferApi(key, read, fallback) {
    if (this.creds && Date.now() >= (this._apiBackoff.get(key) || 0)) {
      try {
        const value = await read();
        this.dataSources[key] = 'api';
        return value;
      } catch (e) {
        if (e.code === 'cancelled') throw new UniverError('not_logged_in', 'Сессия изменена');
        this._apiBackoff.set(key, Date.now() + 60000);
      }
    }
    this.dataSources[key] = 'html';
    return fallback();
  }

  _cookies() { return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; '); }
  _store(res) {
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      this.jar[kv.slice(0, i)] = kv.slice(i + 1);
    }
  }

  async _fetch(path, opts = {}) {
    let url = path.startsWith('http') ? path : BASE + path;
    if (this.transport) return this.transport(url, { ...opts, headers: { 'user-agent': UA, ...opts.headers } });
    let method = opts.method ?? 'GET';
    let body = opts.body;
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(url, {
        method, body, redirect: 'manual',
        headers: {
          'user-agent': UA, cookie: this._cookies(),
          ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
          ...opts.headers,
        },
      });
      this._store(res);
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        url = new URL(res.headers.get('location'), url).href;
        method = 'GET'; body = undefined;
        continue;
      }
      res.finalUrl = url;
      return res;
    }
    throw new UniverError('network', 'Слишком много перенаправлений');
  }

  async login(login, password) {
    if (login !== this.creds?.login || password !== this.creds?.password) {
      this.mobile.reset(); this._apiBackoff.clear(); this.forget();
    }
    this.jar = {};
    await this.clearCookies?.();
    this.loggedIn = false;
    const page = await (await this._fetch('/user/login?ReturnUrl=%2f')).text();
    const keyPath = page.match(/\/user\/key\/\d+\//)?.[0];
    if (!keyPath) throw new UniverError('layout', 'Не нашёл ключ шифрования на странице входа: сайт изменился');
    // Сайт отдаёт ключ JSON-строкой ("abc..."); некоторые HTTP-клиенты уже снимают кавычки сами.
    const rawKey = (await (await this._fetch(keyPath, { method: 'POST' })).text()).trim();
    let key = rawKey;
    try { key = JSON.parse(rawKey); } catch { /* уже без кавычек */ }
    if (typeof key !== 'string' || !/^[0-9a-zA-Z]+$/.test(key)) throw new UniverError('layout', 'Сайт вернул неожиданный ключ входа');

    const fields = buildLoginFields(page, key, login, password);
    // Как при отправке формы браузером: без кнопки submit, но с Referer и Origin (без них сайт падает с ошибкой).
    const body = new URLSearchParams(fields.filter(([name]) => name !== key)).toString();
    await this._fetch('/user/login/', { method: 'POST', body, headers: { referer: BASE + '/user/login?ReturnUrl=%2f', origin: BASE } });
    const check = await (await this._fetch('/student/bachelor/')).text();
    if (!/\/user\/logout/.test(check)) {
      throw new UniverError('bad_credentials', 'Неверный логин или пароль');
    }
    this.creds = { login, password };
    this.loggedIn = true;
    this._gen++;
    if (this.lang) await this._fetch(`/lang/change/${this.lang}/`);
  }

  // Повторный вход, когда сайт забыл сессию (телефон долго держал приложение свёрнутым).
  // Несколько запросов одновременно увидят страницу входа — входим один раз, остальные ждут.
  // Если кто-то уже вошёл заново после начала нашего запроса — просто повторяем запрос.
  async _relogin(gen) {
    if (!this.creds) throw new UniverError('session_expired', 'Сессия истекла, войдите снова');
    if (this._gen !== gen && !this._loginP) return;
    this._loginP ??= this.login(this.creds.login, this.creds.password)
      .catch((e) => {
        // неверный пароль (сменили на сайте) — только тогда просим войти заново
        if (e.code === 'bad_credentials') throw new UniverError('session_expired', 'Пароль не подходит — войдите снова');
        throw e;
      })
      .finally(() => { this._loginP = null; });
    await this._loginP;
  }

  // Страница с повторным входом, если сессия истекла.
  async html(path, maxAge = this._ttl(path)) {
    const key = (this.lang || '') + path;
    const c = this._pages.get(key);
    if (c && (c.pending || Date.now() - c.at < maxAge)) return c.p;
    const entry = { at: Date.now(), pending: true };
    entry.p = this._html(path).then(
      (text) => { entry.pending = false; entry.at = Date.now(); return text; },
      (e) => { if (this._pages.get(key) === entry) this._pages.delete(key); throw e; },
    );
    this._pages.set(key, entry);
    return entry.p;
  }
  _ttl(path) { return /^\/student\/(attestation\/?|attendance\/full\/?)$/.test(path) ? 3000 : 60000; }
  // забыть скачанные страницы (обновление свайпом, отправка анкеты, выход)
  forget() { this._pages.clear(); this.mobile.forget(); this._apiBackoff.clear(); this._max = {}; }

  async _html(path) {
    if (!this.loggedIn && !this.creds) throw new UniverError('not_logged_in', 'Сначала войдите');
    for (let attempt = 0; attempt < 3; attempt++) {
      if (this._loginP) await this._loginP.catch(() => {}); // идёт повторный вход — дождёмся его
      const gen = this._gen;
      const res = await this._fetch(path);
      if (!res.ok) throw new UniverError('network', `Сайт ответил ${res.status}`);
      const text = await res.text();
      if (/id="login_frm"/.test(text) && !/\/user\/logout/.test(text)) {
        if (attempt < 2) { await this._relogin(gen); continue; }
        throw new UniverError('session_expired', 'Сессия истекла');
      }
      return text;
    }
  }

  logout() { this.jar = {}; this.creds = null; this.loggedIn = false; this.forget(); this.mobile.reset(); this.dataSources = {}; }

  // Куки сессии (без пароля) — чтобы перезапуск тестового сервера не выкидывал из аккаунта.
  exportSession() { return { jar: this.jar, loggedIn: this.loggedIn, lang: this.lang }; }
  importSession(s) { this.jar = s?.jar ?? {}; this.loggedIn = !!s?.loggedIn; this.lang = s?.lang ?? null; }

  // Язык данных на сайте (предметы, расписание): kz, ru, en. Сайт хранит его в сессии.
  async setLang(lang) {
    if (!['kz', 'ru', 'en'].includes(lang)) throw new UniverError('input', 'Неизвестный язык');
    this.lang = lang;
    if (this.loggedIn) await this._fetch(`/lang/change/${lang}/`);
  }

  // Блоки «Ошибки» со страницы (например, «пройдите анкетирование»).
  _warnings($) {
    const out = [];
    $('table.mt').each((_, t) => {
      const head = clean($(t).find('tr.top .ct').first().text());
      if (/^(Ошибк|Қате|Error)/i.test(head)) {
        const text = clean($(t).find('tr.mid').text());
        if (text) out.push(text);
      }
    });
    return out;
  }

  async profile() {
    return this._preferApi('profile', async () => {
      // API's attestation GPA is semester GPA, not cumulative GPA. Keep the authoritative HTML header.
      const [data, att] = await Promise.all([this.mobile.get('student/profile/', {}, 300000), this.html('/student/attestation/')]);
      if (!Array.isArray(data?.[0]) || !data[0].some(row => row.student)) throw new ApiError('schema');
      const fields = Object.assign({}, ...data[0]);
      if (!Object.hasOwn(fields, 'speciality') || !Object.hasOwn(fields, 'faculty')) throw new ApiError('schema');
      const value = k => clean(String(fields[k] ?? '').replace(/^[^:]*:\s*/, ''));
      const $ = cheerio.load(att), text = $('body').text();
      const who = clean($('a[href="/user/pass/"]').first().text());
      return { name: who.replace(/\s*\(.*\)\s*$/, '') || clean(fields.student), login: this.creds?.login || '',
        course: value('course_num'), specialty: value('speciality'), faculty: value('faculty'),
        gpa: text.match(/(?:Общий|Жалпы|Total|Overall|General|Cumulative)\s*GPA\s*=\s*([\d.,]+)/i)?.[1] ?? '',
        yearStart: Number(text.match(/(\d{4})-\d{4}/)?.[1] ?? new Date().getFullYear()), warnings: this._warnings($) };
    }, () => this._profileHtml());
  }

  async _profileHtml() {
    const [att, plan] = await Promise.all([this.html('/student/attestation/'), this.html('/student/educplan/')]);
    const $ = cheerio.load(att);
    const $p = cheerio.load(plan);
    const who = clean($('a[href="/user/pass/"]').first().text());
    // пары «Название: значение» из шапки учебного плана (table.xp)
    const pairs = {};
    $p('table.xp tr').each((_, tr) => {
      const c = $p(tr).find('td').toArray().map((td) => clean($p(td).text()));
      for (let i = 0; i + 1 < c.length; i += 2) if (c[i]) pairs[c[i].replace(/:$/, '')] = c[i + 1];
    });
    const pick = (re) => Object.entries(pairs).find(([k]) => re.test(k))?.[1] ?? '';
    const text = $('body').text();
    return {
      name: who.replace(/\s*\(.*\)\s*$/, ''),
      login: who.match(/\(([^:)]+)/)?.[1]?.trim() ?? '',
      // «(3 Курс, 5 Семестр)» / «(3 Course, 5 Semester)» в заголовке аттестации
      course: text.match(/\((\d)\s+[^\d,()]+,\s*\d+\s+[^\d()]+\)/)?.[1] ?? '',
      specialty: pick(/Специальност|Мамандығ|Мамандық|бағдарлама|программа|Speciality|Specialty|program/i),
      faculty: pick(/Факультет|Faculty/i),
      gpa: text.match(/(?:Общий|Жалпы|Total|Overall|General|Cumulative)\s*GPA\s*=\s*([\d.,]+)/i)?.[1] ?? '',
      yearStart: Number(text.match(/(\d{4})-\d{4}/)?.[1] ?? new Date().getFullYear()),
      warnings: this._warnings($),
    };
  }

  async schedule() {
    return this._preferApi('schedule', async () => {
      // Three requests at a time; avoid flooding the university server with all six days.
      const week = [];
      for (let start = 1; start <= 6; start += 3) {
        week.push(...await Promise.all([start,start+1,start+2].map(day => this.mobile.get('student/schedule/', { day: String(day) }, 300000))));
      }
      return mapSchedule(week, this.lang || 'ru');
    }, () => this._scheduleHtml());
  }

  async _scheduleHtml() {
    const $ = cheerio.load(await this.html('/student/myschedule/'));
    const table = $('table.schedule').first();
    if (!table.length) throw new UniverError('layout', 'Таблица расписания не найдена');
    const rows = table.find('tr').toArray();
    const days = $(rows[0]).find('th').slice(1).toArray().map((th) => clean($(th).text()));
    const busy = {}; // ячейки, занятые rowspan сверху
    const lessons = [];
    rows.slice(1).forEach((tr, r) => {
      const time = clean($(tr).find('td.time div').first().text());
      let col = 0;
      $(tr).children('td').not('.time').each((_, td) => {
        while (busy[`${r}:${col}`]) col++;
        const span = parseInt($(td).attr('rowspan') ?? '1', 10);
        for (let s = 1; s < span; s++) busy[`${r + s}:${col}`] = true;
        $(td).find('.groups > div').each((_, g) => {
          const ps = $(g).find('p.teacher').toArray().map((p) => clean($(p).text()));
          if (!ps[0]) return;
          const { name, kind } = splitKind(ps[0]);
          const params = $(g).find('p.params').first();
          const room = params.find('span').not('.aud_faculty').toArray().map((s) => clean($(s).text())).join(' ');
          lessons.push({
            weekday: col + 1, day: days[col], time, slots: span,
            subject: name, kind, teacher: ps[1] ?? '',
            room: room.replace(/^[^:]*:\s*/, ''),
            building: clean(params.find('.aud_faculty').text()),
            period: clean($(g).find('.dateStartLbl').text()),
          });
        });
        col++;
      });
    });
    return { days, lessons };
  }

  async exams() {
    return this._preferApi('exams', async () => mapExams(await this.mobile.get('student/examSchedule/'), this.lang || 'ru'), () => this._examsHtml());
  }

  async _examsHtml() {
    const $ = cheerio.load(await this.html('/student/myexam/schedule/'));
    const items = [];
    leaf($, 'table.inner').each((_, t) => {
      const head = $(t).find('tr').first().find('th').toArray().map((c) => clean($(c).text()));
      if (head.length < 4) return;
      $(t).find('tr').slice(1).each((_, tr) => {
        const cells = $(tr).find('td').toArray().map((c) => clean($(c).text()));
        if (cells.length >= head.length - 1 && cells.some(Boolean)) items.push(Object.fromEntries(head.map((h, i) => [h || `#${i}`, cells[i] ?? ''])));
      });
    });
    return { items, warnings: this._warnings($) };
  }

  // Оценки: итог из «Аттестации» + отметки по датам из журнала.
  async grades() {
    // Verified API attestation can report RK2=0 while the live HTML journal has current marks.
    // Keep the complete journal (task hints, syllabus group IDs and authoritative RK totals).
    const [att, jr, prof] = await Promise.all([this.html('/student/attestation/'), this.journal(), this.profile()]);
    const $ = cheerio.load(att);
    const subjects = [];
    leaf($, 'table.inner').each((_, t) => {
      const rows = $(t).find('tr').toArray();
      if (!rows.length || $(rows[0]).find('th, td').length < 8) return;
      for (const tr of rows.slice(1)) {
        const c = $(tr).find('td').toArray().map((td) => clean($(td).text()));
        if (c.length < 8 || !c[0]) continue;
        subjects.push({ name: c[0], credits: c[1], rk1: c[2], rk2: c[3], exam: c[4], total: c[5], gpa: c[6], letter: c[7], mark: c[8] ?? '' });
      }
    });
    const norm = (s) => s.toLowerCase().replace(/[^\p{L}\d]/gu, '');
    const absences = (parts) => parts.flatMap((p) => p.blocks.flatMap((b) => b.entries)).filter((e) => isAbsent(e.value)).length;
    for (const s of subjects) {
      const j = jr.subjects.find((x) => norm(x.name) === norm(s.name));
      s.parts = j?.parts ?? [];
      s.period = j?.period ?? '';
      s.absences = absences(s.parts);
      for (const rk of [1, 2]) if (j?.rk?.[rk] !== undefined) s['rk' + rk] = j.rk[rk];
    }
    for (const j of jr.subjects) {
      if (!subjects.some((s) => norm(s.name) === norm(j.name))) {
        subjects.push({ name: j.name, rk1: j.rk?.[1] ?? '', rk2: j.rk?.[2] ?? '', parts: j.parts, period: j.period, absences: absences(j.parts) });
      }
    }
    return { gpa: prof.gpa, yearStart: prof.yearStart, subjects, warnings: [...new Set([...this._warnings($), ...jr.warnings])] };
  }

  async journal(maxAge) {
    const $ = cheerio.load(await this.html('/student/attendance/full/', maxAge));
    const warnings = this._warnings($);
    const subjects = [];
    const mt = $('table.mt').toArray().find((t) => $(t).find('tr.top').length > 1 && $(t).find('table.inner th[rowspan]').length);
    if (mt) {
      let subject = null, part = null;
      $(mt).children('tbody').children('tr').each((i, tr) => {
        const row = $(tr);
        if (row.hasClass('top')) {
          subject = null; part = null;
          if (i === 0) return; // заголовок «Журнал…»
          const title = clean(row.text());
          const m = title.match(/^(.*?)\s*\((.*)\)\s*(\d\d\.\d\d\.\d{4}\s*-\s*\d\d\.\d\d\.\d{4})?$/);
          subject = { name: m ? m[1] : title, formula: m?.[2] ?? '', period: m?.[3] ?? '', parts: [] };
          subjects.push(subject);
          return;
        }
        if (!subject) return;
        const blocks = row.find('table.inner').toArray().filter((t) => $(t).find('th[rowspan]').length);
        if (blocks.length) {
          if (!part) { part = { kind: '', teacher: '', blocks: [] }; subject.parts.push(part); }
          for (const t of blocks) {
            const trs = $(t).find('tr').toArray();
            const heads = $(trs[0]).find('th').toArray();
            const title = clean($(heads[0]).text()).replace(/\s*\(\d+\)\s*$/, '');
            const dates = heads.slice(1).map((h) => clean($(h).text()));
            const vals = $(trs[1]).find('td').toArray();
            const entries = [];
            let total = '';
            dates.forEach((d, k) => {
              const v = vals[k];
              if (/^\d\d\.\d\d$/.test(d)) entries.push({ date: d, value: clean($(v).text()), hint: $(v).attr('title') ?? '' });
              else if (d) total = clean($(v).text());
            });
            part.blocks.push({ rk: Number(title.match(/\d/)?.[0] ?? 0), title, entries, total });
          }
          return;
        }
        const text = clean(row.text());
        if (/\(\d+\)\s*:/.test(text)) {
          // итог сайта: «РК1 (100): 55 РК2 (100): 8» (на любом языке)
          subject.rk = {};
          for (const m of text.matchAll(/(\d)\s*\(\d+\)\s*:\s*([\d.,]+)/g)) subject.rk[m[1]] = m[2];
          return;
        }
        if (!text) return;
        if (/ - /.test(text)) {
          const i2 = text.indexOf(' - ');
          part = { kind: text.slice(0, i2), teacher: clean(text.slice(i2 + 3).replace(/\(.*$/, '')), group: row.find('.syllabus-info').attr('data-group') ?? '', blocks: [] };
          subject.parts.push(part);
        } else if (part) part.empty = true;
      });
    }
    return { subjects, warnings };
  }

  // Анкета студента: пары «Поле: значение» из таблиц профиля + фото.
  async studentCard() {
    const $ = cheerio.load(await this.html('/student/profile/'));
    const sections = [];
    leaf($, 'table.inner, table.inner2').each((_, t) => {
      const rows = $(t).find('tr').toArray().map((tr) => $(tr).find('th, td').toArray().map((c) => clean($(c).text())));
      if (rows.some((r) => r.some((c) => /\(.*:\s*\d+\)/.test(c)))) return; // шапка с ФИО
      const pairs = [];
      for (const r of rows) {
        for (let i = 0; i < r.length; i++) {
          if (/:\s*$/.test(r[i]) && r[i].length < 90) { if (r[i + 1]) pairs.push([r[i].replace(/\s*:\s*$/, ''), r[i + 1]]); i++; }
        }
      }
      if (pairs.length) { sections.push({ pairs }); return; }
      const head = rows[0] || [];
      const body = rows.slice(1).filter((r) => r.some(Boolean));
      if (head.length >= 2 && body.length) sections.push({ head, rows: body });
    });
    let photo = '';
    const src = $('img[src*="photostudent"]').attr('src');
    if (src) {
      try {
        const r = await this._fetch(src, { binary: true });
        const b64 = r.base64 ? await r.base64() : Buffer.from(await r.arrayBuffer()).toString('base64');
        if (b64) photo = 'data:image/jpeg;base64,' + b64;
      } catch { /* без фото */ }
    }
    return { sections, photo };
  }

  // Учебная неделя из академического календаря: период, в который попадает сегодня.
  async academicWeek() {
    const $ = cheerio.load(await this.html('/student/academcalendar/'));
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const toDate = (x) => { const [d, m, y] = x.split('.').map(Number); return new Date(y, m - 1, d); };
    let best = null;
    leaf($, 'table').each((_, t) => {
      const r = $(t).find('tr').eq(1).find('td').toArray().map((c) => clean($(c).text()));
      const dates = r.filter((x) => /^\d\d\.\d\d\.\d{4}$/.test(x));
      if (dates.length < 2) return;
      const from = toDate(dates[0]), to = toDate(dates[1]);
      if (now < from || now > to) return;
      if (!best || from > best.from) best = { from, to, t, total: Number(r.find((x) => /^\d+$/.test(x))) || 0 };
    });
    if (!best) return { week: 0, total: 0, rk: 0 };
    const monday = new Date(best.from); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    // текущая рубежка: после окончания «Рубежный контроль 1 (100)» / «Аралық бақылау 1 (100)» идёт РК2
    let rk = 0;
    $(best.t).find('tr').each((_, tr) => {
      const c = $(tr).find('td').toArray().map((x) => clean($(x).text()));
      const d = c.filter((x) => /^\d\d\.\d\d\.\d{4}$/.test(x));
      if (/\D1\s*\(\d+\)$/.test(c[0] || '') && d.length >= 2) rk = now > toDate(d[1]) ? 2 : 1;
    });
    return { week: Math.floor((now - monday) / (7 * 864e5)) + 1, total: best.total, rk };
  }

  async maxPoints() {
    const jr = await this.journal();
    const groups = [...new Set(jr.subjects.flatMap((x) => x.parts.map((p) => p.group)).filter((g) => /^\d+$/.test(g)))];
    const maxes = this._max ??= {};
    await Promise.all(groups.filter((g) => !maxes[g]).map(async (g) => {
      try {
        const res = await this._fetch(`/student/interactive/syllabus/bind/ajax/${g}/`, { method: 'POST', body: '', headers: { 'x-requested-with': 'XMLHttpRequest' } });
        const j = JSON.parse(await res.text());
        const $ = cheerio.load(j.obj || '');
        const map = {};
        $('table.full-width td > div').each((_, box) => {
          const cols = $(box).children('div').toArray();
          if (cols.length < 3) return;
          const name = clean($(cols[0]).children('div').last().text());
          const max = clean($(cols[2]).text()); // 1 — задание, 2 — тема, 3 — макс. балл (дальше может быть рубрикатор)
          if (!name || !/^\d+([.,]\d+)?$/.test(max)) return;
          map[keyName(name)] = Number(max.replace(',', '.'));
          // запасной вариант — по номеру задания, только если номер однозначен
          const n = name.match(/(\d+)\s*$/)?.[1];
          if (n) map['#' + n] = map['#' + n] === undefined || map['#' + n] === map[keyName(name)] ? map[keyName(name)] : null;
        });
        maxes[g] = map;
      } catch { /* силлабус не заполнен */ }
    }));
    return Object.fromEntries(groups.map((g) => [g, maxes[g] || {}]));
  }

  async umkdSubjects() {
    return this._preferApi('umkd', async () => {
      const [rows, semester] = await Promise.all([this.mobile.get('student/umkd2/'), this.mobile.get('student/semesterInfo/', {}, 300000)]);
      return mapUmkd(rows, semester);
    }, () => this._umkdSubjectsHtml());
  }

  async _umkdSubjectsHtml() {
    const html = await this.html('/student/umkd/');
    const $ = cheerio.load(html);
    const ctx = html.match(/\/student\/umkd\/"\s*\+\s*this\.id\s*\+\s*"\/(\d{4})\/(\d)"/);
    const items = $('tr.link').toArray().map((tr) => {
      const tds = $(tr).find('td').toArray().map((c) => clean($(c).text())).filter(Boolean);
      return { id: at(tr).id, title: tds[0] ?? '', kind: tds[1] ?? '' };
    }).filter((x) => x.id && x.title);
    return { year: ctx?.[1] ?? '', term: ctx?.[2] ?? '', items, warnings: this._warnings($) };
  }

  async umkdFolder(id, year, term) {
    if (!/^\d+$/.test(id) || !/^\d{4}$/.test(year) || !/^\d$/.test(term)) throw new UniverError('input', 'Неверные параметры');
    // папка предмета — через мобильный API (один запрос вместо страницы сайта); вложенные папки сайта — по-старому
    if (this._umkdSubfolders?.has(id)) return this._umkdFolderHtml(id, year, term);
    return this._preferApi('umkdFolder', async () => mapUmkdFull(
      await this.mobile.get('student/umkdFull/', { subjectId: id, year, semester: term }), id, year, term, categoryGroup,
    ), () => this._umkdFolderHtml(id, year, term));
  }

  async _umkdFolderHtml(id, year, term) {
    if (!/^\d+$/.test(id) || !/^\d{4}$/.test(year) || !/^\d$/.test(term)) throw new UniverError('input', 'Неверные параметры');
    const $ = cheerio.load(await this.html(`/student/umkd/${id}/${year}/${term}`));
    const entries = [];
    const table = $('tr.file, tr.link').first().closest('table');
    let category = '';
    table.children('tbody').children('tr').each((i, tr) => {
      const row = $(tr);
      if (i === 0 && row.find('th').length > 1) return; // шапка таблицы
      if (row.hasClass('file')) {
        const a = row.find('a.downLoad').first();
        const cells = row.find('td').toArray().map((c) => clean($(c).text()));
        entries.push({
          type: 'file', id: at(tr).id, name: clean(a.text()), href: a.attr('href'),
          size: cells.find((c) => /\d\s*(Кб|Мб|Гб|Kb|Mb|байт)/i.test(c)) ?? '',
          date: cells.find((c) => /^\d\d\.\d\d\.\d{4}$/.test(c)) ?? '',
          category, group: categoryGroup(category),
        });
      } else if (row.hasClass('link')) {
        entries.push({ type: 'folder', id: at(tr).id, name: clean(row.text()) });
        (this._umkdSubfolders ??= new Set()).add(at(tr).id); // вложенная папка сайта: открываем её через HTML
      } else {
        const text = clean(row.text());
        if (text) category = text;
      }
    });
    return { entries, year, term };
  }

  // Зачётная книжка: оценки за сессию по семестрам.
  async session() {
    const $ = cheerio.load(await this.html('/student/recbook/'));
    const table = leaf($, 'table').toArray().find((t) => $(t).find('tr').toArray().some((tr) => $(tr).find('td').length >= 11));
    const semesters = [];
    let cur = null;
    if (table) {
      for (const tr of $(table).find('tr').toArray()) {
        const cells = $(tr).find('th, td').toArray();
        const text = clean($(tr).text());
        if (cells.length === 1 && text) { cur = { title: text, items: [] }; semesters.push(cur); continue; }
        const c = cells.map((x) => clean($(x).text()));
        if (!cur || c.length < 11 || !/^\d+$/.test(c[0])) continue;
        cur.items.push({ name: c[1], credits: c[2], rating: c[3], teacher: c[5], exam: c[6], date: c[7], examiner: c[8], total: c[9], letter: c[10] });
      }
    }
    // Семестры -> учебные годы. Год поступления берём из шапки учебного плана.
    const $p = cheerio.load(await this.html('/student/educplan/'));
    const cells = $p('table.xp td').toArray().map((td) => clean($p(td).text()));
    const adm = Number(cells[cells.findIndex((c) => /поступ|түскен|entrance/i.test(c)) + 1]) || 0;
    const years = [];
    for (const sem of semesters.filter((s) => s.items.length)) {
      const n = Number(sem.title.match(/\d+/)?.[0] ?? 0);
      const course = Math.ceil(n / 2);
      const start = adm + course - 1;
      let y = years.find((x) => x.start === start);
      if (!y) years.push((y = { start, label: `${start}-${start + 1}`, course, gpa: '', credits: '', semesters: [] }));
      y.semesters.push({ ...sem, n, ...semesterGpa(sem.items) });
    }
    // GPA за учебный год — как его показывает сайт на странице аттестации того года
    await Promise.all(years.map(async (y) => {
      const text = cheerio.load(await this.html(`/student/attestation/${y.start}/2`))('body').text().replace(/\s+/g, ' ');
      const m = [...text.matchAll(/\((\d{4})-\d{4}[^)]*\)\s*-\s*([\d.,]+)/g)].filter((x) => Number(x[1]) === y.start);
      y.gpa = m[0]?.[2] ?? '';
      y.credits = m[1]?.[2] ?? '';
    }));
    years.forEach((y) => y.semesters.reverse());
    return { years: years.sort((a, b) => b.start - a.start), warnings: this._warnings($) };
  }

  // Преподаватели по предметам (из журнала) + контакты эдвайзера.
  async teachers() {
    const [jr, adv] = await Promise.all([this.journal(), this.html('/student/advicer/')]);
    const $ = cheerio.load(adv);
    const a = {};
    leaf($, 'table.inner').filter((_, t) => /mail/i.test($(t).text())).first().find('td').toArray().map((td) => clean($(td).text())).forEach((v, i, arr) => {
      if (i % 2 === 0 && v) a[v.replace(/:$/, '')] = arr[i + 1] ?? '';
    });
    const pick = (re) => Object.entries(a).find(([k]) => re.test(k))?.[1] ?? '';
    return {
      advisor: { name: pick(/Ф\.И\.О|Аты|Name|ФИО/i), email: pick(/mail/i), phone: pick(/телефон|phone/i) },
      subjects: jr.subjects.map((s) => ({ name: s.name, teachers: s.parts.filter((p) => p.teacher).map((p) => ({ kind: p.kind, name: p.teacher })) })),
    };
  }

  // Дистанционные курсы: предметы -> потоки -> недели -> задания.
  async distanceSubjects() {
    const html = await this.html('/student/discussion/index/');
    const $ = cheerio.load(html);
    const ctx = html.match(/acpos\/list\/" \+ this\.id \+ "\/(\d{4})\/(\d)\//);
    const items = $('tr.link').toArray().map((tr) => ({ id: at(tr).id, title: clean($(tr).text()).replace(/\s*\(\d+\)$/, '') }))
      .filter((x) => /^\d+$/.test(x.id) && x.id !== '0');
    return { year: ctx?.[1] ?? '', term: ctx?.[2] ?? '', items };
  }

  async distanceTasks(sid, year, term) {
    if (![sid, year, term].every((x) => /^\d+$/.test(x))) throw new UniverError('input', 'Неверные параметры');
    const $a = cheerio.load(await this.html(`/student/discussion/acpos/list/${sid}/${year}/${term}/`));
    const weeks = [];
    for (const acpos of $a('tr.link').toArray().map((r) => at(r).id)) {
      const $w = cheerio.load(await this.html(`/student/discussion/acpos/week/list/${acpos}/${sid}/${year}/${term}/`));
      for (const r of $w('tr.link').toArray()) {
        const c = $w(r).find('td').toArray().map((td) => clean($w(td).text()));
        const week = { acpos, week: at(r).id, num: c[1], period: c[2], resources: Number(c[3]) || 0, taskCount: Number(c[4]) || 0, tasks: [] };
        if (week.taskCount) {
          const $t = cheerio.load(await this.html(`/student/discussion/task/list/${acpos}/${sid}/${year}/${term}/${week.week}/`));
          week.tasks = $t('tr.link').toArray().map((tr) => {
            const t = $t(tr).find('td').toArray().map((td) => clean($t(td).text()));
            const [title, author] = t[1].split(/\.\s*(?:Автор|Авторы|Author|Автор)\s*:\s*/);
            return { id: at(tr).id, title, author: author ?? '', start: t[2], end: t[3], created: t[4], participants: t[5] };
          });
        }
        if (week.taskCount || week.resources) weeks.push(week);
      }
    }
    return { weeks };
  }

  async distanceTask(id, acpos, sid, year, term, week) {
    if (![id, acpos, sid, year, term, week].every((x) => /^\d+$/.test(x))) throw new UniverError('input', 'Неверные параметры');
    const $ = cheerio.load(await this.html(`/student/discussion/task/preview/${id}/${acpos}/${sid}/${year}/${term}/${week}/0/0/0/`));
    const info = $('span.title').first().parent();
    const field = (re) => {
      const span = info.find('span').toArray().find((s) => re.test($(s).text()));
      if (!span) return '';
      let out = '';
      for (let n = sib(span); n && !(tagIs(n, 'span') && /title|capt|duration/.test(at(n).class ?? '')); n = sib(n)) out += $(n).text();
      return clean(out);
    };
    const side = info.closest('td').next('td');
    const header = (re) => {
      const h = side.find('span.header').toArray().find((s) => re.test($(s).text()));
      if (!h) return '';
      let out = '';
      for (let n = sib(h); n && !tagIs(n, 'span'); n = sib(n)) out += tagIs(n, 'br') ? '\n' : $(n).text();
      return out.trim();
    };
    const messages = $('tr.message').filter((_, tr) => $(tr).find('.date').length > 0).toArray().map((tr) => ({
      date: clean($(tr).find('.date').first().text()),
      from: clean($(tr).find('.capt').first().next('i').text()),
      text: clean($(tr).children('td').eq(1).text()),
      files: $(tr).find('a[href*="/fileget/"]').toArray().map((a) => ({ name: clean($(a).text()), href: $(a).attr('href') })),
    }));
    return {
      title: field(/Назван|атауы|аты\s*:|Name|Title/i), author: field(/Автор|Author/i), duration: field(/Продолж|Ұзақ|Duration/i),
      maxAnswers: field(/ответов|жауап|answers/i), maxScore: field(/балл|Max/i),
      format: header(/Формат|format|пішім|қалыб/i), description: header(/Описание|Description|Сипат/i),
      messages,
    };
  }

  // Учётные записи студента для анкеты. На главной странице студента (блок «Личные данные»)
  // таблица строк «подпись | логин | Пароль: | пароль»: Wi-Fi/print.kaznu.kz и Office 365.
  async accounts() {
    const $ = cheerio.load(await this.html('/student/bachelor/'));
    const found = {};
    const cell = $('td').filter((_, el) => /Office\s*365/i.test($(el).text()) && !$(el).find('td').length).first();
    if (cell.length) cell.closest('table').find('tr').each((_, tr) => {
      const c = $(tr).children('td').toArray().map((x) => clean($(x).text()));
      if (c.length < 4 || !c[1]) return;
      const id = /Office\s*365/i.test(c[0]) ? 'office365' : 'wifi';
      found[id] ??= { id, login: c[1], password: c[3] };
    });
    if (!found.wifi) { // запасной источник Wi-Fi — страница е-услуг
      const text = clean(cheerio.load(await this.html('/ssc/'))('body').text());
      const login = text.match(/(?:Логин|Login):\s*(\S+)/i)?.[1] ?? '';
      const password = text.match(/(?:Пароль|Құпия\s*сөз|Password):\s*(\S+)/i)?.[1] ?? '';
      if (login || password) found.wifi = { id: 'wifi', login, password };
    }
    return { accounts: [found.wifi, found.office365].filter(Boolean) };
  }

  // Е-услуги: список услуг, мои заявки, логин WiFi/print.

  async eservices() {
    const [home, list, mine] = await Promise.all([this.html('/ssc/'), this.html('/ssc/UserServiceList'), this.html('/ssc/StatementList')]);
    const $h = cheerio.load(home);
    const homeText = clean($h('body').text());
    const wifi = {
      login: homeText.match(/(?:Логин|Login):\s*(\S+)/i)?.[1] ?? '',
      password: homeText.match(/(?:Пароль|Құпия\s*сөз|Password):\s*(\S+)/i)?.[1] ?? '',
    };
    const services = parseServiceCatalog(list);
    const statements = parseStatements(mine);
    return { wifi, services, statements };
  }

  // Задолженности и пересдачи FX: две таблицы на каждой странице.
  async debts() {
    const read = async (path) => {
      const $ = cheerio.load(await this.html(path));
      return leaf($, 'table.inner').toArray().map((t) => {
        const rows = $(t).find('tr').toArray();
        const titleRow = $(rows[0]).find('th, td').length === 1 ? clean($(rows.shift()).text()) : '';
        const head = $(rows[0]).find('th').toArray().map((c) => clean($(c).text()));
        const data = rows.slice(1).map((r) => $(r).find('td').toArray().map((c) => clean($(c).text()))).filter((r) => r.length > 1 && r.some(Boolean));
        return { title: titleRow, head, rows: data };
      }).filter((t) => t.head.length > 2);
    };
    const [fail, fx] = await Promise.all([read('/student/fail/'), read('/student/failfx/')]);
    return { fail, fx };
  }

  // Анкеты: список анкет -> пункты (предмет/преподаватель или одна общая) -> форма.
  async surveys() {
    const $ = cheerio.load(await this.html('/student/rating/'));
    const list = $('tr.link').toArray().map((tr) => {
      const c = $(tr).find('td').toArray().map((td) => clean($(td).text()));
      return { id: at(tr).id, title: c[0], kind: c[1], start: c[2], end: c[3] };
    }).filter((x) => /^\d+$/.test(x.id));
    await Promise.all(list.map(async (s) => {
      const $s = cheerio.load(await this.html(`/student/rating/${s.id}`));
      s.items = $s('tr.link').toArray().map((tr) => {
        const tds = $s(tr).find('td').toArray();
        const c = tds.map((td) => clean($s(td).text()));
        const icon = $s(tr).find('img').attr('src') ?? '';
        const date = c.find((x) => /\d\d\.\d\d\.\d{4}/.test(x)) ?? '';
        return { id: at(tr).id, subject: c[0], teacher: c.length > 3 ? c[1] : '', answered: Boolean(date) || (icon && !/remove|delete|no/i.test(icon)), date };
      }).filter((x) => /^\d+\/\d+$/.test(x.id));
    }));
    return { surveys: list };
  }

  // Форма анкеты в общем виде: вопросы с радио/галочками/списками/текстом — так подхватятся и новые анкеты.
  async surveyForm(sid, item) {
    if (!/^\d+$/.test(sid) || !/^\d+\/\d+$/.test(item)) throw new UniverError('input', 'Неверная анкета');
    const $ = cheerio.load(await this.html(`/student/rating/${sid}/go/${item}/`));
    const form = $('form').filter((_, f) => at(f).id !== 'modal_auth_frm' && /\/save\/?$/.test(at(f).action ?? '')).first();
    if (!form.length) throw new UniverError('layout', 'Форма анкеты не найдена');
    const questions = [];
    const hidden = [];
    form.find('input[type=hidden]').each((_, el) => { if (at(el).name) hidden.push([at(el).name, at(el).value ?? '']); });
    form.find('tr').each((_, tr) => {
      const row = $(tr);
      const fields = row.find('input[type=radio], input[type=checkbox], input[type=text], input:not([type]), textarea, select');
      if (!fields.length) return;
      const textCell = row.find('li').first().length ? row.find('li').first() : row.find('td').first();
      const q = { id: at(tr).id ?? '', text: clean(textCell.text()), name: fields.first().attr('name'), type: '', required: false, options: [] };
      const first = fields.first();
      const tag = first.prop('tagName').toLowerCase();
      q.type = tag === 'textarea' ? 'text' : tag === 'select' ? 'select' : (first.attr('type') || 'text').toLowerCase();
      q.required = fields.toArray().some((f) => /required/.test(at(f).class ?? '') || at(f).required !== undefined);
      if (q.type === 'radio' || q.type === 'checkbox') {
        q.options = fields.toArray().map((f) => ({ value: at(f).value ?? '', label: clean($(f).closest('label').text()) || at(f).value }));
      } else if (q.type === 'select') {
        q.options = first.find('option').toArray().map((o) => ({ value: at(o).value ?? '', label: clean($(o).text()) })).filter((o) => o.value !== '');
      }
      if (q.name) questions.push(q);
    });
    const title = clean($('table.mt tr.top .ct').toArray().map((x) => $(x).text()).find((x) => /\S/.test(x) && !/Ақпарат|Информация/.test(x)) ?? '');
    return { action: form.attr('action'), questions, hidden, title };
  }

  // Отправка ответов: answers = { name: value | [values] }.
  async surveySubmit(sid, item, answers) {
    this.forget(); // после отправки нужно заново проверить список анкет
    const f = await this.surveyForm(sid, item);
    const missing = f.questions.filter((q) => q.required && !(Array.isArray(answers[q.name]) ? answers[q.name].length : answers[q.name]));
    if (missing.length) throw new UniverError('input', `Не отвечено вопросов: ${missing.length}`);
    const body = new URLSearchParams(f.hidden);
    for (const q of f.questions) {
      const v = answers[q.name];
      for (const x of Array.isArray(v) ? v : v !== undefined && v !== '' ? [v] : []) {
        if (q.options.length && !q.options.some((o) => o.value === String(x))) throw new UniverError('input', 'Неверный вариант ответа');
        body.append(q.name, String(x));
      }
    }
    const res = await this._fetch(f.action, { method: 'POST', body: body.toString(), headers: { referer: `${BASE}/student/rating/${sid}/go/${item}/`, origin: BASE } });
    if (res.status >= 400) throw new UniverError('network', `Сайт ответил ${res.status}`);
    // проверяем, что сайт отметил анкету пройденной
    const after = await this.surveys();
    const still = after.surveys.find((s) => s.id === sid)?.items.find((x) => x.id === item);
    return { ok: !still || still.answered, surveys: after };
  }

  // Скачивание файла: возвращает ответ сайта (поток) и имя файла.
  async file(href) {
    if (!/^\/student\/umkd\/get\/\d+\/\d+\/\d{4}\/\d$/.test(href) && !/^\/student\/discussion\/task\/fileget\/\d+\/\d+\/$/.test(href)) throw new UniverError('input', 'Неверная ссылка на файл');
    if (!this.loggedIn && !this.creds) throw new UniverError('not_logged_in', 'Сначала войдите');
    if (this._loginP) await this._loginP.catch(() => {});
    const gen = this._gen;
    let res = await this._fetch(href, { binary: true });
    if (/text\/html/.test(res.headers.get('content-type') ?? '')) {
      await this._relogin(gen);
      res = await this._fetch(href, { binary: true });
    }
    const cd = res.headers.get('content-disposition') ?? '';
    // Сайт шлёт имя в UTF-8. Node видит его как latin1-байты (надо перекодировать),
    // а Android уже раскодировал правильно (символы > 0xFF) — тогда оставляем как есть.
    const raw = cd.match(/filename="?([^";]+)"?/)?.[1] ?? 'file';
    const name = /[^\x00-\xff]/.test(raw) ? raw : new TextDecoder().decode(Uint8Array.from(raw, (c) => c.charCodeAt(0)));
    return { res, name };
  }
}

// GPA семестра: среднее баллов букв, взвешенное по кредитам (шкала из транскрипта КазНУ).
const POINTS = { 'A': 4, 'A-': 3.67, 'B+': 3.33, 'B': 3, 'B-': 2.67, 'C+': 2.33, 'C': 2, 'C-': 1.67, 'D+': 1.33, 'D': 1, 'FX': 0, 'F': 0 };
function semesterGpa(items) {
  let sum = 0, credits = 0;
  for (const it of items) {
    const p = POINTS[it.letter?.toUpperCase()];
    const c = Number(it.credits) || 0;
    if (p === undefined || !c) continue;
    sum += p * c; credits += c;
  }
  return { gpa: credits ? (Math.round((sum / credits) * 100) / 100).toFixed(2) : '', credits };
}

// Таблицы без вложенных таблиц (сайт свёрстан таблицами в таблицах).
function leaf($, sel) { return $(sel).filter((_, t) => $(t).find('table').length === 0); }

// «Название(лекция)» -> { name, kind }
function splitKind(s) {
  const m = s.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return m ? { name: m[1], kind: m[2] } : { name: s, kind: '' };
}

const keyName = (x) => String(x).toLowerCase().replace(/\s+/g, ' ').trim();

const isAbsent = (v) => /^(н|нб|н\/б|ж|nb|n|abs)$/i.test(v);

// Короткая группа для раздела УМКД.
function categoryGroup(c) {
  if (/силлабус|syllabus/i.test(c)) return 'Силлабус';
  if (/СРО|СӨЖ|өзіндік|самостоят|SIW|SSW|independent/i.test(c)) return 'СРО';
  if (/лекци|дәріс|конспект|lecture/i.test(c)) return 'Лекции';
  if (/лаборатор|зертхан|семинар|практи|laborator|seminar|practic/i.test(c)) return 'Практика и лабы';
  if (/экзамен|емтихан|тест|бақылау|контрол|exam|test|control/i.test(c)) return 'Экзамен';
  return c ? 'Другое' : 'Файлы';
}

