"""Local UI regression check; no requests to Univer and no real applications."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text('utf-8')
audit = json.loads((root / 'ssc-catalog-audit.json').read_text('utf-8'))
services = [dict(id=str(i), title=x['title'], href=x['href'], kind='application') for i,x in enumerate(audit['services'])]
data = {'wifi': {'login': ''}, 'services': services, 'statements': [dict(id='42',statementId='12345',service='Тестовая справка',date='07.11.2026',status='Завершено',href='/ssc/StatementPage?statementId=12345')]}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='msedge')
    page = browser.new_page(viewport={'width':390, 'height':844})
    def route(r):
        url = r.request.url
        if url == 'http://fixture.test/': body, mime = html, 'text/html'
        elif url.endswith('/i18n.js'): body, mime = (root / 'i18n.js').read_text('utf-8'), 'text/javascript'
        elif url.endswith('/api/eservices'): body, mime = json.dumps(data), 'application/json'
        else: body, mime = '{"loggedIn":false}', 'application/json'
        r.fulfill(status=200, body=body, content_type=mime)
    page.route('**/*', route)
    page.goto('http://fixture.test/')
    page.evaluate('(d)=>{cache.eservices=d;S.route="eservices";return render()}', data)
    page.wait_for_timeout(400)
    for width in [320,360,390,420]:
        page.set_viewport_size({'width':width,'height':844})
        boxes = page.locator('[data-service-row] [data-service]').evaluate_all('(els)=>els.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,top:e.getBoundingClientRect().top-e.parentElement.getBoundingClientRect().top}))')
        assert len(boxes)==32
        assert all(abs(x['w']-136)<0.1 and abs(x['h']-48)<0.1 and abs(x['top']-6)<0.1 for x in boxes), boxes
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.evaluate('window.Backend={api:async p=>(await fetch(p)).json(),servicePortal:async(id,kind)=>{window.testCall={id,kind}}}')
    page.locator('[data-kind="statement"]').click()
    page.wait_for_function('window.testCall?.kind==="statement"')
    assert page.evaluate('window.testCall.id')=='12345'
    page.locator('[data-kind="statements"]').click()
    page.wait_for_function('window.testCall?.kind==="statements"')
    page.locator('#service-search').fill('общежитие')
    assert page.locator('[data-service-row]:visible').count()==1
    page.locator('#service-search').fill('ОТЧИСЛЕНИЕ.')
    page.locator('[data-service-row]:visible').scroll_into_view_if_needed()
    page.screenshot(path=str(root / 'eservices-layout-check.png'))
    print('PASS: 32 equal top-aligned buttons at 320/360/390/420px; search; individual and full-list navigation')
    browser.close()
