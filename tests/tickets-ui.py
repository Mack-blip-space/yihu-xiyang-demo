"""Browser-only checks for AI handoff and volunteer credential storage."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright
import json
import mimetypes

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://mack-blip-space.github.io/yihu-xiyang-demo/'

def serve(route):
    path = unquote(urlparse(route.request.url).path).removeprefix('/yihu-xiyang-demo/') or 'index.html'
    file = (ROOT / 'dist' / path).resolve()
    if route.request.url.endswith('/api/tickets'):
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'tickets':[], 'serverTime':1}))
    elif file.is_relative_to((ROOT / 'dist').resolve()) and file.is_file():
        route.fulfill(path=str(file), content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
    else:
        route.fulfill(status=404, body='Missing')

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':390,'height':844}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('https://mack-blip-space.github.io/**', serve)
    page.route('https://yihu-ai-consult.1201wburbankblvd.workers.dev/api/tickets', serve)
    page.goto(ORIGIN + '#ask')
    page.evaluate("aiQuestion='虚构问题：想了解消费合同的一般处理步骤。';render()")
    page.locator('[data-ai-handoff]').click()
    page.locator('#consultation-submit-form').wait_for()
    assert page.locator('[name=question]').input_value() == '虚构问题：想了解消费合同的一般处理步骤。'
    page.goto(ORIGIN + '#volunteer')
    page.locator('[name=credential]').fill('x' * 43)
    page.locator('#operator-login-form button').click()
    page.locator('.ticket-stats').wait_for()
    keys = page.evaluate('Object.keys(localStorage)')
    assert all('operator' not in key and 'volunteer' not in key for key in keys)
    assert page.locator('input[type=password]').count() == 0
    for width in (375,768,1024,1440):
        page.set_viewport_size({'width':width,'height':850})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors, errors
    print('Ticket UI handoff, memory-only volunteer credential and responsive layout passed.')
    browser.close()
