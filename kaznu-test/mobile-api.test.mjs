import test from 'node:test';
import assert from 'node:assert/strict';
import { MobileApi, mapSchedule, mapUmkd, mapUmkdFull, mapExams } from './mobile-api.mjs';
import { Univer } from './univer.mjs';

const response = (data, code = 0) => ({ ok: true, status: 200, text: async () => JSON.stringify({ code, data }) });
const options = transport => ({ transport, credentials: () => ({ login: 'test', password: 'test' }), language: () => 'ru' });

test('concurrent reads share login and the response; refresh invalidates cached data', async () => {
  let logins = 0, reads = 0;
  const client = new MobileApi(options(async (url, req) => {
    assert.equal(new URL(url).origin, 'https://univerapi.kaznu.kz');
    assert.equal(new URLSearchParams(req.body).get('culture'), 'ru-RU');
    if (url.endsWith('user/login/')) { logins++; return response(null); }
    reads++; await new Promise(r => setTimeout(r, 5)); return response([{ id: 1 }]);
  }));
  const values = await Promise.all(Array.from({ length: 5 }, () => client.get('student/umkd2/')));
  assert.equal(logins, 1); assert.equal(reads, 1); assert.deepEqual(values[0], [{ id: 1 }]);
  await client.get('student/umkd2/'); assert.equal(reads, 1);
  client.forget(); await client.get('student/umkd2/'); assert.equal(reads, 2);
});

test('expired session relogs once and retries the read', async () => {
  let logins=0, reads=0;
  const client=new MobileApi(options(async url => {
    if(url.endsWith('user/login/')) { logins++; return response(null); }
    return ++reads===1 ? response(null,3) : response([]);
  }));
  assert.deepEqual(await client.get('student/examSchedule/'), []);
  assert.equal(logins,2); assert.equal(reads,2);
});

test('logout during login cannot restore the previous session', async () => {
  let release;
  const client=new MobileApi(options(() => new Promise(r => { release=r; })));
  const login=client.login(); client.reset(); release(response(null));
  await assert.rejects(login, /cancelled/); assert.equal(client.authenticated,false);
});

test('errors are not cached as successful empty results', async () => {
  let fail=true;
  const client=new MobileApi(options(async url => {
    if(url.endsWith('user/login/'))return response(null);
    if(fail)return {ok:true,text:async()=>'<html>error</html>'};
    return response([1]);
  }));
  await assert.rejects(client.get('student/profile/'), /format/);
  fail=false; assert.deepEqual(await client.get('student/profile/'),[1]);
});

test('API failures fall back to HTML; cooldown prevents repeated failed attempts', async () => {
  const u=new Univer(); u.creds={login:'test',password:'test'};
  let calls=0;
  u.mobile.get=async()=>{calls++;throw Error('offline');};
  u._examsHtml=async()=>({items:[{source:'html'}],warnings:[]});
  assert.equal((await u.exams()).items[0].source,'html');
  await u.exams();assert.equal(calls,1);
  u.forget();await u.exams();assert.equal(calls,2);
  u._max={old:{value:10}};u.logout();assert.deepEqual(u._max,{});assert.equal(u.mobile.authenticated,false);
});

test('schedule preserves times, room, teacher and period; unverified variants fall back', () => {
  const row={subject:'Math',eductype:'Lecture',teacher:'Teacher',timeBegin:'11:00',timeEnd:'11:50',audience:'201',audienceFaculty:'Building',from:'01.09.2026',to:'12.12.2026',type:1,denominator:0};
  const result=mapSchedule([[row],[],[],[],[],[]]);
  assert.equal(result.lessons[0].time,'11:00-11:50');
  assert.equal(result.lessons[0].weekday,1);assert.equal(result.lessons[0].period,'01.09.2026 - 12.12.2026');
  assert.equal(result.lessons[0].room,'201');
  assert.throws(()=>mapSchedule([[{...row,denominator:1}],[],[],[],[],[]]),/schedule_variant/);
  assert.throws(()=>mapSchedule([[{}],[],[],[],[],[]]),/schema/);
});

test('UMKD IDs retain HTML-folder compatibility; exams distinguish empty and malformed responses', () => {
  assert.deepEqual(mapUmkd([{id:123,sname:'Math',type:'Required'}],{currentYear:2026,currentSemester:1}),{year:'2026',term:'1',warnings:[],items:[{id:'123',title:'Math',kind:'Required'}]});
  assert.deepEqual(mapExams([]),{items:[],warnings:[]});
  assert.throws(()=>mapExams([{subject:'Math'}]),/schema/);
  assert.throws(()=>mapUmkd([],{}),/schema/);
});

test('grades retain authoritative HTML journal totals and task hints', async () => {
  const u=new Univer();
  u.html=async()=>'<html><body><table class="inner"><tr><th>Name</th><th>C</th><th>RK1</th><th>RK2</th><th>E</th><th>T</th><th>G</th><th>L</th></tr><tr><td>Math</td><td>5</td><td>0</td><td>0</td><td></td><td></td><td></td><td></td></tr></table></body></html>';
  const parts=[{group:'123',kind:'Lab',blocks:[{rk:2,entries:[{date:'05.11',value:'9',hint:'Lab 10'}]}]}];
  u.journal=async()=>({subjects:[{name:'Math',rk:{1:'50',2:'9'},parts}],warnings:[]});
  u.profile=async()=>({gpa:'2,02',yearStart:2026});
  const result=await u.grades();
  assert.equal(result.subjects[0].rk2,'9');assert.equal(result.gpa,'2,02');
  assert.equal(result.subjects[0].parts[0].group,'123');
  assert.equal(result.subjects[0].parts[0].blocks[0].entries[0].hint,'Lab 10');
});

test('umkdFull maps teacher groups to the same file entries as the site folder', () => {
  const group = (c) => (/Силлабус/.test(c) ? 'Силлабус' : 'Другое');
  const data = [
    [{ teacher: 'Преподаватель А' }, { itemId: '11', fname: 'Силлабус  курса.pdf', description: ' ', type: 'Силлабус', lang: ' - ', size: '300,65 Кб', date: '06.10.2026', count: '4' }],
    [{ teacher: 'Преподаватель Б' }, { itemId: '12', fname: 'Лаб 1.docx', description: 'Описание', type: 'Методические рекомендации', lang: 'Казахский  ', size: '11,92 Кб', date: '15.09.2026', count: '1' }],
  ];
  const r = mapUmkdFull(data, '777', '2026', '1', group);
  assert.equal(r.entries.length, 2);
  assert.deepEqual(r.entries[0], { type: 'file', id: '11', name: 'Силлабус курса.pdf', href: '/student/umkd/get/11/777/2026/1', size: '300,65 Кб', date: '06.10.2026', category: 'Силлабус', group: 'Силлабус', teacher: 'Преподаватель А', lang: '', note: '' });
  assert.equal(r.entries[1].teacher, 'Преподаватель Б'); assert.equal(r.entries[1].lang, 'Казахский');
  assert.throws(() => mapUmkdFull([], '777', '2026', '1', group), /empty/);
  assert.throws(() => mapUmkdFull([[{ teacher: 'x' }, { fname: 'нет id' }]], '777', '2026', '1', group), /schema/);
  assert.throws(() => mapUmkdFull({ notReged: true }, '777', '2026', '1', group), /schema/);
});

test('umkd folder uses the API and falls back to the site page when the API fails', async () => {
  let apiOk = true, htmlReads = 0;
  const html = '<a href="/user/logout">x</a><table><tbody><tr><th>Файл</th><th>Размер</th></tr><tr><td>Силлабус</td></tr><tr class="file" id="11"><td><a class="downLoad" href="/student/umkd/get/11/777/2026/1">Силлабус.pdf</a></td><td>1 Кб</td></tr></tbody></table>';
  const u = new Univer({ transport: async (url) => {
    const { host, pathname } = new URL(url);
    if (host === 'univerapi.kaznu.kz') {
      if (pathname.endsWith('user/login/')) return response(null);
      return apiOk ? response([[{ teacher: 'А' }, { itemId: '11', fname: 'Силлабус.pdf', type: 'Силлабус', size: '1 Кб', date: '01.09.2026' }]]) : { ok: false, status: 500, text: async () => '' };
    }
    htmlReads++;
    return { ok: true, status: 200, headers: { get: () => 'text/html', getSetCookie: () => [] }, text: async () => html };
  } });
  u.creds = { login: 'test', password: 'test' }; u.loggedIn = true;
  const a = await u.umkdFolder('777', '2026', '1');
  assert.equal(u.dataSources.umkdFolder, 'api'); assert.equal(a.entries[0].teacher, 'А'); assert.equal(htmlReads, 0);
  apiOk = false; u.forget();
  const b = await u.umkdFolder('777', '2026', '1');
  assert.equal(u.dataSources.umkdFolder, 'html'); assert.equal(b.entries[0].id, a.entries[0].id); assert.equal(b.entries[0].href, a.entries[0].href);
});
