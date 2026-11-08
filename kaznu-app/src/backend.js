// «Сервер» внутри Android-приложения: те же /api/... маршруты, что у тестового server.mjs,
// но запросы идут с телефона напрямую на univer.kaznu.kz через нативный HTTP Android.
// Логин и пароль лежат в защищённом хранилище (Android Keystore), файлы — в памяти приложения.
import { CapacitorHttp, CapacitorCookies, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Univer, UniverError, parseServiceCatalog, parseStatements } from '../../kaznu-test/univer.mjs';
const ServicePortal = registerPlugin('ServicePortal');
const KeepAlive = registerPlugin('KeepAlive');
const Tactile = registerPlugin('Tactile');
const Biometric = registerPlugin('Biometric');

async function transport(url, { method = 'GET', headers = {}, body, binary, timeout } = {}) {
  const h = { ...headers };
  let data;
  if (body) {
    h['content-type'] = 'application/x-www-form-urlencoded';
    data = body; // готовая строка формы: нативный слой отправит её как есть (сохраняет повторы имён у галочек)
  }
  const r = await CapacitorHttp.request({ url, method, headers: h, data, responseType: binary ? 'blob' : 'text', connectTimeout: timeout ?? 20000, readTimeout: timeout ?? 60000 });
  const rh = Object.fromEntries(Object.entries(r.headers || {}).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : String(v)]));
  return {
    status: r.status, ok: r.status >= 200 && r.status < 300, url: r.url,
    headers: { get: (k) => rh[k.toLowerCase()] ?? null },
    // Для JSON-ответов нативный слой сам разбирает тело — возвращаем исходный текст JSON, как сделал бы fetch.
    text: async () => (/json/i.test(rh['content-type'] ?? '') || typeof r.data !== 'string' ? JSON.stringify(r.data) : r.data),
    base64: async () => r.data,
  };
}

const univer = new Univer({ transport, clearCookies: () => CapacitorCookies.clearCookies({ url: 'https://univer.kaznu.kz' }).catch(() => {}) });
const settingsLang = () => { try { return JSON.parse(localStorage.getItem('settings') || '{}').lang || 'ru'; } catch { return 'ru'; } };

// Пароль сохранён -> считаем, что вошли; если сессия на сайте истекла, Univer войдёт заново сам.
const ready = (async () => {
  let creds = null;
  for (let i = 0; i < 3 && !creds?.login; i++) {
    creds = await SecureStorage.get('creds').catch(() => null);
    if (!creds?.login) creds = await SecureStorage.get('lastCreds').catch(() => null);
    if (!creds?.login) await new Promise((r) => setTimeout(r, 300));
  }
  if (creds?.login) { univer.creds = creds; univer.loggedIn = true; }
  univer.lang = settingsLang();
})();

const DL_KEY = 'downloads';
const downloads = () => JSON.parse(localStorage.getItem(DL_KEY) || '{}');
const saveDownloads = (d) => localStorage.setItem(DL_KEY, JSON.stringify(d));
const MIME = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain', zip: 'application/zip', rar: 'application/x-rar-compressed' };
const ext = (name) => (String(name).match(/\.(\w+)$/)?.[1] || '').toLowerCase();
// убираем символы, запрещённые в именах файлов Android
const safeName = (s) => String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150) || 'file';

const mkdirp = (directory, path) => Filesystem.mkdir({ directory, path, recursive: true }).catch((e) => { if (!/exist/i.test(e?.message || '')) throw e; });
// первые байты небольшого файла (как строка latin1) — проверить, не страница ли это входа вместо файла
async function headOf(directory, path) {
  try {
    const { data } = await Filesystem.readFile({ path, directory });
    const b64 = typeof data === 'string' ? data.slice(0, 400) : '';
    return atob(b64.slice(0, b64.length - (b64.length % 4)));
  } catch { return ''; }
}

const routes = {
  'POST /api/login': async ({ login, password, lang }) => {
    if (!login || !password) throw new UniverError('input', 'Введите логин и пароль');
    if (lang) univer.lang = lang;
    await univer.login(login, password);
    await SecureStorage.set('creds', { login, password });
    await SecureStorage.set('lastCreds', { login, password }); // подставим в форму, если сайт выкинет из аккаунта
    if (localStorage.getItem(SEEN_FOR) !== login) { localStorage.removeItem(SEEN_KEY); localStorage.setItem(SEEN_FOR, login); }
    checkMarks().catch(() => {}); // запоминаем уже стоящие оценки — за них уведомлений не будет
    return univer.profile();
  },
  'POST /api/logout': async () => { univer.logout(); await SecureStorage.remove('creds').catch(() => {}); await SecureStorage.remove('lastCreds').catch(() => {}); localStorage.removeItem(SEEN_KEY); await CapacitorCookies.clearAllCookies().catch(() => {}); return { ok: true }; },
  'GET /api/status': () => ({ loggedIn: !!univer.loggedIn }),
  'GET /api/saved': async () => (await SecureStorage.get('lastCreds').catch(() => null)) || {},
  'POST /api/lang': async ({ lang }) => { await univer.setLang(lang); return { ok: true }; },
  'GET /api/profile': () => univer.profile(),
  'GET /api/schedule': () => univer.schedule(),
  'GET /api/card': () => univer.studentCard(),
  'GET /api/accounts': () => univer.accounts(),
  'GET /api/week': () => univer.academicWeek(),
  'GET /api/maxes': () => univer.maxPoints(),
  'POST /api/fresh': () => { univer.forget(); return { ok: true }; },
  'GET /api/exams': () => univer.exams(),
  'GET /api/grades': () => univer.grades(),
  'GET /api/umkd': () => univer.umkdSubjects(),
  'GET /api/session': () => univer.session(),
  'GET /api/teachers': () => univer.teachers(),
  'GET /api/distance': () => univer.distanceSubjects(),
  'GET /api/eservices': () => univer.eservices(),
  'GET /api/debts': () => univer.debts(),
  'GET /api/umkd/folder': (_, q) => univer.umkdFolder(q.id ?? '', q.year ?? '', q.term ?? ''),
  'GET /api/distance/tasks': (_, q) => univer.distanceTasks(q.sid ?? '', q.year ?? '', q.term ?? ''),
  'GET /api/distance/task': (_, q) => univer.distanceTask(q.id ?? '', q.acpos ?? '', q.sid ?? '', q.year ?? '', q.term ?? '', q.week ?? ''),
  'GET /api/surveys': () => univer.surveys(),
  'GET /api/survey': (_, q) => univer.surveyForm(q.sid ?? '', q.item ?? ''),
  'POST /api/survey': ({ sid, item, answers }) => univer.surveySubmit(String(sid), String(item), answers || {}),
  'GET /api/downloads': () => Object.values(downloads()).sort((a, b) => b.savedAt - a.savedAt),
  // Файл качается нативно прямо на диск, по частям: раньше он целиком шёл через JS как base64,
  // и на файлах в десятки мегабайт приложению не хватало памяти — оно вылетало.
  'POST /api/download': async ({ href, id, subject, group, name: shownName, saveTo }) => {
    if (!/^\w+$/.test(String(id))) throw new UniverError('input', 'Неверный id файла');
    if (!/^\/student\/umkd\/get\/\d+\/\d+\/\d{4}\/\d$/.test(href) && !/^\/student\/discussion\/task\/fileget\/\d+\/\d+\/$/.test(href)) throw new UniverError('input', 'Неверная ссылка на файл');
    if (!univer.loggedIn && !univer.creds) throw new UniverError('not_logged_in', 'Сначала войдите');
    let name = safeName(shownName || 'file');
    const folder = safeName(subject || 'Файлы');
    let dir = Directory.Data, base = `downloads/${folder}`;
    if (saveTo === 'documents') {
      await Filesystem.requestPermissions().catch(() => {});
      try { await mkdirp(Directory.Documents, `Univer KazNU/${folder}`); dir = Directory.Documents; base = `Univer KazNU/${folder}`; }
      catch { /* нет доступа к «Документам» — сохраняем в приложение */ }
    }
    if (dir === Directory.Data) await mkdirp(dir, base);
    const url = 'https://univer.kaznu.kz' + href;
    const fetchTo = async (path) => {
      const stop = await Filesystem.addListener('progress', (p) => {
        if (p.url === url && p.contentLength > 0) window.dispatchEvent(new CustomEvent('dlprogress', { detail: { id, pct: Math.min(99, Math.floor((p.bytes / p.contentLength) * 100)) } }));
      });
      try { await Filesystem.downloadFile({ url, path, directory: dir, progress: true, recursive: true, connectTimeout: 20000, readTimeout: 120000 }); }
      finally { stop.remove(); }
      return (await Filesystem.stat({ path, directory: dir })).size;
    };
    if (univer._loginP) await univer._loginP.catch(() => {});
    let path = `${base}/${name}`, gen = univer._gen;
    let size = await fetchTo(path);
    // вместо файла пришла страница входа (сессия на сайте истекла) — входим заново и качаем ещё раз
    let head = size < 400000 ? await headOf(dir, path) : '';
    if (/^\s*(<!doctype html|<html)/i.test(head)) {
      await univer._relogin(gen);
      size = await fetchTo(path);
      head = size < 400000 ? await headOf(dir, path) : '';
      if (/^\s*(<!doctype html|<html)/i.test(head)) { await Filesystem.deleteFile({ path, directory: dir }).catch(() => {}); throw new UniverError('session_expired', 'Сессия истекла'); }
    }
    // в названии нет расширения — определяем по первым байтам (PDF / Office / архив)
    if (!ext(name)) {
      const kind = head.startsWith('%PDF') ? 'pdf' : head.startsWith('PK') ? 'docx' : head.startsWith('\xd0\xcf') ? 'doc' : head.startsWith('Rar!') ? 'rar' : '';
      if (kind) { const to = `${base}/${name}.${kind}`; await Filesystem.rename({ from: path, to, directory: dir, toDirectory: dir }).then(() => { path = to; name += '.' + kind; }).catch(() => {}); }
    }
    const all = downloads();
    all[id] = { id, name, file: path, dir, subject, group, size, savedAt: Date.now() };
    saveDownloads(all);
    window.dispatchEvent(new CustomEvent('dlprogress', { detail: { id, pct: 100 } }));
    return all[id];
  },
};

async function api(path, opts = {}) {
  await ready;
  const url = new URL(path, 'https://app.local');
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? JSON.parse(opts.body) : {};
  try {
    const del = method === 'DELETE' && url.pathname.match(/^\/api\/downloads\/(\w+)$/);
    if (del) {
      const all = downloads();
      if (all[del[1]]) await Filesystem.deleteFile({ path: all[del[1]].file, directory: all[del[1]].dir || Directory.Data }).catch(() => {});
      delete all[del[1]];
      saveDownloads(all);
      return { ok: true };
    }
    const handler = routes[`${method} ${url.pathname}`];
    if (!handler) throw new UniverError('input', 'not found');
    return await handler(body, Object.fromEntries(url.searchParams));
  } catch (e) {
    const err = new Error(e instanceof UniverError ? e.message : 'Не удалось связаться с сайтом: ' + (e.message || e));
    err.code = e instanceof UniverError ? e.code : 'network';
    if (err.code === 'session_expired') { univer.logout(); await SecureStorage.remove('creds').catch(() => {}); } // lastCreds остаются — форма входа заполнится сама
    throw err;
  }
}

async function open(id) {
  const d = downloads()[id];
  if (!d) throw new Error('Файл не найден');
  const { uri } = await Filesystem.getUri({ path: d.file, directory: d.dir || Directory.Data });
  await FileOpener.open({ filePath: uri, contentType: MIME[ext(d.name)] || 'application/octet-stream', openWithDefault: false });
}

// переход на внешний адрес Capacitor откроет в системном браузере / почте / звонилке
function external(href) { window.location.href = href; }

// ---- Уведомления о новых оценках: проверка журнала раз в 1–2 минуты (случайно) ----
// Ключ отметки — позиция в журнале (предмет/часть/рубеж/дата), а не названия: при смене языка
// названия меняются, и раньше все старые оценки считались «новыми».
const SEEN_KEY = 'seenMarks2', SEEN_FOR = 'seenFor';
async function checkMarks() {
  if (!univer.loggedIn) return;
  const jr = await univer.journal(90000); // журнал, скачанный экраном оценок за последние 1,5 минуты, не качаем заново
  const now = {};
  jr.subjects.forEach((s, si) => s.parts.forEach((p, pi) => p.blocks.forEach((b) => b.entries.forEach((e) => {
    if (!e.value) return;
    now[[si, pi, b.rk, e.date].join('|')] = { subject: s.name, kind: p.kind, date: e.date, hint: e.hint, value: e.value };
  }))));
  const prev = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null');
  const fresh = prev ? Object.entries(now).filter(([k, v]) => prev[k] !== v.value).map(([, v]) => v) : [];
  // запоминаем всё, что видели (и старое тоже) — повторно об одной и той же оценке не сообщаем
  localStorage.setItem(SEEN_KEY, JSON.stringify({ ...(prev || {}), ...Object.fromEntries(Object.entries(now).map(([k, v]) => [k, v.value])) }));
  if (!fresh.length || !settingsNow().notify) return;
  await LocalNotifications.schedule({
    notifications: fresh.slice(0, 10).map((m, i) => ({
      id: (Date.now() % 1e9) + i,
      title: m.subject,
      body: `${m.hint || m.kind} · ${/^(н|ж|n)$/i.test(m.value) ? 'пропуск (н)' : m.value + ' балл'} · ${m.date}`,
      channelId: 'grades',
    })),
  });
}
const settingsNow = () => { try { return { notify: true, ...JSON.parse(localStorage.getItem('settings') || '{}') }; } catch { return { notify: true }; } };
let timer = null;
const loop = async () => {
  try { await checkMarks(); } catch { /* сеть или сайт недоступны — попробуем позже */ }
  timer = setTimeout(loop, 60000 + Math.random() * 60000); // 1–2 минуты в случайный момент
};
async function setNotify(on) {
  clearTimeout(timer); timer = null;
  if (!on) { await KeepAlive.stop().catch(() => {}); return; }
  await LocalNotifications.requestPermissions().catch(() => {});
  await LocalNotifications.createChannel({ id: 'grades', name: 'Новые оценки', importance: 4 }).catch(() => {});
  await KeepAlive.start().catch(() => {});
  timer = setTimeout(loop, 5000);
}
ready.then(() => {
  if (!settingsNow().notify) return;
  setNotify(true);
  // первый запуск с включёнными уведомлениями — просим разрешить работу в фоне
  if (!localStorage.getItem('askedBattery')) {
    localStorage.setItem('askedBattery', '1');
    KeepAlive.batteryOk().then((r) => { if (!r.value) KeepAlive.requestBattery(); }).catch(() => {});
  }
});

// Кнопка «назад» телефона: решение принимает интерфейс; 'exit' — свернуть приложение
App.addListener('backButton', () => { if (window.onBackButton?.() === 'exit') App.minimizeApp(); });

window.Backend = {
  api, open, external, setNotify,
  // kind — тип действия (page, nav, back, edge, select, toggle, hold, success, delete, error); level — сила 0..1.15
  haptic(kind, level) { Tactile.play({ kind, level }).catch(() => {}); },
  // вход по отпечатку/лицу: available() → { available, enrolled, hardware }; authenticate() — ошибка, если не вышло
  biometric: {
    available: () => Biometric.available().catch(() => ({ available: false })),
    authenticate: (o) => Biometric.authenticate(o),
    secure: (on) => Biometric.setSecure({ on }).catch(() => {}),
  },
  async servicePortal(id, kind = 'service') {
    await ready;
    let target;
    if (kind === 'statement' || kind === 'statements') {
      const html = await univer.html('/ssc/StatementList', 0);
      target = kind === 'statements'
        ? { href: '/ssc/StatementList', title: { ru: 'Мои заявки', kz: 'Менің өтінімдерім', en: 'My requests' }[settingsLang()] || 'My requests' }
        : parseStatements(html).find(x => x.statementId === id);
    } else if (kind === 'service') {
      target = parseServiceCatalog(await univer.html('/ssc/UserServiceList', 0)).find(x => x.id === id);
    }
    if (!target) throw new Error('Запись больше не доступна. Обновите список заявок и услуг.');
    await ServicePortal.open({ url: 'https://univer.kaznu.kz' + target.href, title: target.title || target.service, lang: settingsLang() });
    univer.forget();
  },
  battery: () => KeepAlive.batteryOk().then((r) => r.value),
  requestBattery: () => KeepAlive.requestBattery(),
};
