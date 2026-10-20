import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createServer,modelURL} from '../cloud/ecs/server.mjs';
test('ECS adapter preserves origin/auth, knowledge, persistent quota and isolates routes',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'yihu-ecs-'));
  const db=new DatabaseSync(join(dir,'usage.sqlite'));
  db.exec(readFileSync('cloud/cloudflare/schema.sql','utf8'));
  const token='t'.repeat(43),configPath=join(dir,'config.json');
  writeFileSync(configPath,JSON.stringify({AI_ENABLED:'true',DASHSCOPE_API_KEY:'test-only',MODEL_BASE_URL:'https://dashscope.aliyuncs.com/compatible-mode/v1',ALLOWED_ORIGINS:'https://localhost',TESTER_TOKEN_HASHES:createHash('sha256').update(token).digest('hex')}));
  let calls=0;
  const server=createServer({configPath,db,fetcher:async(url,opts)=>{
    calls++;assert.equal(url,'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    assert.ok(JSON.parse(opts.body).messages[0].content.includes('QA01'));
    return Response.json({choices:[{message:{content:'请暂停转账，保存已有记录，核实具体情况。'}}]});
  }});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const url='http://127.0.0.1:'+server.address().port;
  const headers={Origin:'https://localhost','Content-Type':'application/json',Authorization:'Bearer '+token};
  const ask=(h=headers)=>fetch(url+'/api/consult',{method:'POST',headers:h,body:JSON.stringify({question:'虚构问题：被骗后应该怎么办？',consent:true})});
  try{
    const health=await fetch(url+'/health',{headers:{Origin:'https://localhost'}});assert.equal(health.headers.get('Access-Control-Allow-Origin'),'https://localhost');assert.equal((await health.json()).hosting,'ecs');
    assert.equal((await ask({...headers,Origin:'https://evil.example'})).status,403);
    assert.equal((await ask({...headers,Authorization:'Bearer '+ 'x'.repeat(43)})).status,401);
    assert.equal(calls,0);
    const response=await ask();assert.equal(response.status,200);assert.equal((await response.json()).knowledgeVersion,'2026-10-15');
    assert.equal((await ask()).status,429);assert.equal(calls,1);
    assert.equal(db.prepare('select count(*) n from yihu_ai_usage').get().n,1);
    assert.equal((await fetch(url+'/api/family')).status,404);
    assert.equal((await fetch(url+'/private/config.json')).status,404);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true});}
});
test('model URL is restricted to explicit providers',()=>{
  assert.equal(modelURL('https://ws-ser0h03wwlgrovt5.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'),'https://ws-ser0h03wwlgrovt5.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.throws(()=>modelURL('https://evil.example'));
  assert.throws(()=>modelURL('https://dashscope.aliyuncs.com.evil.example/compatible-mode/v1'));
});
