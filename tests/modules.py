"""New module journeys and failure cases; all data is fictional, AI is intercepted."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
ROOT=Path(__file__).resolve().parents[1]
URL='http://127.0.0.1:4173'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL)
    page.wait_for_function('typeof db !== "undefined" && db !== null')
    assert page.evaluate('prefs.large') is True
    expect(page.locator('.module-hub .module-card')).to_have_count(5)
    page.goto(URL+'/#classroom')
    page.locator('.module-list [data-go^="lesson/"]').first.click()
    page.locator('#quiz-form input').first.check()
    page.get_by_role('button',name='检查答案').click()
    expect(page.locator('#quiz-feedback')).not_to_be_empty()
    page.goto(URL+'/#risk')
    for value in ['call','yes','yes','stranger']:
        page.locator(f'input[value="{value}"]').check()
        page.locator('#risk-form button[type=submit]').click()
    expect(page.locator('.feature-panel')).to_contain_text('诈骗疑虑')
    page.get_by_role('button',name='带着分类去记录').click()
    assert page.evaluate('draft.type')=='诈骗疑虑'
    page.goto(URL+'/#evidence')
    page.locator('[data-evidence-check=chat]').check()
    page.reload()
    expect(page.locator('[data-evidence-check=chat]')).to_be_checked()
    page.goto(URL+'/#guardians')
    page.locator('#guardian-form [name=name]').fill('虚构家人')
    page.locator('#guardian-form [name=phone]').fill('00000000000')
    page.get_by_role('button',name='保存到联系簿').click()
    page.reload()
    expect(page.locator('.contact-card')).to_contain_text('虚构家人')
    page.goto(URL+'/#emergency')
    expect(page.locator('a[href="tel:110"]')).to_be_visible()
    page.get_by_role('button',name='准备求助信息').click()
    expect(page.locator('dialog a[href^="sms:"]')).to_be_visible()
    page.get_by_role('button',name='关闭对话框').click()
    # Persisted snapshot keeps a separate copy and detects content changes.
    page.evaluate("snapshotRecord({id:'old-record',description:'虚构的原始经过',files:[{name:'test.txt',type:'text/plain',size:4,blob:new Blob(['test'])}]})")
    page.goto(URL+'/#vault')
    page.wait_for_function('vaultCache.length===1')
    page.get_by_role('button',name='查看与校验').click()
    page.get_by_role('button',name='核对完整性').click()
    expect(page.locator('#verify-status')).to_contain_text('一致')
    assert page.evaluate("verifySnapshot({...vaultCache[0],manifest:vaultCache[0].manifest+'changed'})") is False
    page.get_by_role('button',name='关闭对话框').click()
    page.reload()
    page.wait_for_function('vaultCache.length===1')
    page.goto(URL+'/#ask')
    page.locator('#faq-search-form input').fill('诉讼费')
    page.locator('#faq-search-form button').click()
    expect(page.locator('#faq-results .module-card')).to_have_count(1)
    page.locator('#ai-question-form textarea').fill('虚构测试：没有收到购买的服务，该整理什么材料？')
    page.locator('#ai-question-form input[type=checkbox]').check()
    page.get_by_role('button',name='向 AI 提问',exact=True).click()
    expect(page.locator('#ai-status')).to_contain_text('没有发送')
    assert page.evaluate('aiEndpoint()')=='https://yihu-ai-consult.1201wburbankblvd.workers.dev/api/consult'
    expect(page.locator('.ai-advanced')).to_have_count(0)
    page.locator('[name=credential]').fill('x'*43)
    page.get_by_role('button',name='开始体验').click()
    calls=[]
    def mock(route):
        calls.append(route.request.post_data_json)
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'answer':'<img src=x onerror=alert(1)> 这是测试回答。','knowledgeVersion':'2026-10-15','reviewedKnowledge':True,'references':[{'id':'QA07'}]}))
    page.route('https://yihu-ai-consult.1201wburbankblvd.workers.dev/api/consult',mock)
    page.get_by_role('button',name='向 AI 提问',exact=True).click()
    expect(page.locator('#ai-answer')).to_contain_text('AI 生成')
    expect(page.locator('#ai-answer img')).to_have_count(0)
    expect(page.locator('#ai-references [data-go="faq/QA07"]')).to_have_count(1)
    assert set(calls[0])=={'question','consent'}
    assert 'x'*43 not in page.evaluate('JSON.stringify(localStorage)')
    page.reload()
    assert page.evaluate('aiCredential')==''
    page.locator('[data-ai="clear"]').click()
    assert page.evaluate('aiEndpoint()')=='https://yihu-ai-consult.1201wburbankblvd.workers.dev/api/consult'
    assert page.evaluate("localStorage.getItem('yihu-ai-endpoint')") is None
    for width in [320,390,768,1440]:
        page.set_viewport_size({'width':width,'height':900})
        for route in ['home','classroom','lesson/KT03','risk','evidence','vault','ask','institutions','cases','policies','guardians','services','consultations']:
            page.goto(URL+'/#'+route)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'{width}/{route} overflow'
    page.set_viewport_size({'width':390,'height':844})
    for route in ['home','classroom','ask','institutions']:
        page.goto(URL+'/#'+route)
        page.screenshot(path=str(ROOT/'artifacts'/f'v04-{route}.png'),full_page=True)
    assert not errors,errors
    print(json.dumps({'result':'PASS','checks':['default large text','five modules','risk journey','checklist persistence','guardian persistence','emergency dial and SMS confirmation','snapshot hash and persistence','FAQ search','AI configuration and request isolation','AI escaping','no credential persistence','responsive layouts'],'consoleErrors':errors},ensure_ascii=False))
    browser.close()
