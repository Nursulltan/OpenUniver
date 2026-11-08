// Local, memory-only API/HTML comparison. Never writes credentials or responses to disk.
import http from 'node:http';
import { Univer } from './univer.mjs';
const site = new Univer();
let jar = {}, signedIn = false;
async function api(path, params = {}) {
  if (!/^(user\/login|student\/[A-Za-z0-9]+)\/$/.test(path)) throw Error('Unsupported endpoint');
  const start = performance.now();
  const r = await fetch('https://univerapi.kaznu.kz/' + path, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25000), headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: Object.entries(jar).map(([k,v]) => `${k}=${v}`).join('; ') }, body: new URLSearchParams({ culture: 'ru-RU', ...params }) });
  for (const c of r.headers.getSetCookie()) { const pair=c.split(';')[0], i=pair.indexOf('='); jar[pair.slice(0,i)]=pair.slice(i+1); }
  const text=await r.text();
  let json; try { json=JSON.parse(text); } catch { throw Error('API returned non-JSON, HTTP '+r.status); }
  return { ms: Math.round(performance.now()-start), bytes: Buffer.byteLength(text), status:r.status, code:json.code, data:json.data };
}
const page = `<!doctype html><meta charset="utf-8"><title>Проверка Univer API</title><style>body{font:18px system-ui;max-width:520px;margin:80px auto;padding:20px}input,button{display:block;width:100%;box-sizing:border-box;padding:14px;margin:12px 0}pre{white-space:pre-wrap}</style><h1>Проверка Univer API</h1><p>Вход на серверы КазНУ для сравнения API и сайта. Пароль хранится только в памяти до закрытия тестового сервера.</p><form><input name="login" autocomplete="username" placeholder="Логин" required><input name="password" type="password" autocomplete="current-password" placeholder="Пароль" required><button>Войти для проверки</button></form><pre id="status"></pre><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;status.textContent='Выполняется вход…';try{const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});const d=await r.json();document.getElementById('status').textContent=d.ok?'Вход выполнен. Можно вернуться в чат — проверка продолжится.':d.error;if(d.ok)e.target.remove();}catch{document.getElementById('status').textContent='Ошибка соединения';}finally{b.disabled=false;}};</script>`;
http.createServer(async(req,res)=>{
  const send=(code,value)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));};
  try {
    if(req.headers.host!=='127.0.0.1:3001' && req.headers.host!=='localhost:3001') return send(403,{error:'Host'});
    if(req.headers.origin && !['http://127.0.0.1:3001','http://localhost:3001'].includes(req.headers.origin)) return send(403,{error:'Origin'});
    if(req.url==='/' && req.method==='GET'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(page);}
    if(req.url==='/status') return send(200,{signedIn});
    let raw='';for await(const c of req){raw+=c;if(raw.length>8192)throw Error('Body too large');} const body=JSON.parse(raw||'{}');
    if(req.url==='/login' && req.method==='POST'){
      jar={}; signedIn=false;
      const result=await api('user/login/',{login:body.login,password:body.password});
      if(Number(result.code)!==0) return send(400,{error:'API отклонил вход, код '+result.code});
      site.lang='ru'; await site.login(body.login,body.password); signedIn=true; return send(200,{ok:true});
    }
    if(!signedIn)return send(401,{error:'Sign in first'});
    if(req.url==='/api' && req.method==='POST')return send(200,await api(body.path,body.params));
    if(req.url==='/html' && req.method==='POST'){
      if(!['profile','schedule','grades','journal','maxPoints','exams','umkdSubjects','umkdFolder','academicWeek'].includes(body.method))throw Error('Unsupported method');
const args=Array.isArray(body.args)&&body.args.every(x=>/^\d+$/.test(String(x)))?body.args.map(String):[];
      const start=performance.now();const data=await site[body.method](...args);return send(200,{ms:Math.round(performance.now()-start),data});
    }
    send(404,{error:'Not found'});
  }catch(e){send(400,{error:e.code || 'Request failed'});}
}).listen(3001,'127.0.0.1',()=>console.log('Probe ready: http://127.0.0.1:3001'));
