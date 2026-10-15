"""Read faculty DOCX submissions into a local-only review bundle. Originals stay untouched."""
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET
import hashlib, json, html, re

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'法学院交付资料'
OUT=ROOT/'.private'/'faculty-intake-2026-10-15'
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
LESSONS={'冒充客服退款':'KT01','养老理财':'KT02','冒充公检法':'KT03','保健品':'KT04','陌生链接':'KT05'}
OUT.mkdir(parents=True,exist_ok=True)
records=[]
for path in sorted(SOURCE.rglob('*.docx')):
    if path.name.startswith('~$'):continue
    relative=str(path.relative_to(SOURCE))
    match=re.search(r'(QA|AL|LJ)\d{2}',path.stem)
    identifier=match.group() if match else next(value for key,value in LESSONS.items() if key in path.stem)
    folder=OUT/'assets'/identifier
    folder.mkdir(parents=True,exist_ok=True)
    with ZipFile(path) as archive:
        document=ET.fromstring(archive.read('word/document.xml'))
        paragraphs=[''.join(node.text or '' for node in p.findall('.//w:t',NS)) for p in document.findall('.//w:p',NS)]
        text='\n'.join(paragraphs)
        media=[]
        for name in archive.namelist():
            if name.startswith('word/media/') and not name.endswith('/'):
                target=folder/Path(name).name
                target.write_bytes(archive.read(name))
                media.append(str(target.relative_to(OUT)).replace('\\','/'))
        links=[]
        if 'word/_rels/document.xml.rels' in archive.namelist():
            for rel in ET.fromstring(archive.read('word/_rels/document.xml.rels')):
                if rel.attrib.get('TargetMode')=='External':links.append(rel.attrib.get('Target',''))
        links+=re.findall(r'https?://[^\s<>]+',text)
        def field(label):
            found=re.search(r'^'+label+r'\s*[:：]\s*([^\n]*)',text,re.M)
            return found.group(1).strip() if found else ''
        record={'id':identifier,'source':relative,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'title':field('标题') or path.stem,'status':field('正文状态'),'author':field('作者'),'reviewer':field('审核人'),'reviewDate':field('审核日期'),'text':text,'media':media,'links':sorted(set(links))}
        records.append(record)
records.sort(key=lambda r:r['id'])
assert len(records)==22 and len({r['id'] for r in records})==22
(OUT/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
sections=[]
for r in records:
    warnings=[]
    if r['status']!='已审核':warnings.append('原稿仍待审核')
    if not r['links']:warnings.append('未提供可点击的来源链接')
    if '来源于网络' in r['text']:warnings.append('网络图片出处与授权待补充')
    if not r['reviewDate']:warnings.append('审核日期未填写')
    images=''.join(f'<figure><img loading="lazy" src="{html.escape(p)}" alt="{r["id"]} 原文内嵌素材，替代说明待作者补充"><figcaption>{html.escape(Path(p).name)}</figcaption></figure>' for p in r['media'])
    sections.append(f'<article id="{r["id"]}"><h2>{r["id"]} · {html.escape(r["title"])}</h2><p>原稿状态：{html.escape(r["status"])}；审核日期：{html.escape(r["reviewDate"] or "未填写")}</p><p class="warning">{html.escape("；".join(warnings) or "仍需核对来源与素材")}</p><details><summary>查看原文全文</summary><pre>{html.escape(r["text"])}</pre></details><div class="images">{images}</div><p class="source">原文件：{html.escape(r["source"])}</p></article>')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>益护夕阳 首批交付资料核对</title><style>body{font:18px/1.75 system-ui,sans-serif;margin:0;background:#f7f7f2;color:#203a32}main{max-width:1050px;margin:auto;padding:28px}h1{font-size:30px}h2{font-size:23px}article{background:white;border:1px solid #ccc;padding:22px;margin:24px 0;border-radius:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}input{box-sizing:border-box;width:100%;padding:14px;font:inherit}summary{cursor:pointer;font-weight:bold}.warning{color:#8a4200}.source{font-size:14px;overflow-wrap:anywhere}.images{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}figure{margin:16px 0}img{width:100%;height:auto}figcaption{font-size:14px}nav a{display:inline-block;padding:5px 12px}article[hidden]{display:none}</style><main><h1>益护夕阳 首批交付资料核对</h1><p>22 份原稿的本地阅读副本。仅供作者、审核人与框架负责人核对，未发布到 App 或 AI 知识库。正文与图片保留原稿含义，图片编号不代表漫画分镜顺序。</p><p>“已审核”是提交者在原稿填写的状态，不代表来源、法律结论或图片授权已经完成独立核验。标题编号按首批交接表映射；原稿编号保留在全文中。</p><label for="search">按编号、标题或正文搜索</label><input id="search" placeholder="例如 QA08、报警、图片来源"><p id="count">共22份资料</p>'''+''.join(sections)+'''</main><script>document.querySelector('#search').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();let n=0;document.querySelectorAll('article').forEach(a=>{a.hidden=!a.textContent.toLowerCase().includes(q);if(!a.hidden)n++});document.querySelector('#count').textContent='显示 '+n+' / 22 份资料';});</script></html>'''
(OUT/'index.html').write_text(page,encoding='utf-8')
print(json.dumps({'documents':len(records),'embeddedImages':sum(len(r['media']) for r in records),'submittedReviewed':sum(r['status']=='已审核' for r in records),'pendingReview':[r['id'] for r in records if r['status']!='已审核'],'withLinks':[r['id'] for r in records if r['links']]},ensure_ascii=False))
