import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {familyAction} from '../cloud/cloudflare/family.mjs';
import {createHandler} from '../cloud/cloudflare/worker.mjs';
const owner='a'.repeat(64),guardian='b'.repeat(64),stranger='c'.repeat(64),pilot='test-pilot-'.repeat(5),start=1780000000000;
function environment(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../cloud/cloudflare/family-schema.sql',import.meta.url),'utf8'));
 const db={prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null;},async all(){return {success:true,results:sql.prepare(query).all(...args)};},async run(){return {success:true,meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}};},async batch(statements){sql.exec('BEGIN');try{const values=[];for(const s of statements)values.push(await s.run());sql.exec('COMMIT');return values;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 return {DB:db,TESTER_TOKEN_HASHES:createHash('sha256').update(pilot).digest('hex'),ALLOWED_ORIGINS:'https://mack-blip-space.github.io'};
}
async function pair(env){await familyAction({action:'create',pilot,consent:true},owner,env,start);const invite=await familyAction({action:'invite'},owner,env,start);await familyAction({action:'join',invite:invite.invite,consent:true},guardian,env,start+1);}
test('two independent devices complete pairing, help, acknowledgement and unlink; strangers cannot read or write',async()=>{
 const env=environment();await pair(env);
 const requestId=crypto.randomUUID();let s=await familyAction({action:'help',requestId},owner,env,start+2);assert.equal(s.alerts.length,1);assert.equal(s.alerts[0].ack_ms,null);
 assert.equal((await familyAction({action:'state'},stranger,env)).role,null);
 await assert.rejects(familyAction({action:'ack',alertId:requestId},stranger,env),{status:409});
 await assert.rejects(familyAction({action:'ack',alertId:requestId},owner,env),{status:403});
 await assert.rejects(familyAction({action:'help',requestId:crypto.randomUUID()},guardian,env),{status:403});
 s=await familyAction({action:'ack',alertId:requestId},guardian,env,start+3);assert.equal(s.alerts[0].ack_ms,start+3);
 s=await familyAction({action:'state'},owner,env);assert.equal(s.alerts[0].ack_ms,start+3);
 await familyAction({action:'unlink'},guardian,env);assert.equal((await familyAction({action:'state'},guardian,env)).role,null);
 s=await familyAction({action:'state'},owner,env);assert.equal(s.paired,false);assert.deepEqual(s.alerts,[]);
 await assert.rejects(familyAction({action:'help',requestId:crypto.randomUUID()},owner,env),{status:409});
});
test('invitations expire, rotation invalidates the previous invitation, only one concurrent join wins',async()=>{
 const env=environment();await familyAction({action:'create',pilot,consent:true},owner,env,start);
 const old=await familyAction({action:'invite'},owner,env,start);const fresh=await familyAction({action:'invite'},owner,env,start);
 await assert.rejects(familyAction({action:'join',invite:old.invite,consent:true},guardian,env,start+1),{status:409});
 await assert.rejects(familyAction({action:'join',invite:fresh.invite,consent:true},guardian,env,start+900000),{status:409});
 const result=await Promise.allSettled([guardian,stranger].map(t=>familyAction({action:'join',invite:fresh.invite,consent:true},t,env,start+1)));
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(result.filter(r=>r.status==='rejected').length,1);
});
test('lost-response retries and simultaneous help requests produce only one pending alert',async()=>{
 const env=environment();await pair(env);const id=crypto.randomUUID();
 await familyAction({action:'help',requestId:id},owner,env,start+2);
 let s=await familyAction({action:'help',requestId:id},owner,env,start+3);assert.equal(s.alerts.length,1);
 await Promise.all(Array.from({length:5},()=>familyAction({action:'help',requestId:crypto.randomUUID()},owner,env,start+4)));
 s=await familyAction({action:'state'},guardian,env);assert.equal(s.alerts.length,1);assert.equal(s.alerts[0].id,id);
 await familyAction({action:'ack',alertId:id},guardian,env,start+5);await familyAction({action:'ack',alertId:id},guardian,env,start+6);
 s=await familyAction({action:'help',requestId:id},owner,env,start+7);assert.equal(s.alerts.length,1);assert.equal(s.alerts[0].ack_ms,start+5);
});
test('revoked guardian and stale invitation cannot access a rebound circle',async()=>{
 const env=environment();await pair(env);await familyAction({action:'unlink'},owner,env);
 const invite=await familyAction({action:'invite'},owner,env,start);await familyAction({action:'join',invite:invite.invite,consent:true},stranger,env,start+1);
 const id=crypto.randomUUID();await familyAction({action:'help',requestId:id},owner,env,start+2);
 assert.deepEqual((await familyAction({action:'state'},guardian,env)).alerts,[]);
 await assert.rejects(familyAction({action:'ack',alertId:id},guardian,env),{status:409});
 await assert.rejects(familyAction({action:'join',invite:invite.invite,consent:true},guardian,env,start+3),{status:409});
});
test('creation needs pilot authorization and consent, never exposes credential hashes or invitation hashes',async()=>{
 const env=environment();await assert.rejects(familyAction({action:'create',pilot:'wrong',consent:true},owner,env),{status:401});
 await assert.rejects(familyAction({action:'create',pilot},owner,env),{status:400});
 await assert.rejects(familyAction({action:'state'},'bad',env),{status:401});
 await pair(env);const text=JSON.stringify(await familyAction({action:'state'},owner,env));assert.doesNotMatch(text,/hash|invite|pilot|circle_id/);
});
test('twenty help events in 24 hours are allowed, the next is blocked without affecting AI credits',async()=>{
 const env=environment();await pair(env);
 for(let i=0;i<20;i++){const id=crypto.randomUUID();await familyAction({action:'help',requestId:id},owner,env,start+2+i*10);await familyAction({action:'ack',alertId:id},guardian,env,start+3+i*10);}
 await assert.rejects(familyAction({action:'help',requestId:crypto.randomUUID()},owner,env,start+1000),{status:409});
 await familyAction({action:'help',requestId:crypto.randomUUID()},owner,env,start+86401000);
});
test('family HTTP route enforces origin, JSON and bounded body independently of AI availability',async()=>{
 const env=environment(),handler=createHandler();
 const req=(body,origin=env.ALLOWED_ORIGINS)=>new Request('https://example.com/api/family',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+owner},body});
 assert.equal((await handler(req('{"action":"state"}'),env)).status,200);
 assert.equal((await handler(req('{"action":"state"}','https://evil.example'),env)).status,403);
 assert.equal((await handler(req('x'),env)).status,400);
 assert.equal((await handler(req('x'.repeat(5000)),env)).status,413);
});
