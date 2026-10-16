"""Notification settings behavior and responsive layout with a simulated Android bridge."""
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
    if route.request.url.endswith('/api/push'):
        request = json.loads(route.request.post_data or '{}')
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'configured': True, 'subscription': {'enabled': 1 if request.get('action') == 'subscribe' else 0, 'updated_ms': 1, 'last_success_ms': None, 'last_error': None}, 'serverTime': 1}))
    elif file.is_relative_to((ROOT / 'dist').resolve()) and file.is_file():
        route.fulfill(path=str(file), content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
    else:
        route.fulfill(status=404, body='Missing')

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':390,'height':844}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script("""
      window.Capacitor={isNativePlatform:()=>true,Plugins:{
        YihuPush:{requestPermission:async()=>({granted:true}),register:async()=>({token:'fcm-'+('x'.repeat(80))}),consumeRoute:async()=>({route:''})},
        App:{addListener:()=>{}},Filesystem:{},Share:{}
      }};
    """)
    page.route('https://mack-blip-space.github.io/**', serve)
    page.route('https://yihu-ai-consult.1201wburbankblvd.workers.dev/api/push', serve)
    page.goto(ORIGIN + '#notifications')
    page.locator('[data-push="enable"]').click()
    page.get_by_text('通知已开启', exact=True).first.wait_for()
    prefs = page.evaluate("JSON.parse(localStorage.getItem('yihu-push-prefs-v1'))")
    assert prefs['enabled'] is True
    assert not page.get_by_text('咨询正文').count() == 0
    page.locator('[data-push="mute"]').click()
    page.get_by_text('已暂停8小时。', exact=True).wait_for()
    for width in (375,768,1024,1440):
        page.set_viewport_size({'width':width,'height':850})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors, errors
    print('Notification opt-in, mute, generic privacy copy and responsive layout passed.')
    browser.close()
