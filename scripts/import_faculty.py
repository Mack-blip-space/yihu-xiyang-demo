"""Build versioned app/AI content from the immutable local faculty intake."""
from pathlib import Path
import json,re
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
INTAKE=ROOT/'.private/faculty-intake-2026-10-15'
records=json.loads((INTAKE/'manifest.json').read_text(encoding='utf-8'))
out=[]
starts={'KT':'场景开头','QA':'二、','AL':'事实经过','LJ':'适用的问题类型'}
headings=['场景开头','骗子常说的话','危险信号','现在可以做的事','遇到紧急情况时怎么处理','事实经过','争议或侵权问题','实际处理过程及结果','对老人的实用提醒','与其他案件不能直接类比的条件','可类比的情形','适用的问题类型','先确认的条件','第一步','第二步','第三步','紧急情形如何分流','不适用或不属于该机构职责的情形','具体渠道及官方核验来源','费用、期限等是否因地区或个案而异','该路径与其他路径的衔接和区别']
for r in records:
    kind=r['id'][:2];text=r['text'];lines=[x.strip() for x in text.splitlines() if x.strip()]
    def field(name):
        m=re.search(r'^'+name+r'\s*[:：]\s*(.*)',text,re.M)
        return m.group(1).strip() if m else ''
    begin=next(i for i,x in enumerate(lines) if x.startswith(starts[kind]))
    body=lines[begin:];sections=[];current=None
    for line in body:
        if line.startswith(('漫画分镜','AI 测试问法','AI测试问法','脱敏处理说明','配图文件名','真人录音稿')):break
        match=re.match(r'^[一二三四五六七八九十]+、([^：:]+)[:：]?(.*)',line)
        h=next((h for h in headings if line.startswith(h)),None)
        if match:
            current={'heading':match[1],'text':match[2]};sections.append(current)
        elif h:
            if ':' in line or '：' in line:
                title,_,tail=re.split('([:：])',line,maxsplit=1)
            else:title,tail=line,''
            current={'heading':title,'text':tail};sections.append(current)
        else:
            if current is None:current={'heading':'正文','text':''};sections.append(current)
            current['text']+=('\n' if current['text'] else '')+line
    # Preserve faculty wording; remove broken export residue, not substantive legal text.
    for s in sections:s['text']=s['text'].replace('中华人民共...。','').strip()
    images=[]
    for i,src in enumerate(r['media']):
        target=f'assets/faculty/{r["id"]}-{i+1}.webp'
        dest=ROOT/'dist'/target;dest.parent.mkdir(parents=True,exist_ok=True)
        with Image.open(INTAKE/src) as im:
            im=im.convert('RGB');im.thumbnail((1800,2400));im.save(dest,'WEBP',quality=88)
        images.append({'src':target,'alt':f'{r["title"]}配图 {i+1}','credit':'情景示意'})
    quiz=None
    if kind=='KT':
        q=re.search(r'小测题干\s*[:：]?\s*(.*?)\n选项',text,re.S)
        choices=re.findall(r'选项\s*([ABC])\s*[:：]\s*(.*?)(?=选项\s*[ABC]|\n|$)',text)
        answer=re.search(r'正确选项及解释\s*[:：]?\s*(.*?)(?:真人录音稿|$)',text,re.S)
        if q and choices and answer:
            selected=re.search(r'[选项答案为是：:\s]*([ABC])',answer[1])
            quiz={'question':q[1].strip(),'choices':[v for k,v in choices],'answer':next((i for i,(k,v) in enumerate(choices) if selected and k==selected[1]),0),'explain':answer[1].strip()}
    title=r['title'].lstrip(':： ').strip()
    if r['id']=='KT02':title='养老理财“保本高收益”'
    out.append({'id':r['id'],'kind':kind,'title':title,'summary':field('一句话摘要'),'sections':sections,'images':images,'quiz':quiz,'source':next((u for u in r['links'] if u.startswith('https://')),''),'sourceName':field('来源名称与发布机构'),'author':r['author'],'reviewer':r['reviewer'],'reviewStatus':'已审核','approvalBasis':'项目负责人于2026-10-15确认全部审核完成','sourceSha256':r['sha256']})
assert len(out)==22 and all(r['sections'] for r in out)
(ROOT/'dist/faculty-data.js').write_text('/* Faculty-reviewed edition; originals remain local. */\nwindow.YIHU_FACULTY='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
# Same reviewed text on server; clients cannot submit or override retrieval context.
kb=[{k:r[k] for k in ['id','kind','title','summary','sections','source']} for r in out]
(ROOT/'cloud/cloudflare/knowledge.mjs').write_text('export const KNOWLEDGE='+json.dumps(kb,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print(f'Imported {len(out)} reviewed records, {sum(len(r["images"]) for r in out)} images; quizzes: {sum(bool(r["quiz"]) for r in out)}')
