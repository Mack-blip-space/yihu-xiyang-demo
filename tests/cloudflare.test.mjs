import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createHandler,reserve,transportFailure} from '../cloud/cloudflare/worker.mjs';

function database(){
  const sql=new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../cloud/cloudflare/schema.sql',import.meta.url),'utf8'));
  return {prepare(query){return {bind(...args){return {async run(){return {success:true,meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}};}};
}
const token='test-only-credential-'.repeat(3), origin='https://mack-blip-space.github.io';
function environment(){return {AI_ENABLED:'true',ALLOWED_ORIGINS:origin,TESTER_TOKEN_HASHES:createHash('sha256').update(token).digest('hex'),DASHSCOPE_API_KEY:'test-model-key',DB:database()};}
function request(data={question:'如何整理合同纠纷材料？',consent:true},headers={}){
  return new Request('https://demo.account.workers.dev/api/consult',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
}
test('disabled, unauthorized, private input and missing database never call the model',async()=>{
  let calls=0;const handler=createHandler({fetcher:async()=>{calls++;throw Error('must not call');}});
  const cases=[ [request(),{AI_ENABLED:'false'},503], [request({}, {Origin:'https://evil.example'}),{},403], [request({}, {Authorization:'Bearer invalid'}),{},401], [request({question:'电话号码13812345678',consent:true}),{},400], [request({question:'如何整理材料？',consent:false}),{},400], [request(),{DB:null},503], [request({question:'长'.repeat(9000),consent:true}),{},413] ];
  for(const [req,overrides,status] of cases)assert.equal((await handler(req,{...environment(),...overrides})).status,status);
  assert.equal(calls,0);
});
test('health and preflight do not need a model key',async()=>{
  const handler=createHandler(),env={ALLOWED_ORIGINS:origin};
  assert.equal((await handler(new Request('https://demo.account.workers.dev/health'),env)).status,200);
  const reply=await handler(new Request('https://demo.account.workers.dev/api/consult',{method:'OPTIONS',headers:{Origin:origin}}),env);
  assert.equal(reply.status,204);assert.equal(reply.headers.get('Access-Control-Allow-Origin'),origin);
});
test('default transport preserves the global fetch receiver',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async function(){assert.equal(this,globalThis);return Response.json({choices:[{message:{content:'测试回答'}}]});};
  try{assert.equal((await createHandler()(request(),environment())).status,200);}finally{globalThis.fetch=original;}
});
test('only fixed model endpoint receives key, model parameters are server controlled',async()=>{
  const handler=createHandler({fetcher:async(url,options)=>{
    assert.equal(url,'https://maas.qianwenaiapi.com/compatible-mode/v1/chat/completions');
    assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer test-model-key');
    const body=JSON.parse(options.body);assert.equal(body.model,'qwen-plus');assert.equal(body.max_tokens,600);assert.equal(body.enable_thinking,false);
    return Response.json({choices:[{message:{content:'请先保存合同原件。'}}]});
  }});
  const response=await handler(request(),environment());assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.answer,'请先保存合同原件。');assert.equal(body.reviewedKnowledge,false);
});
test('upstream error does not disclose key or upstream response',async()=>{
  const handler=createHandler({fetcher:async()=>new Response('test-model-key upstream secret',{status:401})});
  const reply=await handler(request(),environment());assert.equal(reply.status,502);assert.doesNotMatch(await reply.text(),/test-model-key|upstream secret/);
});
test('redirect responses are rejected without a second request or disclosing location',async()=>{
  let calls=0;
  const handler=createHandler({fetcher:async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://untrusted.example/private'}});}});
  const response=await handler(request(),environment());assert.equal(response.status,502);const body=await response.text();assert.match(body,/UPSTREAM_REDIRECT/);assert.doesNotMatch(body,/untrusted|private|test-model-key/);assert.equal(calls,1);
});
test('database and model transport failures are distinguishable without leaking details',async()=>{
  let calls=0;
  const handler=createHandler({fetcher:async()=>{calls++;throw Error('secret upstream detail');}});
  const env=environment();env.DB={prepare(){throw Error('private database detail');}};
  const databaseReply=await handler(request(),env);
  assert.equal(databaseReply.status,503);const dbText=await databaseReply.text();assert.match(dbText,/数据库异常/);assert.doesNotMatch(dbText,/private database detail/);assert.equal(calls,0);
  const modelReply=await handler(request(),environment());assert.equal(modelReply.status,502);const modelText=await modelReply.text();assert.match(modelText,/诊断码 OTHER/);assert.doesNotMatch(modelText,/secret upstream detail/);
  const malformed=createHandler({fetcher:async()=>new Response('private non-JSON response')});
  const formatReply=await malformed(request(),environment());assert.equal(formatReply.status,502);assert.doesNotMatch(await formatReply.text(),/private non-JSON response/);
});
test('transport diagnostics expose only fixed codes and reject malformed key before model call',async()=>{
  for(const [message,code] of [['Illegal invocation secret','FETCH_CONTEXT'],['DNS resolution secret','DNS'],['Header invalid character secret','REQUEST_HEADER'],['AbortSignal.timeout is not a function secret','RUNTIME_API'],['SSL certificate secret','TLS']]){const result=transportFailure(new Error(message));assert.match(result.message,new RegExp(code));assert.doesNotMatch(result.message,/secret/);}
  let called=false;const handler=createHandler({fetcher:async()=>{called=true;}});
  const reply=await handler(request(),{...environment(),DASHSCOPE_API_KEY:'含中文或换行\n'});assert.equal(reply.status,503);assert.match(await reply.text(),/KEY_FORMAT/);assert.equal(called,false);
});
test('SQLite reservation enforces cooldown, daily user limit and China day rollover',async()=>{
  const db=database(),start=Date.parse('2026-10-13T00:00:00Z');
  await reserve(db,'a',start);await assert.rejects(reserve(db,'a',start+9999),{status:429});
  for(let i=1;i<10;i++)await reserve(db,'a',start+i*10000);
  await assert.rejects(reserve(db,'a',start+100000),{status:429});
  await reserve(db,'a',Date.parse('2026-10-13T16:00:00Z'));
});
test('concurrent reservations cannot exceed the global daily cap',async()=>{
  const db=database(),now=Date.parse('2026-10-13T00:00:00Z');
  const results=await Promise.allSettled(Array.from({length:120},(_,i)=>reserve(db,'user-'+i,now)));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,100);
  assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===429).length,20);
});
