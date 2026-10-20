const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(fetcher,online=true){
  const ctx=vm.createContext({URL,AbortController,setTimeout,clearTimeout,navigator:{onLine:online},fetch:fetcher,document:{addEventListener(){}}});
  vm.runInContext(fs.readFileSync('dist/ai.js','utf8'),ctx);return ctx;
}
const endpoint='https://yihu-ai-consult.1201wburbankblvd.workers.dev/api/consult';
test('connection check sends neither credential nor question and does not invoke model',async()=>{
  const calls=[];const c=setup(async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({service:'yihu-ai-pilot'})};});
  await c.aiCheckConnection(endpoint);
  assert.equal(calls.length,1);assert.equal(calls[0].url,endpoint.replace('/api/consult','/health'));
  assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.body,undefined);assert.equal(calls[0].options.headers,undefined);
});
test('offline prevents requests',async()=>{
  let called=false;const c=setup(async()=>{called=true;},false);
  await assert.rejects(c.aiCheckConnection(endpoint),/没有联网/);assert.equal(called,false);
});
test('unreachable and unrelated services produce a connection-specific error',async()=>{
  for(const fetcher of [async()=>{throw new TypeError('Failed to fetch');},async()=>({ok:true,json:async()=>({service:'other'})})]){
    const c=setup(fetcher);await assert.rejects(c.aiCheckConnection(endpoint),/尚未提交问题/);
  }
});
test('deadline covers slow body read without AbortSignal.timeout API',async()=>{
  const c=setup(async(url,{signal})=>({json:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))}));
  await assert.rejects(c.aiFetchJSON(endpoint,{},10),{name:'TimeoutError'});
});
test('successful request clears deadline and returns response',async()=>{
  const c=setup(async()=>({ok:true,json:async()=>({answer:'ok'})}));
  const {response,result}=await c.aiFetchJSON(endpoint,{},50);assert.equal(response.ok,true);assert.equal(result.answer,'ok');
});
