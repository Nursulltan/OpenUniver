// Run after signing into probe.mjs. Reads real data in memory; prints only aggregate results.
import assert from 'node:assert/strict';
import { Univer } from './univer.mjs';
const call = async (route, body) => {
  const r = await fetch('http://127.0.0.1:3001/' + route, { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw Error('Probe request failed: ' + r.status);
  return r.json();
};
const u = new Univer({ transport: async (url, options) => {
  const path = new URL(url).pathname.slice(1);
  // The probe already authenticated with the user's credentials; do not copy them to this process.
  if (path === 'user/login/') return { ok:true, text:async()=>JSON.stringify({code:0,data:null}) };
  assert.equal(new URL(url).hostname, 'univerapi.kaznu.kz');
  const reply = await call('api', { path, params: Object.fromEntries(new URLSearchParams(options.body)) });
  return { ok:reply.status===200, status:reply.status, text:async()=>JSON.stringify({code:reply.code,data:reply.data}) };
} });
u.lang='ru';u.creds={login:'probe-session',password:'probe-session'};
const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g,' ').trim();
const results={};
for(const [method,htmlMethod] of [['schedule','schedule'],['umkdSubjects','umkdSubjects'],['exams','exams']]) {
  const start=performance.now();const actual=await u[method]();const elapsed=Math.round(performance.now()-start);
  const expected=(await call('html',{method:htmlMethod})).data;
  if(method==='schedule') {
    const fields=['weekday','time','subject','kind','teacher','room'];
    const canonical = rows => rows.map(row=>fields.map(k=>norm(row[k])).join('|')).sort();
    assert.deepEqual(canonical(actual.lessons),canonical(expected.lessons));
    results.schedule={source:u.dataSources.schedule,lessons:actual.lessons.length,coreFieldsMatch:true,ms:elapsed};
  } else if(method==='umkdSubjects') {
    assert.equal(actual.year,expected.year);assert.equal(actual.term,expected.term);
    const canonical=rows=>rows.map(row=>[row.id,norm(row.title),norm(row.kind)].join('|')).sort();
    assert.deepEqual(canonical(actual.items),canonical(expected.items));
    results.umkd={source:u.dataSources.umkd,subjects:actual.items.length,fieldsMatch:true,ms:elapsed};
  } else {
    assert.equal(actual.items.length,expected.items.length);
    results.exams={source:u.dataSources.exams,count:actual.items.length,emptyOnly:actual.items.length===0,ms:elapsed};
  }
}
assert.equal(u.dataSources.schedule,'api');assert.equal(u.dataSources.umkd,'api');assert.equal(u.dataSources.exams,'api');
console.log(JSON.stringify(results,null,2));
