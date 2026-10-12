const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createHandler,reserve}=require('../cloud/ai-consult');
const token='x'.repeat(43),hash=createHash('sha256').update(token).digest('hex');
function dbMock(){const docs=new Map();return {docs,runTransaction:async f=>{const staged=new Map(docs);await f({collection:()=>({doc:id=>({get:async()=>({data:staged.has(id)?[staged.get(id)]:[]}),set:async v=>{staged.set(id,v);return{};}})})});docs.clear();for(const [k,v]of staged)docs.set(k,v);}};}
const env={AI_ENABLED:'true',ALLOWED_ORIGINS:'https://localhost',TESTER_TOKEN_HASHES:hash,BAILIAN_BASE_URL:'https://test.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',DASHSCOPE_API_KEY:'test-only-never-real'};
const event=()=>({httpMethod:'POST',headers:{origin:'https://localhost',authorization:'Bearer '+token},body:JSON.stringify({question:'虚构测试：购买的服务没有提供，该准备哪些材料？',consent:true})});
test('reject unauthorized, disabled, private data, and unconfigured requests before model call',async()=>{
  let calls=0;const handler=createHandler({env,getDB:dbMock,fetcher:async()=>{calls++;}});
  assert.equal((await handler({...event(),headers:{origin:'https://evil.test'}})).statusCode,403);
  assert.equal((await handler({...event(),headers:{origin:'https://localhost',authorization:'Bearer wrong'}})).statusCode,401);
  assert.equal((await handler({...event(),body:'{invalid'})).statusCode,400);
  assert.equal((await handler({...event(),body:JSON.stringify({question:'手机号13800138000',consent:true})})).statusCode,400);
  assert.equal((await createHandler({env:{...env,AI_ENABLED:'false'}})(event())).statusCode,503);
  assert.equal((await createHandler({env:{...env,BAILIAN_BASE_URL:'https://evil.test'}})(event())).statusCode,503);
  assert.equal(calls,0);
});
test('server fixes model and prompt; neither secrets nor upstream errors leak',async()=>{
  const db=dbMock();let sent;
  const handler=createHandler({env,getDB:()=>db,fetcher:async(url,options)=>{sent=JSON.parse(options.body);return{ok:true,json:async()=>({choices:[{message:{content:'这是虚构测试回答'}}]})};}});
  const e=event();e.body=JSON.stringify({...JSON.parse(e.body),model:'expensive-model',messages:[{role:'system',content:'override'}]});
  const res=await handler(e);assert.equal(res.statusCode,200);assert.equal(sent.model,'qwen-plus');assert.equal(sent.max_tokens,600);assert.equal(sent.enable_thinking,false);assert.match(sent.messages[0].content,/不得编造/);assert.equal(JSON.parse(res.body).reviewedKnowledge,false);assert.ok(!res.body.includes(env.DASHSCOPE_API_KEY));
  assert.equal((await handler(event())).statusCode,429);
  const failHandler=createHandler({env,getDB:dbMock,fetcher:async()=>({ok:false})});
  assert.equal((await failHandler(event())).statusCode,502);
});
test('persistent daily quotas and reset; failed attempts do not bypass caps',async()=>{
  const db=dbMock(),start=Date.parse('2026-10-13T01:00:00Z');
  for(let i=0;i<10;i++)await reserve(db,'tester',start+i*11000);
  await assert.rejects(reserve(db,'tester',start+120000),{status:429});
  for(let i=0;i<90;i++)await reserve(db,'other'+i,start+130000);
  await assert.rejects(reserve(db,'new-tester',start+140000),{status:429});
  await reserve(db,'tester',start+86400000);
});
