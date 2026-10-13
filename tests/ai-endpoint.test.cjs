const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const context=vm.createContext({URL,document:{addEventListener(){}}});
vm.runInContext(fs.readFileSync('dist/ai.js','utf8'),context);
test('allows project Worker and legacy CloudBase; rejects other origins and credentials',()=>{
  const base='https://yihu-ai-consult.1201wburbankblvd.workers.dev';
  for(const value of [base+'/api/consult','https://demo.app.tcloudbase.com/ai'])assert.equal(context.validAIEndpoint(value),true,value);
  for(const value of [base+'/health',base+'/api/consult?key=secret',base+'/api/consult#key',base.replace('https:','http:')+'/api/consult',base.replace('https://','https://user:pass@')+'/api/consult',base.replace('.dev','.dev.evil.example')+'/api/consult','https://other.account.workers.dev/api/consult',base+':444/api/consult'])assert.equal(context.validAIEndpoint(value),false,value);
});
