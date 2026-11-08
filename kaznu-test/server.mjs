// Локальный тестовый сервер: страница в браузере -> этот сервер -> univer.kaznu.kz.
// Пароль живёт только в памяти процесса. На диск пишутся только куки сессии (.session.json)
// и скачанные файлы (downloads/) — как это будет в приложении на телефоне.
import http from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { extname } from 'node:path';
import { Univer, UniverError } from './univer.mjs';

const PORT = 3000;
const SESSION = new URL('./.session.json', import.meta.url);
const DL_DIR = new URL('./downloads/', import.meta.url);
const DL_INDEX = new URL('./downloads/index.json', import.meta.url);

const univer = new Univer();
if (existsSync(SESSION)) univer.importSession(JSON.parse(await readFile(SESSION, 'utf8')));
const saveSession = () => writeFile(SESSION, JSON.stringify(univer.exportSession()));

await mkdir(DL_DIR, { recursive: true });
let downloads = existsSync(DL_INDEX) ? JSON.parse(await readFile(DL_INDEX, 'utf8')) : {};
const saveDownloads = () => writeFile(DL_INDEX, JSON.stringify(downloads, null, 1));

const MIME = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8' };

const json = (res, status, data) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};
const readBody = async (req) => {
  let s = '';
  for await (const c of req) s += c;
  return s ? JSON.parse(s) : {};
};

const routes = {
  'POST /api/login': async (req) => {
    const { login, password, lang } = await readBody(req);
    if (!login || !password) throw new UniverError('input', 'Введите логин и пароль');
    if (['kz', 'ru', 'en'].includes(lang)) univer.lang = lang;
    await univer.login(login, password);
    await saveSession();
    return univer.profile();
  },
  'POST /api/logout': async () => { univer.logout(); await rm(SESSION, { force: true }); return { ok: true }; },
  'POST /api/lang': async (req) => {
    const { lang } = await readBody(req);
    await univer.setLang(lang);
    await saveSession();
    return { ok: true };
  },
  'GET /api/profile': () => univer.profile(),
  'GET /api/schedule': () => univer.schedule(),
  'GET /api/status': () => ({ loggedIn: !!univer.loggedIn }),
  // Local diagnostics: source selection only, never cookies or credentials.
  'GET /api/sources': () => ({ ...univer.dataSources }),
  'GET /api/saved': () => ({ login: univer.creds?.login ?? '' }),
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
  'GET /api/surveys': () => univer.surveys(),
  'POST /api/survey': async (req) => { const { sid, item, answers } = await readBody(req); return univer.surveySubmit(String(sid), String(item), answers || {}); },
  'GET /api/downloads': () => Object.values(downloads).sort((a, b) => b.savedAt - a.savedAt),
  'POST /api/download': async (req) => {
    const { href, id, subject, group, name: shownName } = await readBody(req);
    if (!/^\w+$/.test(String(id))) throw new UniverError('input', 'Неверный id файла');
    const { res: up, name: siteName } = await univer.file(href);
    // имя как в приложении; расширение берём от сайта, если в названии его нет
    let name = shownName || siteName;
    if (!/\.\w+$/.test(name) && /\.\w+$/.test(siteName)) name += siteName.match(/\.\w+$/)[0];
    const buf = Buffer.from(await up.arrayBuffer());
    const file = `${id}${extname(name)}`;
    await writeFile(new URL(file, DL_DIR), buf);
    downloads[id] = { id, name, file, subject, group, size: buf.length, savedAt: Date.now() };
    await saveDownloads();
    return downloads[id];
  },
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(await readFile(new URL('./index.html', import.meta.url)));
    }
    if (req.method === 'GET' && url.pathname === '/backend.js') {
      // backend.js нужен только Android-приложению; здесь его роль играет этот сервер
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      return res.end('');
    }
    if (req.method === 'GET' && url.pathname === '/i18n.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      return res.end(await readFile(new URL('./i18n.js', import.meta.url)));
    }
    if (req.method === 'GET' && url.pathname === '/api/umkd/folder') {
      const q = url.searchParams;
      return json(res, 200, await univer.umkdFolder(q.get('id') ?? '', q.get('year') ?? '', q.get('term') ?? ''));
    }
    if (req.method === 'GET' && url.pathname === '/api/survey') {
      return json(res, 200, await univer.surveyForm(url.searchParams.get('sid') ?? '', url.searchParams.get('item') ?? ''));
    }
    if (req.method === 'GET' && url.pathname === '/api/distance/tasks') {
      const q = url.searchParams;
      return json(res, 200, await univer.distanceTasks(q.get('sid') ?? '', q.get('year') ?? '', q.get('term') ?? ''));
    }
    if (req.method === 'GET' && url.pathname === '/api/distance/task') {
      const q = Object.fromEntries(url.searchParams);
      return json(res, 200, await univer.distanceTask(q.id ?? '', q.acpos ?? '', q.sid ?? '', q.year ?? '', q.term ?? '', q.week ?? ''));
    }
    // «Открыть» скачанный файл: PDF и картинки браузер покажет сам, остальное скачается.
    const open = url.pathname.match(/^\/api\/open\/(\w+)$/);
    if (open && downloads[open[1]]) {
      const d = downloads[open[1]];
      const type = MIME[extname(d.name).toLowerCase()];
      res.writeHead(200, {
        'content-type': type ?? 'application/octet-stream',
        'content-disposition': `${type ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(d.name)}`,
      });
      return createReadStream(new URL(d.file, DL_DIR)).pipe(res);
    }
    const del = req.method === 'DELETE' && url.pathname.match(/^\/api\/downloads\/(\w+)$/);
    if (del && downloads[del[1]]) {
      await rm(new URL(downloads[del[1]].file, DL_DIR), { force: true });
      delete downloads[del[1]];
      await saveDownloads();
      return json(res, 200, { ok: true });
    }
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) { res.writeHead(404); return res.end('not found'); }
    json(res, 200, await handler(req));
  } catch (e) {
    if (e instanceof UniverError) {
      if (e.code === 'session_expired') { univer.logout(); await rm(SESSION, { force: true }); }
      return json(res, ['not_logged_in', 'session_expired'].includes(e.code) ? 401 : 400, { error: e.message, code: e.code });
    }
    console.error(e);
    json(res, 500, { error: 'Не удалось связаться с сайтом: ' + (e.cause?.code ?? e.message), code: 'network' });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Открой http://localhost:${PORT}`));
