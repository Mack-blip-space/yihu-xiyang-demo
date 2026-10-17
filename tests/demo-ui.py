"""Competition UI: local fixtures only, no model calls or real personal data."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright
import json,mimetypes
ROOT=Path(__file__).resolve().parents[1]
ORIGIN='https://mack-blip-space.github.io/yihu-xiyang-demo/'
requests=[]
def serve(route):
    url=route.request.url
    if 'workers.dev' in url:
        requests.append(url)
        if url.endswith('/health'):
            route.fulfill(json={'version':'0.9.0','tickets':True,'push':True})
        else:
            route.fulfill(json={'tickets':[],'serverTime':1,'deleted':True})
        return
    path=unquote(urlparse(url).path).removeprefix('/yihu-xiyang-demo/') or 'index.html'
    file=(ROOT/'dist'/path).resolve()
    if file.is_relative_to((ROOT/'dist').resolve()) and file.is_file():
        route.fulfill(path=str(file),content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
    else:route.fulfill(status=404,body='Missing')
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',serve)
    page.goto(ORIGIN+'#mine')
    page.wait_for_function('typeof db !== "undefined" && db !== null')
    page.locator('[data-go=feedback]').click()
    page.locator('#consultation-submit-form').wait_for()
    assert page.locator('[name=category]').input_value()=='使用反馈'
    page.goto(ORIGIN+'#data-settings')
    page.on('dialog',lambda dialog:dialog.accept())
    page.evaluate('consultationToken(true)')
    page.locator('[data-demo=delete]').click()
    page.get_by_text('云端咨询、反馈与回复已删除。',exact=True).wait_for()
    page.goto(ORIGIN+'#demo-status')
    page.locator('[data-demo=check]').click()
    page.get_by_text('服务端版本：0.9.0',exact=True).wait_for()
    assert not any('/api/consult' in u for u in requests)
    page.evaluate('Object.defineProperty(navigator,"onLine",{value:false,configurable:true})')
    page.locator('[data-demo=check]').click()
    page.get_by_text('当前没有网络，请联网后重试。已保存的本机内容仍可查看。',exact=True).wait_for()
    page.evaluate('Object.defineProperty(navigator,"onLine",{value:true,configurable:true})')
    page.goto(ORIGIN+'#consultations')
    page.route('**/api/tickets',lambda route:route.abort('failed'))
    page.locator('[data-ticket=refresh]').click()
    page.get_by_text('连接失败，请检查网络后重试。',exact=True).wait_for()
    page.wait_for_timeout(500)
    assert page.locator('[data-ticket=refresh]').is_enabled()
    for width in [375,768,1440]:
        page.set_viewport_size({'width':width,'height':900})
        for path in ['feedback','data-settings','demo-status']:
            page.goto(ORIGIN+'#'+path)
            page.wait_for_function('typeof db !== "undefined" && db !== null')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),(width,path)
    page.set_viewport_size({'width':390,'height':844})
    page.goto(ORIGIN+'#data-settings')
    page.locator('[data-demo=delete]').wait_for()
    page.screenshot(path=str(ROOT/'artifacts/v0.9.0-data-settings.png'),full_page=True)
    assert not errors,errors
    browser.close()
print('PASS: feedback, deletion, status without AI calls, offline/retry and responsive layout')
