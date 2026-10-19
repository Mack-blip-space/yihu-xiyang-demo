"""Regression checks for the six V0.9.2 usability fixes. Network responses are fixtures."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright, expect
import json, mimetypes

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'http://127.0.0.1:4173/'
calls = []
fail_submit = True
def serve(route):
    url = route.request.url
    if 'workers.dev' in url:
        data = route.request.post_data_json or {}
        calls.append(data)
        if url.endswith('/api/consult'):
            route.fulfill(json={'answer':'这是虚构测试回答，请核实具体情况。','knowledgeVersion':'2026-10-15','references':[]})
        elif data.get('action') == 'create':
            if fail_submit:
                route.fulfill(status=503, json={'error':'测试：暂时无法提交'})
            else:
                route.fulfill(json={'ticket':{'id':'test-ticket','code':'TEST-1','category':data['category'],'question':data['question'],'status':'pending','created_ms':1,'updated_ms':1,'messages':[]}})
        else:
            route.fulfill(json={'tickets':[]})
        return
    path = unquote(urlparse(url).path).lstrip('/') or 'index.html'
    file = (ROOT/'dist'/path).resolve()
    if file.is_relative_to((ROOT/'dist').resolve()) and file.is_file():
        route.fulfill(path=str(file), content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
    else:
        route.abort()

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':390,'height':844}, reduced_motion='reduce')
    page.route('**/*', serve)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(ORIGIN)
    page.wait_for_function('db!==null')
    expect(page.locator('.lesson[data-go^="lesson/"]')).to_have_attribute('data-go',page.evaluate('"lesson/"+todayLesson().id'))
    home_y = page.locator('.home-primary-actions').bounding_box()['y']
    assert home_y < 700, home_y
    page.goto(ORIGIN+'#ask')
    assert page.locator('#ai-question-form textarea').bounding_box()['y'] < 600
    expect(page.locator('#faq-results .module-card')).to_have_count(3)
    page.locator('[data-faq-expand]').click()
    expect(page.locator('#faq-results .module-card')).to_have_count(10)
    page.locator('[data-faq-expand]').click()
    expect(page.locator('#faq-results .module-card')).to_have_count(3)
    question='虚构问题：收到陌生投资邀请，应该如何核实？'
    page.locator('#ai-question-form textarea').fill(question)
    page.locator('#ai-question-form [name=consent]').check()
    page.locator('.top-actions [data-action=font]').click()
    expect(page.locator('#ai-question-form textarea')).to_have_value(question)
    expect(page.locator('#ai-question-form [name=consent]')).to_be_checked()
    page.goto(ORIGIN+'#mine');page.goto(ORIGIN+'#ask')
    expect(page.locator('#ai-question-form textarea')).to_have_value(question)
    page.locator('[name=credential]').fill('x'*43)
    page.get_by_role('button',name='开始体验',exact=True).click()
    page.get_by_role('button',name='向 AI 提问',exact=True).click()
    expect(page.locator('#ai-answer')).to_contain_text('虚构测试回答')
    assert calls[-1]['question']==question
    for query in ['我买的东西一直没收到怎么办','商家不发货怎么办','收货']:
        page.locator('#faq-search-form input').fill(query)
        page.locator('#faq-search-form button').click()
        expect(page.locator('#faq-results [data-go="faq/QA03"]')).to_be_visible()
    page.locator('#faq-search-form input').fill('虚构的未收录问题')
    page.locator('#faq-search-form button').click()
    page.locator('[data-faq-ai]').click()
    expect(page.locator('#ai-question-form textarea')).to_have_value('虚构的未收录问题')
    page.goto(ORIGIN+'#consultations')
    page.evaluate('consultationToken(true);ticketChecked=Date.now()')
    page.locator('[name=category]').select_option('投资理财')
    page.locator('[name=question]').fill(question)
    page.locator('[name=pilot]').fill('x'*43)
    page.locator('[name=consent]').check()
    page.locator('[name=question]').focus()
    page.evaluate('refreshTickets()')
    expect(page.locator('[name=question]')).to_be_focused()
    expect(page.locator('[name=question]')).to_have_value(question)
    expect(page.locator('[name=category]')).to_have_value('投资理财')
    expect(page.locator('[name=pilot]')).to_have_value('x'*43)
    page.locator('.top-actions [data-action=font]').click()
    expect(page.locator('[name=question]')).to_have_value(question)
    expect(page.locator('[name=consent]')).to_be_checked()
    page.locator('#consultation-submit-form button[type=submit]').click()
    expect(page.locator('#ticket-form-error')).to_contain_text('暂时无法提交')
    expect(page.locator('[name=question]')).to_have_value(question)
    page.goto(ORIGIN+'#feedback')
    expect(page.locator('[name=question]')).to_have_value('')
    expect(page.locator('[name=category]')).to_have_value('使用反馈')
    expect(page.locator('#consultation-submit-form button[type=submit]')).to_have_text('提交使用反馈')
    page.locator('[name=question]').fill('虚构反馈：页面按钮文字看不清楚，希望调整。')
    page.goto(ORIGIN+'#consultations')
    expect(page.locator('[name=question]')).to_have_value(question)
    fail_submit=False
    page.locator('#consultation-submit-form button[type=submit]').click()
    page.wait_for_url('**/#ticket/test-ticket')
    page.locator('#ticket-followup-form textarea').fill('虚构补充：尚未付款。')
    page.locator('.top-actions [data-action=font]').click()
    expect(page.locator('#ticket-followup-form textarea')).to_have_value('虚构补充：尚未付款。')
    page.goto(ORIGIN+'#consultations')
    expect(page.locator('[name=question]')).to_have_value('')
    page.goto(ORIGIN+'#feedback')
    expect(page.locator('[name=question]')).to_contain_text('虚构反馈')
    assert 'x'*43 not in page.evaluate('JSON.stringify(localStorage)+JSON.stringify(sessionStorage)')
    page.goto(ORIGIN+'#mine')
    expect(page.locator('[data-go=demo-status]')).to_have_count(0)
    page.locator('[data-action=about]').click()
    page.locator('.management-entry summary').click()
    page.locator('dialog [data-go=demo-status]').click()
    expect(page.locator('dialog')).not_to_be_visible()
    expect(page.locator('h1')).to_have_text('服务管理')
    page.locator('#ai-endpoint-form [name=endpoint]').fill('https://example.com/invalid')
    page.locator('#ai-endpoint-form button').click()
    expect(page.locator('#endpoint-status')).to_contain_text('地址无效')
    assert page.evaluate('aiEndpoint()===DEFAULT_AI_ENDPOINT')
    for width in [320,390,768,1440]:
        page.set_viewport_size({'width':width,'height':900})
        for route in ['home','ask','mine','feedback','consultations','demo-status']:
            page.goto(ORIGIN+'#'+route)
            for large in [False,True]:
                page.evaluate('(large)=>{prefs.large=large;render()}',large)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route,large)
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('prefs.large=true;render();clearTimeout(toastTimer);document.querySelector("#toast").style.display="none"')
    for route in ['home','ask']:
        page.goto(ORIGIN+'#'+route)
        page.screenshot(path=str(ROOT/'artifacts'/('v0.9.2-'+route+'.png')),animations='disabled')
    assert not errors,errors
    browser.close()
print(json.dumps({'result':'PASS','homePrimaryY':home_y,'checks':'drafts, refresh focus, failures, separation, submit clearing, search, layout, management, no stored credentials'},ensure_ascii=False))
