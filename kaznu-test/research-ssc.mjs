// Temporary local inspection of SSC pages. Credentials and cookies stay in memory.
import http from 'node:http';
import { Univer } from './univer.mjs';
const site=new Univer();
const page=`<!doctype html><meta charset="utf-8"><title>Проверка e-услуг</title><style>body{font:18px system-ui;max-width:540px;margin:70px auto;padding:20px}input,button{display:block;width:100%;box-sizing:border-box;padding:14px;margin:12px 0}</style><h1>Проверка e-услуг КазНУ</h1><p>Вход для изучения каталога и форм. Заявки при исследовании не отправляются. Пароль хранится только в памяти локального процесса.</p><form><input name="login" placeholder="Логин" autocomplete="username" required><input name="password" type="password" placeholder="Пароль" autocomplete="current-password" required><button>Войти</button></form><p id="result"></p><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();let b=e.target.querySelector('button');b.disabled=true;try{let r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});let d=await r.json();document.getElementById('result').textContent=d.ok?'Вход выполнен. Можно вернуться в чат.':'Не удалось войти';if(d.ok)e.target.remove();}finally{b.disabled=false}};</script>`;
http.createServer(async(req,res)=>{
 const send=(status,value)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));};
 try{
  if(!['127.0.0.1:3004','localhost:3004'].includes(req.headers.host))return send(403,{});
  if(req.headers.origin&&!['http://127.0.0.1:3004','http://localhost:3004'].includes(req.headers.origin))return send(403,{});
  if(req.url==='/'&&req.method==='GET'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(page);}
  if(req.url==='/status')return send(200,{loggedIn:site.loggedIn});
  let raw='';for await(const c of req){raw+=c;if(raw.length>12000)throw Error('body');}const b=JSON.parse(raw||'{}');
  if(req.url==='/login'&&req.method==='POST'){site.lang='ru';await site.login(b.login,b.password);return send(200,{ok:true});}
  if(!site.loggedIn)return send(401,{});
  if(req.url==='/read'&&req.method==='POST'){
   if(!/^\/(ssc|Scripts|Content)\//i.test(b.path)||/delete|remove|submit|save|approve|cancel/i.test(b.path))return send(400,{error:'Read-only path'});
   return send(200,{text:await site.html(b.path,0)});
  }
  send(404,{});
 }catch(e){send(400,{error:e.code||'request_failed'});}
}).listen(3004,'127.0.0.1',()=>console.log('SSC inspection: http://127.0.0.1:3004'));
