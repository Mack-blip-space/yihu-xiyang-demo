"""Shared mobile behavior tests. Native plugins are mocked, not a real device test."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json, hashlib, zipfile, csv
ROOT=Path(__file__).resolve().parents[1]
URL='http://127.0.0.1:4173'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script('''window.nativeCalls=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{
      App:{addListener:(name,callback)=>{window.nativeBack=callback;},minimizeApp:()=>window.nativeCalls.push('minimize')},
      Filesystem:{writeFile:async args=>{window.savedFile=args;return {uri:'file:///cache/test.txt'};}},
      Share:{share:async args=>{window.shareArgs=args;}}
    }};''')
    page.goto(URL)
    page.wait_for_function('db !== null && typeof nativeBack === "function"')
    page.goto(URL+'/#article/phone')
    page.evaluate('nativeBack()')
    expect(page.locator('h1')).to_contain_text('学一点法律')
    page.goto(URL+'/#report')
    page.get_by_role('button',name='填入演示情景').click()
    page.get_by_role('button',name='下一步',exact=True).click()
    page.evaluate('nativeBack()')
    assert page.evaluate('step')==0
    page.goto(URL+'/#home')
    page.get_by_role('button',name='12315 消费者投诉举报',exact=True).click()
    page.evaluate('nativeBack()')
    expect(page.locator('dialog')).not_to_be_visible()
    page.evaluate('nativeBack()')
    assert page.evaluate('nativeCalls')==['minimize']
    page.evaluate("exportNativeFile(new Blob(['测试'],{type:'text/plain'}),'记录.txt')")
    assert page.evaluate('savedFile.directory')=='CACHE'
    assert page.evaluate('shareArgs.files[0]')=='file:///cache/test.txt'
    assert page.evaluate("atob(savedFile.data).length")>0
    page.evaluate("Capacitor.Plugins.Share.share=async()=>{throw new Error('cancelled')}; exportNativeFile(new Blob(['x']),'a.txt')")
    expect(page.locator('#toast')).to_contain_text('原记录和附件仍保存在本机')
    # Future recorded media: reject paths that escape the app assets and hide unreviewed audio.
    assert page.evaluate("contentAsset('../private.mp3','audio')")==''
    assert page.evaluate("contentAsset('https://example.com/a.mp3','audio')")==''
    assert page.evaluate("articleMedia({audio:{src:'assets/audio/test.mp3',reviewed:false,kind:'human'}})") == ''
    page.goto(URL+'/#article/phone')
    page.evaluate("C.articles[0].audio={src:'assets/audio/missing.mp3',kind:'human',credit:'测试录音',reviewed:true};render()")
    expect(page.locator('.article-audio')).to_contain_text('真人录制')
    page.evaluate("document.querySelector('audio').dispatchEvent(new Event('error'))")
    expect(page.locator('.audio-error')).to_be_visible()
    page.evaluate("delete C.articles[0].audio; render()")
    expect(page.locator('audio')).to_have_count(0)
    page.screenshot(path=str(ROOT/'artifacts/v03-mobile-article.png'),full_page=True)
    page.goto(URL+'/#home')
    page.screenshot(path=str(ROOT/'artifacts/v03-mobile-home.png'),full_page=True)
    # Local handoff files render cleanly at desktop and mobile widths.
    page.goto((ROOT/'交接材料/法学院内容与素材交接说明.html').as_uri())
    expect(page.locator('h1')).to_contain_text('交接说明')
    assert page.locator('h2').count()==11
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.set_viewport_size({'width':1200,'height':1000})
    page.screenshot(path=str(ROOT/'artifacts/v03-handoff.png'))
    page.goto((ROOT/'益护夕阳-双击体验.html').as_uri())
    expect(page.get_by_role('button',name='我要维权',exact=True)).to_be_visible()
    assert page.locator('script[src]').count()==0
    assert not errors,errors
    browser.close()
apk=ROOT/'releases/益护夕阳-v0.4-安卓体验版.apk'
expected=(ROOT/'releases/SHA256SUMS.txt').read_text().split()[0]
assert hashlib.sha256(apk.read_bytes()).hexdigest()==expected
with zipfile.ZipFile(apk) as z:
    assert z.read('assets/public/app.js')==(ROOT/'dist/app.js').read_bytes()
    assert z.read('assets/public/mobile.js')==(ROOT/'dist/mobile.js').read_bytes()
    plugins=json.loads(z.read('assets/capacitor.plugins.json'))
    assert {x['pkg'] for x in plugins}=={'@capacitor/app','@capacitor/filesystem','@capacitor/share','@capacitor/local-notifications'}
print(json.dumps({'result':'PASS','native':'mocked plugin contracts only','apkSHA256':expected,'checks':['back navigation','export and cancellation','optional audio gating','audio failure message','handoff layout','standalone HTML','downloaded APK matches source']},ensure_ascii=False))
