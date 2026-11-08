import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseServiceCatalog, parseStatements } from './univer.mjs';
const audit = JSON.parse(await readFile(new URL('./ssc-catalog-audit.json', import.meta.url), 'utf8'));
const escape = s => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const row = (href, title='Service') => `<tr class="link"><td>1</td><td>${escape(title)}</td><td><a href="${escape(href)}">Apply</a></td></tr>`;
test('all 32 observed services survive catalog parsing, including two information pages', () => {
 const parsed = parseServiceCatalog('<table>'+audit.services.map(x=>row(x.href,x.title)).join('')+'</table>');
 assert.equal(parsed.length,32);
 assert.equal(new Set(parsed.map(x=>x.id)).size,32);
 assert.equal(parsed.filter(x=>x.kind==='application').length,30);
 assert.deepEqual(parsed.map(x=>x.title),audit.services.map(x=>x.title.replace(/\s+/g, " ").trim()));
 assert.equal(parsed.find(x=>x.href==='/student/payinfo/').kind,'information');
});
test('catalog ignores foreign origins, scripts, wrong steps and unrelated actions', () => {
 const bad=['https://evil.test/ssc/StatementPage?serviceId=30&stepId=1','javascript:alert(1)','//evil.test/student/fail/','https://evil@univer.kaznu.kz/student/fail/','/ssc/StepResultSave','/ssc/StatementPage?serviceId=30&stepId=2','/ssc/StatementPage?serviceId=oops&stepId=1','/student/payinfo/?redirect=bad'];
 assert.deepEqual(parseServiceCatalog('<table>'+bad.map(x=>row(x)).join('')+'</table>'),[]);
});
test('missing services produce an empty catalog',()=>assert.deepEqual(parseServiceCatalog('<html>Login</html>'),[]));

test('request links use the row ID, not the displayed application number', () => {
 const html = '<table><tr class="link" id="12345"><td></td><td>42</td><td></td><td></td><td></td><td>Certificate</td><td>07.11.2026</td><td>Done</td><td></td></tr><tr class="link" id="bad"><td>Ignore</td></tr></table>';
 assert.deepEqual(parseStatements(html), [{id:'42', statementId:'12345', service:'Certificate', date:'07.11.2026', status:'Done', href:'/ssc/StatementPage?statementId=12345'}]);
});

test('accounts(): Wi-Fi and Office 365 from the student home page', async () => {
  const { Univer } = await import('./univer.mjs');
  const page = '<a href="/user/logout">x</a><table class="mt"><tr class="top"><td class="ct">Личные данные</td></tr><tr><td><table>'
    + '<tr><td><li>Логин:</li></td><td> wifi_user </td><td><li>Пароль:</li></td><td> pw1 </td></tr>'
    + '<tr><td><li>Логин и пароль для входа в портал Office 365:</li></td><td> wifi_user@live.kaznu.kz </td><td><li>Пароль:</li></td><td> pw2 </td></tr>'
    + '</table></td></tr></table>';
  const u = new Univer({ transport: async () => ({ ok: true, status: 200, headers: { get: () => 'text/html', getSetCookie: () => [] }, text: async () => page }) });
  u.loggedIn = true;
  const { accounts } = await u.accounts();
  assert.deepEqual(accounts, [
    { id: 'wifi', login: 'wifi_user', password: 'pw1' },
    { id: 'office365', login: 'wifi_user@live.kaznu.kz', password: 'pw2' },
  ]);
});
