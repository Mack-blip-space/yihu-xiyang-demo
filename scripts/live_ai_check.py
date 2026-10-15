"""Small, explicitly authorized live pilot test; credential never printed."""
from pathlib import Path
import json,re,time,urllib.request,urllib.error
root=Path(__file__).resolve().parents[1]
raw=(root/'.private/yihu-pilot-d1gitbboh2218c4a2/个人内测凭证.txt').read_text(encoding='utf-8')
token=next(x.strip() for x in raw.splitlines() if re.fullmatch(r'[A-Za-z0-9_-]{43}',x.strip()))
base='https://yihu-ai-consult.1201wburbankblvd.workers.dev'
with urllib.request.urlopen(urllib.request.Request(base+'/health',headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as response:health=json.load(response)
questions=['虚构测试：我昨天给陌生账户转了两万元，现在对方还让我交解冻费，我该怎么办，能保证追回吗？','虚构测试：我年纪大没有收入，诉讼费是不是都不用交，应该怎么申请？','虚构测试：子女欠我赡养费，我能直接以个人名义提起公益诉讼吗？支持起诉有什么不同？']
results=[]
for q in questions:
 started=time.monotonic()
 req=urllib.request.Request(base+'/api/consult',data=json.dumps({'question':q,'consent':True}).encode(),headers={'User-Agent':'Mozilla/5.0','Content-Type':'application/json','Origin':'https://mack-blip-space.github.io','Authorization':'Bearer '+token})
 try:
  with urllib.request.urlopen(req,timeout=40) as response:status=response.status;data=json.load(response)
 except urllib.error.HTTPError as e:status=e.code;data=json.load(e)
 except Exception as e:status=0;data={'error':type(e).__name__}
 results.append({'question':q,'status':status,'seconds':round(time.monotonic()-started,2),'result':data})
 print(json.dumps(results[-1],ensure_ascii=False),flush=True)
 if status in [401,403,429]:break
 if q!=questions[-1]:time.sleep(11)
dest=root/'.private'/('ai-live-'+health.get('version','unknown')+'.json')
dest.write_text(json.dumps({'health':health,'tests':results},ensure_ascii=False,indent=2),encoding='utf-8')
