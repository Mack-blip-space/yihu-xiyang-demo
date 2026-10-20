import http from 'node:http';
import {readFileSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createHandler} from '../cloudflare/worker.mjs';

export function sqliteAdapter(sqlite){
  return {prepare(sql){return {bind(...values){return {async run(){
    const params=Object.fromEntries(values.map((value,i)=>[String(i+1),value]));
    const result=sqlite.prepare(sql).run(params);
    return {success:true,meta:{changes:Number(result.changes)}};
  }}}}}};
}
export function modelURL(base){
  const allowed=['https://ws-ser0h03wwlgrovt5.cn-beijing.maas.aliyuncs.com/compatible-mode/v1','https://dashscope.aliyuncs.com/compatible-mode/v1','https://dashscope-intl.aliyuncs.com/compatible-mode/v1','https://maas.qianwenaiapi.com/compatible-mode/v1'];
  if(!allowed.includes(base))throw Error('MODEL_URL_NOT_ALLOWED');
  return base+'/chat/completions';
}
export function createServer({configPath,db,fetcher=globalThis.fetch}={}){
  return http.createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      if(!['/api/consult','/health'].includes(path)){send(404,{error:'接口地址不存在'});return;}
      const config=JSON.parse(readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
      const url=modelURL(config.MODEL_BASE_URL);
      // Single service, single SQLite ledger; questions and answers are never persisted.
      const handler=createHandler({fetcher:(_url,options)=>fetcher(url,options)});
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>8192){send(413,{error:'问题过长'});return;}chunks.push(chunk);}
      const request=new Request('https://localhost'+path,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
      const response=await handler(request,{...config,DB:sqliteAdapter(db)});
      let body=await response.text();
      if(path==='/health'&&response.ok){const data=JSON.parse(body);body=JSON.stringify({...data,version:'0.9.3',tickets:false,push:false,hosting:'ecs',aiConfigured:config.AI_ENABLED==='true'&&!!config.DASHSCOPE_API_KEY});}
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(body);
    }catch{send(503,{error:'咨询服务配置尚未完成，请联系负责人。'});}
  });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const root=dirname(fileURLToPath(import.meta.url));
  const privateDir=join(root,'private');mkdirSync(privateDir,{recursive:true});
  const db=new DatabaseSync(join(privateDir,'usage.sqlite'));
  db.exec(readFileSync(join(root,'../cloudflare/schema.sql'),'utf8'));
  const server=createServer({configPath:join(privateDir,'config.json'),db});
  server.requestTimeout=15000;server.headersTimeout=10000;
  server.listen(3187,'127.0.0.1',()=>console.log('Yihu AI listening on loopback:3187'));
}
