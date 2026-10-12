"""V0.2 UI / persistence / speech scheduling checks. All posts are fictional."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
import os

root = Path(__file__).resolve().parents[1]
out = root / 'artifacts'
out.mkdir(exist_ok=True)
url = os.environ.get('YIHU_TEST_URL', 'http://127.0.0.1:4173')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
    ctx = browser.new_context(viewport={'width':390,'height':844}, reduced_motion='reduce')
    page = ctx.new_page()
    errors = []
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto(url)
    page.wait_for_function('db !== null')
    page.get_by_role('button',name='12315 消费者投诉举报',exact=True).click()
    expect(page.locator('dialog a[href="tel:12315"]')).to_be_visible()
    page.get_by_role('button',name='关闭对话框').click()
    page.get_by_role('button',name='12348 公共法律服务热线',exact=True).click()
    expect(page.locator('dialog a[href="tel:12348"]')).to_be_visible()
    page.get_by_role('button',name='关闭对话框').click()
    page.screenshot(path=str(out/'v02-mobile-home.png'),full_page=True)
    page.get_by_role('button',name='去看看').click()
    expect(page.locator('.story-card')).to_have_count(3)
    page.get_by_role('button',name='分享我的经历').click()
    page.locator('[name=title]').fill('一个虚构的防骗经历')
    page.locator('[name=body]').fill('【虚构测试】请联系 13800138000。')
    page.get_by_role('button',name='匿名保存到本机').click()
    expect(page.locator('#story-error')).to_contain_text('隐去')
    page.locator('[name=body]').fill('【虚构测试】我把遇到的事情写下来，与家人一起商量。<img src=x onerror="window.xss=1">')
    page.get_by_role('button',name='匿名保存到本机').click()
    expect(page.get_by_role('heading',name='一个虚构的防骗经历')).to_be_visible()
    assert page.evaluate('window.xss') is None
    assert page.locator('.story-text img').count()==0
    story_url=page.url
    page.reload()
    expect(page.get_by_role('heading',name='一个虚构的防骗经历')).to_be_visible()
    page.locator('[name=comment]').fill('【虚构评论】慢慢来，先把事情记录清楚。')
    page.get_by_role('button',name='匿名留言到本机').click()
    page.reload()
    expect(page.locator('.comment')).to_have_count(1)
    expect(page.locator('.comment')).to_contain_text('慢慢来')
    page.get_by_role('button',name='删除这条评论').click()
    page.get_by_role('button',name='保留评论').click()
    expect(page.locator('.comment')).to_have_count(1)
    page.get_by_role('button',name='删除这条评论').click()
    page.get_by_role('button',name='确认删除评论').click()
    expect(page.locator('.comment')).to_have_count(0)
    page.goto(url+'/#stories')
    page.screenshot(path=str(out/'v02-stories.png'),full_page=True)
    page.get_by_role('button',name='日常心声',exact=True).click()
    expect(page.locator('.story-card')).to_have_count(1)
    other=browser.new_context()
    fresh=other.new_page()
    fresh.goto(url+'/#stories')
    expect(fresh.locator('.story-card')).to_have_count(3)
    other.close()
    page.goto(story_url)
    page.get_by_role('button',name='删除我的分享').click()
    page.get_by_role('button',name='确认删除分享').click()
    page.reload()
    expect(page.locator('.story-card')).to_have_count(3)
    page.goto(url+'/#home')
    page.evaluate('prefs.large=true;savePrefs();render()')
    assert page.evaluate('getComputedStyle(document.querySelector(".intro p")).fontSize')>='20px'
    for width in [320,390,768,1440]:
        page.set_viewport_size({'width':width,'height':900})
        for route in ['home','stories','story-new','story/example-call','mine','learn','article/public','report']:
            page.goto(url+'/#'+route)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{width}/{route} overflow'
    page.set_viewport_size({'width':390,'height':844})
    page.goto(url+'/#article/public')
    assert page.locator('.article-body section p').first.evaluate('(e)=>getComputedStyle(e).fontSize')=='26px'
    page.screenshot(path=str(out/'v02-large-article.png'),full_page=True)
    page.goto(url+'/#home')
    page.screenshot(path=str(out/'v02-large-home.png'),full_page=True)

    for route in ['home','mine','article/phone']:
        page.goto(url+'/#'+route)
        expect(page.locator('[data-action=read], [data-feature^=voice-]')).to_have_count(0)
        expect(page.locator('audio')).to_have_count(0)
    assert not errors,errors
    print(json.dumps({'result':'PASS','errors':errors,'checks':['hotlines','anonymous posts/comments','persistence and isolation','escaping','large font layouts','browser narration removed']},ensure_ascii=False))
    browser.close()
