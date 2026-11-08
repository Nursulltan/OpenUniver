// KazNU mobile API. Cookies are isolated from the HTML site's Node cookie jar.
const BASE = 'https://univerapi.kaznu.kz/';
export class ApiError extends Error {
  constructor(code) { super(`Mobile API: ${code}`); this.code = code; }
}
const text = v => v == null ? '' : String(v).trim();
const required = (row, keys) => {
  if (!row || keys.some(k => !Object.hasOwn(row, k))) throw new ApiError('schema');
};
export function mapSchedule(week, lang = 'ru') {
  if (!Array.isArray(week) || week.length !== 6 || week.some(day => !Array.isArray(day))) throw new ApiError('schema');
  const days = ({ ru: ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'], kz: ['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі'], en: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] })[lang] || [];
  const lessons = week.flatMap((rows, d) => rows.map(row => {
    required(row, ['subject','eductype','teacher','timeBegin','timeEnd','audience','audienceFaculty','from','to']);
    // Alternating-week semantics have not been verified: retain the HTML path for those schedules.
    if (Number(row.denominator || 0) !== 0 || (row.type != null && Number(row.type) !== 1)) throw new ApiError('schedule_variant');
    return { weekday: d+1, day: days[d], time: `${row.timeBegin}-${row.timeEnd}`, slots: 1,
      subject: text(row.subject), kind: text(row.eductype), teacher: text(row.teacher), room: text(row.audience), building: text(row.audienceFaculty), period: `${row.from} - ${row.to}` };
  }));
  return { days, lessons };
}
export function mapUmkd(data, semester) {
  if (!Array.isArray(data) || !/^\d{4}$/.test(String(semester?.currentYear)) || !/^[12]$/.test(String(semester?.currentSemester))) throw new ApiError('schema');
  return { year: String(semester.currentYear), term: String(semester.currentSemester), warnings: [], items: data.map(row => {
    required(row, ['id','sname','type']);
    if (!/^\d+$/.test(String(row.id))) throw new ApiError('schema');
    return { id: String(row.id), title: text(row.sname), kind: text(row.type) };
  }) };
}
// Все файлы предмета одним запросом: data = [[{teacher}, файл, файл…], …] — группы по преподавателям.
// Проверено на 6 предметах: те же файлы и номера (itemId), что в HTML-папке, а type = раздел на сайте.
export function mapUmkdFull(data, subjectId, year, term, group) {
  if (!Array.isArray(data) || data.some((g) => !Array.isArray(g))) throw new ApiError('schema');
  const clean = (v) => text(v).replace(/\s+/g, ' ');
  const entries = data.flatMap((g) => {
    const [head, ...files] = g;
    if (!head || typeof head !== 'object' || Object.hasOwn(head, 'itemId')) throw new ApiError('schema');
    return files.map((f) => {
      required(f, ['itemId', 'fname', 'type', 'size', 'date']);
      if (!/^\d+$/.test(String(f.itemId))) throw new ApiError('schema');
      const category = clean(f.type);
      const lang = clean(f.lang).replace(/^-$/, '');
      return { type: 'file', id: String(f.itemId), name: clean(f.fname), href: `/student/umkd/get/${f.itemId}/${subjectId}/${year}/${term}`,
        size: clean(f.size), date: clean(f.date), category, group: group(category), teacher: clean(head.teacher), lang, note: clean(f.description) };
    });
  });
  // пустой ответ не считаем «файлов нет»: тогда проверяем сайт
  if (!entries.length) throw new ApiError('empty');
  return { entries, year, term };
}
export function mapExams(data, lang='ru') {
  if (!Array.isArray(data)) throw new ApiError('schema');
  const labels = ({ ru: ['Предмет','Тип','Преподаватель','Корпус','Аудитория','Дата','Время'], kz: ['Пән','Түрі','Оқытушы','Ғимарат','Аудитория','Күні','Уақыты'], en: ['Subject','Type','Teacher','Building','Room','Date','Time'] })[lang];
  const keys=['subject','type','teacher','audienceFaculty','audience','date','time'];
  return { items: data.map(row => { required(row, keys); return Object.fromEntries(keys.map((k,i) => [labels[i], text(row[k])])); }), warnings: [] };
}
export class MobileApi {
  constructor({ transport, credentials, language }) {
    this.transport = transport;
    this.credentials = credentials;
    this.language = language;
    this.reset();
  }
  reset() { this.generation = (this.generation || 0) + 1; this.jar = {}; this.authenticated = false; this.loginPending = null; this.cache = new Map(); }
  forget() { this.cache.clear(); }
  async request(path, params = {}) {
    if (!/^(student\/[A-Za-z0-9]+|user\/login)\/$/.test(path)) throw new ApiError('path');
    const generation = this.generation;
    const body = new URLSearchParams({ culture: { kz: 'kk-KZ', ru: 'ru-RU', en: 'en-US' }[this.language()] || 'ru-RU', ...params }).toString();
    const headers = { 'content-type': 'application/x-www-form-urlencoded' };
    let res;
    if (this.transport) res = await this.transport(BASE + path, { method: 'POST', headers, body, timeout: 8000 });
    else {
      headers.cookie = Object.entries(this.jar).map(([k,v]) => `${k}=${v}`).join('; ');
      res = await fetch(BASE + path, { method: 'POST', headers, body, redirect: 'error', signal: AbortSignal.timeout(8000) });
      if (generation === this.generation) for (const c of res.headers.getSetCookie()) {
        const pair = c.split(';')[0], i = pair.indexOf('=');
        this.jar[pair.slice(0,i)] = pair.slice(i+1);
      }
    }
    if (generation !== this.generation) throw new ApiError('cancelled');
    if (!res.ok) throw new ApiError('http_' + res.status);
    let json;
    try { json = JSON.parse(await res.text()); } catch { throw new ApiError('format'); }
    if (Number(json.code) !== 0) throw new ApiError('server_' + json.code);
    if (!Object.hasOwn(json, 'data')) throw new ApiError('format');
    return json.data;
  }
  async login() {
    if (this.authenticated) return;
    if (!this.loginPending) {
      const generation = this.generation;
      const creds = this.credentials();
      if (!creds?.login || !creds?.password) throw new ApiError('no_credentials');
      const pending = this.request('user/login/', creds).then(() => {
        if (generation !== this.generation) throw new ApiError('cancelled');
        this.authenticated = true;
      }).finally(() => { if (this.loginPending === pending) this.loginPending = null; });
      this.loginPending = pending;
    }
    return this.loginPending;
  }
  async get(path, params = {}, ttl = 60000) {
    const key = JSON.stringify([this.language(), path, params]);
    const hit = this.cache.get(key);
    if (hit && (hit.pending || Date.now() - hit.at < ttl)) return hit.promise;
    const entry = { pending: true, at: 0 };
    entry.promise = (async () => {
      await this.login();
      try { return await this.request(path, params); }
      catch (e) {
        if (e.code !== 'server_3') throw e;
        this.authenticated = false;
        await this.login();
        return this.request(path, params);
      }
    })().then(data => { entry.pending = false; entry.at = Date.now(); return data; }, e => {
      if (this.cache.get(key) === entry) this.cache.delete(key);
      throw e;
    });
    this.cache.set(key, entry);
    return entry.promise;
  }
}
