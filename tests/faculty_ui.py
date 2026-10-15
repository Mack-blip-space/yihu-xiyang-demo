from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=True)
 page=b.new_page(viewport={'width':390,'height':844})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4173')
 rows=page.evaluate('FACULTY.map(r=>({id:r.id,route:facultyRoute(r),kind:r.kind,images:r.images.length}))')
 for r in rows:
  page.goto('http://127.0.0.1:4173/#'+r['route'])
  expect(page.locator('.faculty-article')).to_have_count(1)
  expect(page.locator('.faculty-article img')).to_have_count(r['images'])
  page.locator('.faculty-article img').evaluate_all('(imgs)=>imgs.forEach(i=>i.loading="eager")')
  page.wait_for_function('Array.from(document.querySelectorAll(".faculty-article img")).every(i=>i.complete&&i.naturalWidth>0)')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),r['id']
  if r['kind']=='KT':
   page.locator('#quiz-form input[value="1"]').check();page.locator('#quiz-form button').click();expect(page.locator('#quiz-feedback')).to_contain_text('答对了')
 page.goto('http://127.0.0.1:4173/#lesson/KT01')
 page.locator('[data-faculty-image]').first.click();expect(page.locator('dialog img')).to_be_visible();page.get_by_role('button',name='关闭对话框').click()
 page.screenshot(path=str(root/'artifacts/v050-lesson.png'),full_page=True)
 for width in [320,768,1440]:
  page.set_viewport_size({'width':width,'height':900})
  for route in ['learn','ask','cases','guide/LJ04','path','article/QA07']:
   page.goto('http://127.0.0.1:4173/#'+route);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route)
 assert not errors,errors
 print(json.dumps({'records':len(rows),'images':sum(r['images'] for r in rows),'quizPassed':5,'errors':errors}))
 b.close()
