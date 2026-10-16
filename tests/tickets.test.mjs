import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ticketAction} from '../cloud/cloudflare/tickets.mjs';
import {createHandler} from '../cloud/cloudflare/worker.mjs';

const pilot='pilot-ticket-'.repeat(4),operatorToken='operator-ticket-'.repeat(3),user='a'.repeat(64),other='b'.repeat(64),now=1792100000000;
function environment(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');sql.exec(readFileSync(new URL('../cloud/cloudflare/ticket-schema.sql',import.meta.url),'utf8'));
 const db={prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null;},async all(){return {success:true,results:sql.prepare(query).all(...args)};},async run(){return {success:true,meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}};},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 return {DB:db,TESTER_TOKEN_HASHES:createHash('sha256').update(pilot).digest('hex'),OPERATOR_TOKEN_HASHES:createHash('sha256').update(operatorToken).digest('hex'),ALLOWED_ORIGINS:'https://mack-blip-space.github.io'};
}
const create=(env,owner=user,id=crypto.randomUUID(),time=now)=>ticketAction({action:'create',requestId:id,pilot,consent:true,category:'消费合同',question:'购买养老服务后对方一直没有按约提供服务，想了解如何处理。'},owner,'',env,time);

test('user and operator complete submit, claim, reply, follow-up and close flow',async()=>{
 const env=environment(),created=(await create(env)).ticket;assert.match(created.code,/^YH-\d{8}-[A-Z0-9]{6}$/);assert.equal(created.status,'pending');
 let queue=await ticketAction({action:'operator-list'},'',operatorToken,env);assert.equal(queue.tickets.length,1);assert.equal(queue.tickets[0].question,created.question);
 await ticketAction({action:'operator-claim',ticketId:created.id},'',operatorToken,env,now+1);
 let result=await ticketAction({action:'operator-reply',ticketId:created.id,requestId:crypto.randomUUID(),body:'请先保存合同与付款凭证，再通过正规渠道核实服务主体。'},'',operatorToken,env,now+2);assert.equal(result.ticket.status,'replied');
 result=await ticketAction({action:'followup',ticketId:created.id,requestId:crypto.randomUUID(),body:'我还保留了合同和付款凭证。'},user,'',env,now+3);assert.equal(result.ticket.status,'in_progress');
 await ticketAction({action:'operator-reply',ticketId:created.id,requestId:crypto.randomUUID(),body:'可以按时间顺序整理材料，咨询12348了解适用途径。'},'',operatorToken,env,now+4);
 result=await ticketAction({action:'close',ticketId:created.id},user,'',env,now+5);assert.equal(result.ticket.status,'closed');assert.equal(result.ticket.messages.length,3);
});

test('authorization isolates device tickets and protects volunteer actions',async()=>{
 const env=environment(),id=(await create(env)).ticket.id;
 assert.deepEqual((await ticketAction({action:'list'},other,'',env)).tickets,[]);
 await assert.rejects(ticketAction({action:'followup',ticketId:id,requestId:crypto.randomUUID(),body:'测试补充'},other,'',env),{status:404});
 await assert.rejects(ticketAction({action:'operator-list'},'','wrong credential',env),{status:401});
 await assert.rejects(ticketAction({action:'operator-reply',ticketId:id,requestId:crypto.randomUUID(),body:'测试回复'},'',operatorToken,env),{status:409});
 await assert.rejects(ticketAction({action:'close',ticketId:id},user,'',env),{status:409});
});

test('concurrent claim has one winner and a different operator cannot take over',async()=>{
 const second='second-operator-credential-'.repeat(2),env=environment();env.OPERATOR_TOKEN_HASHES+=','+createHash('sha256').update(second).digest('hex');const id=(await create(env)).ticket.id;
 const results=await Promise.allSettled([operatorToken,second].map(token=>ticketAction({action:'operator-claim',ticketId:id},'',token,env,now+1)));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===409).length,1);
});

test('idempotent request ids prevent duplicate tickets and messages',async()=>{
 const env=environment(),requestId=crypto.randomUUID(),first=(await create(env,user,requestId)).ticket,again=(await create(env,user,requestId,now+1)).ticket;assert.equal(first.id,again.id);
 await ticketAction({action:'operator-claim',ticketId:first.id},'',operatorToken,env);
 const messageId=crypto.randomUUID();await ticketAction({action:'operator-reply',ticketId:first.id,requestId:messageId,body:'请保存相关凭证。'},'',operatorToken,env,now+2);const result=await ticketAction({action:'operator-reply',ticketId:first.id,requestId:messageId,body:'请保存相关凭证。'},'',operatorToken,env,now+3);assert.equal(result.ticket.messages.length,1);
});

test('private data, missing consent, invalid category and size limits are rejected',async()=>{
 const env=environment(),base={action:'create',requestId:crypto.randomUUID(),pilot,consent:true,category:'消费合同',question:'这是一段足够长度的脱敏咨询问题。'};
 await assert.rejects(ticketAction({...base,consent:false},user,'',env),{status:400});
 await assert.rejects(ticketAction({...base,category:'未定义'},user,'',env),{status:400});
 await assert.rejects(ticketAction({...base,question:'我的电话是13812345678，请联系'},user,'',env),{status:400});
 const ticket=(await ticketAction(base,user,'',env)).ticket;await ticketAction({action:'operator-claim',ticketId:ticket.id},'',operatorToken,env);
 await assert.rejects(ticketAction({action:'operator-reply',ticketId:ticket.id,requestId:crypto.randomUUID(),body:'请发邮箱 test@example.com'},'',operatorToken,env),{status:400});
});

test('per-device daily cap and closed ticket immutability are enforced',async()=>{
 const env=environment();for(let i=0;i<5;i++)await create(env,user,crypto.randomUUID(),now+i);await assert.rejects(create(env,user,crypto.randomUUID(),now+10),{status:429});
 const ticket=(await ticketAction({action:'list'},user,'',env)).tickets[0];await ticketAction({action:'operator-claim',ticketId:ticket.id},'',operatorToken,env);await ticketAction({action:'operator-reply',ticketId:ticket.id,requestId:crypto.randomUUID(),body:'一般回复内容。'},'',operatorToken,env);await ticketAction({action:'close',ticketId:ticket.id},user,'',env);
 await assert.rejects(ticketAction({action:'followup',ticketId:ticket.id,requestId:crypto.randomUUID(),body:'继续补充'},user,'',env),{status:409});
});

test('concurrent submissions cannot exceed the per-device cap',async()=>{
 const env=environment();const results=await Promise.allSettled(Array.from({length:12},(_,i)=>create(env,user,crypto.randomUUID(),now+i)));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,5);
 assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===429).length,7);
});

test('ticket HTTP route validates origin, method, body and separate operator header',async()=>{
 const env=environment(),handler=createHandler(),origin=env.ALLOWED_ORIGINS;
 const request=(body,headers={})=>new Request('https://example.com/api/tickets',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+user,...headers},body});
 assert.equal((await handler(request('{"action":"list"}'),env)).status,200);
 assert.equal((await handler(request('{"action":"operator-list"}',{'X-Operator-Credential':operatorToken}),env)).status,200);
 assert.equal((await handler(new Request('https://example.com/api/tickets',{method:'OPTIONS',headers:{Origin:origin}}),env)).headers.get('Access-Control-Allow-Headers').includes('X-Operator-Credential'),true);
 assert.equal((await handler(new Request('https://example.com/api/tickets',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'}),env)).status,403);
 assert.equal((await handler(request('x'.repeat(9000)),env)).status,413);
});
