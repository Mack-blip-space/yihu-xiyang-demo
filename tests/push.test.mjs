import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {familyAction} from '../cloud/cloudflare/family.mjs';
import {pushAction,notifyAction} from '../cloud/cloudflare/push.mjs';
import {createHandler} from '../cloud/cloudflare/worker.mjs';

const owner='a'.repeat(64),guardian='b'.repeat(64),pilot='push-pilot-'.repeat(5),operator='push-operator-'.repeat(4),now=1800000000000;
function environment(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of ['family-schema.sql','ticket-schema.sql','push-schema.sql'])sql.exec(readFileSync(new URL('../cloud/cloudflare/'+file,import.meta.url),'utf8'));
 const db={prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null;},async all(){return {success:true,results:sql.prepare(query).all(...args)};},async run(){return {success:true,meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}};},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out;}catch(error){sql.exec('ROLLBACK');throw error;}}};
 return {DB:db,TESTER_TOKEN_HASHES:createHash('sha256').update(pilot).digest('hex'),OPERATOR_TOKEN_HASHES:createHash('sha256').update(operator).digest('hex'),ALLOWED_ORIGINS:'https://mack-blip-space.github.io'};
}
async function pair(env){await familyAction({action:'create',pilot,consent:true},owner,env,now);const invitation=await familyAction({action:'invite'},owner,env,now);await familyAction({action:'join',invite:invitation.invite,consent:true},guardian,env,now+1);}
const subscription={action:'subscribe',kind:'ticket',installationId:crypto.randomUUID(),fcmToken:'fcm-token-'+('x'.repeat(80))};

test('ticket notification subscription is opt-in, can be disabled and exposes no token',async()=>{
 const env=environment();let result=await pushAction(subscription,owner,'',env,fetch,now);assert.equal(result.subscription.enabled,1);assert.equal(JSON.stringify(result).includes('fcm-token'),false);
 result=await pushAction({...subscription,action:'disable'},owner,'',env,fetch,now+1);assert.equal(result.subscription.enabled,0);
 await pushAction(subscription,owner,'',env,fetch,now+2);result=await pushAction({...subscription,action:'disable-all'},'', '',env,fetch,now+3);assert.equal(result.disabled,true);assert.equal((await pushAction({...subscription,action:'status'},owner,'',env)).subscription.enabled,0);
});

test('family subscriptions require an existing circle and operator subscriptions require a separate credential',async()=>{
 const env=environment(),base={action:'subscribe',installationId:crypto.randomUUID(),fcmToken:'fcm-'+('y'.repeat(80))};
 await assert.rejects(pushAction({...base,kind:'family'},guardian,'',env),{status:409});await pair(env);assert.equal((await pushAction({...base,kind:'family'},guardian,'',env)).subscription.enabled,1);
 await assert.rejects(pushAction({...base,kind:'operator'},'', 'wrong',env),{status:401});assert.equal((await pushAction({...base,kind:'operator'},'',operator,env)).subscription.enabled,1);
});

test('notification event handlers remain non-blocking when Firebase is not configured',async()=>{
 const env=environment();await pair(env);const requestId=crypto.randomUUID();await familyAction({action:'help',requestId},owner,env,now+2);assert.deepEqual(await notifyAction({action:'help',requestId},owner,'',env),{sent:0});
});

test('push HTTP route enforces origin, JSON and authentication',async()=>{
 const env=environment(),handler=createHandler(),body=JSON.stringify(subscription),request=(origin=env.ALLOWED_ORIGINS,auth=owner)=>new Request('https://example.com/api/push',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+auth},body});
 assert.equal((await handler(request(),env)).status,200);assert.equal((await handler(request('https://evil.example'),env)).status,403);assert.equal((await handler(request(env.ALLOWED_ORIGINS,'bad'),env)).status,401);
});

test('client and Android sources keep lock-screen messages generic',()=>{
 const worker=readFileSync(new URL('../cloud/cloudflare/push.mjs',import.meta.url),'utf8'),service=readFileSync(new URL('../android/app/src/main/java/cn/yihu/xiyang/demo/YihuMessagingService.java',import.meta.url),'utf8');
 assert.match(worker,/新的家庭守护消息/);assert.match(worker,/人工咨询有一条新回复/);assert.doesNotMatch(worker,/payload=\{body:.*question/);assert.match(service,/body\.length\(\) > 40/);
});
