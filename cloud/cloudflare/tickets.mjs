const ticketFail=(status,message)=>Object.assign(new Error(message),{status});
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const same=(a,b)=>{let n=a.length^b.length;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return n===0;};
const clean=value=>typeof value==='string'?value.trim():'';
const privateData=value=>/(?:\d[\s-]*){11,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value);
const allowedCategories=new Set(['诈骗疑虑','消费合同','投资理财','数字权益','财产纠纷','公益诉讼','其他']);
const publicTicket=t=>({id:t.id,code:t.code,category:t.category,question:t.question,status:t.status,created_ms:t.created_ms,updated_ms:t.updated_ms});
async function validPilot(pilot,env){
 if(pilot.length<32||pilot.length>200)return false;
 const value=await digest(pilot),hashes=(env.TESTER_TOKEN_HASHES||'').split(',').map(x=>x.trim()).filter(x=>/^[a-f0-9]{64}$/.test(x));
 return hashes.some(x=>same(x,value));
}
async function operatorIdentity(credential,env){
 if(credential.length<32||credential.length>200)return '';
 const value=await digest(credential),hashes=(env.OPERATOR_TOKEN_HASHES||'').split(',').map(x=>x.trim()).filter(x=>/^[a-f0-9]{64}$/.test(x));
 return hashes.some(x=>same(x,value))?value:'';
}
async function ticketWithMessages(db,ticket){
 const messages=await db.prepare('SELECT id,sender,body,created_ms FROM yihu_ticket_message WHERE ticket_id=? ORDER BY created_ms ASC LIMIT 20').bind(ticket.id).all();
 return {...publicTicket(ticket),messages:messages.results};
}
function ticketCode(now){
 const day=new Date(now+8*3600000).toISOString().slice(0,10).replaceAll('-','');
 const random=Array.from(crypto.getRandomValues(new Uint8Array(4))).map(x=>x.toString(36).padStart(2,'0')).join('').toUpperCase().slice(0,6);
 return `YH-${day}-${random}`;
}
export async function ticketAction(data,deviceToken,operatorCredential,env,now=Date.now()){
 if(!env.DB)throw ticketFail(503,'人工咨询服务暂不可用，请拨打12348');
 const db=env.DB,action=clean(data?.action);
 const run=(sql,...args)=>db.prepare(sql).bind(...args).run();
 const first=(sql,...args)=>db.prepare(sql).bind(...args).first();
 const operator=await operatorIdentity(operatorCredential,env);
 if(action.startsWith('operator-')){
  if(!operator)throw ticketFail(401,'志愿者工作台凭证无效或已撤销');
  if(action==='operator-list'){
   const rows=await db.prepare("SELECT * FROM yihu_ticket WHERE status<>'closed' ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'replied' THEN 1 ELSE 2 END,updated_ms ASC LIMIT 100").bind().all();
   return {tickets:await Promise.all(rows.results.map(t=>ticketWithMessages(db,t))),serverTime:now};
  }
  const id=clean(data.ticketId),ticket=await first('SELECT * FROM yihu_ticket WHERE id=?',id);
  if(!ticket)throw ticketFail(404,'工单不存在或已经清理');
  if(action==='operator-claim'){
   const result=await run("UPDATE yihu_ticket SET operator_hash=?,status='in_progress',updated_ms=? WHERE id=? AND status='pending' AND operator_hash IS NULL",operator,now,id);
   if(result.meta?.changes!==1){const current=await first('SELECT operator_hash,status FROM yihu_ticket WHERE id=?',id);if(!current||!same(current.operator_hash||'',operator))throw ticketFail(409,'该工单已由其他志愿者接单，或状态已经变化');}
  } else if(action==='operator-reply'){
   const body=clean(data.body);if(body.length<2||body.length>1500)throw ticketFail(400,'回复需为2—1500字');if(privateData(body))throw ticketFail(400,'请删除电话、邮箱、证件号或银行卡号，再通过工作台回复');
   const requestId=clean(data.requestId);if(!/^[a-f0-9-]{36}$/.test(requestId))throw ticketFail(400,'请重新提交回复');
   const current=await first("SELECT id FROM yihu_ticket WHERE id=? AND operator_hash=? AND status IN ('in_progress','replied')",id,operator);if(!current)throw ticketFail(409,'请先接单，或刷新查看最新状态');
   await run("INSERT INTO yihu_ticket_message(id,ticket_id,sender,body,created_ms) VALUES(?,?,'operator',?,?) ON CONFLICT DO NOTHING",requestId,id,body,now);
   await run("UPDATE yihu_ticket SET status='replied',updated_ms=? WHERE id=? AND operator_hash=?",now,id,operator);
  } else if(action==='operator-close'){
   const result=await run("UPDATE yihu_ticket SET status='closed',updated_ms=? WHERE id=? AND operator_hash=? AND status<>'closed'",now,id,operator);
   if(result.meta?.changes!==1)throw ticketFail(409,'只有接单志愿者可以结束当前工单');
  } else throw ticketFail(400,'工作台操作不正确');
  return {ticket:await ticketWithMessages(db,await first('SELECT * FROM yihu_ticket WHERE id=?',id))};
 }
 if(!/^[a-f0-9]{64}$/.test(deviceToken))throw ticketFail(401,'本机咨询身份无效，请使用原设备查看工单');
 const owner=await digest(deviceToken);
 if(action==='list'){
  const rows=await db.prepare('SELECT * FROM yihu_ticket WHERE owner_hash=? ORDER BY updated_ms DESC LIMIT 20').bind(owner).all();
  return {tickets:await Promise.all(rows.results.map(t=>ticketWithMessages(db,t))),serverTime:now};
 }
 if(action==='create'){
  if(data.consent!==true)throw ticketFail(400,'请先确认人工咨询数据同步说明');
  if(!await validPilot(clean(data.pilot),env))throw ticketFail(401,'请填写负责人提供的项目内测邀请码');
  const category=clean(data.category),question=clean(data.question);
  if(!allowedCategories.has(category))throw ticketFail(400,'请选择问题类型');
  if(question.length<10||question.length>1200)throw ticketFail(400,'问题需为10—1200字');
  if(privateData(question))throw ticketFail(400,'请先删除电话、邮箱、证件号或银行卡号');
  const id=clean(data.requestId);if(!/^[a-f0-9-]{36}$/.test(id))throw ticketFail(400,'请重新提交咨询');
  const existing=await first('SELECT * FROM yihu_ticket WHERE id=? AND owner_hash=?',id,owner);if(existing)return {ticket:await ticketWithMessages(db,existing)};
  const dayStart=now-86400000;
  await run("INSERT INTO yihu_ticket(id,code,owner_hash,category,question,status,created_ms,updated_ms) SELECT ?,?,?,?,?,'pending',?,? WHERE (SELECT COUNT(*) FROM yihu_ticket WHERE created_ms>?)<200 AND (SELECT COUNT(*) FROM yihu_ticket WHERE owner_hash=? AND created_ms>?)<5 ON CONFLICT DO NOTHING",id,ticketCode(now),owner,category,question,now,now,dayStart,owner,dayStart);
  const saved=await first('SELECT * FROM yihu_ticket WHERE id=? AND owner_hash=?',id,owner);if(!saved){const taken=await first('SELECT id FROM yihu_ticket WHERE id=?',id);throw taken?ticketFail(409,'提交标识冲突，请重新填写后提交'):ticketFail(429,'当前设备24小时最多提交5条，全项目最多200条，请稍后再试或拨打12348');}
  return {ticket:await ticketWithMessages(db,saved)};
 }
 const id=clean(data.ticketId),ticket=await first('SELECT * FROM yihu_ticket WHERE id=? AND owner_hash=?',id,owner);
 if(!ticket)throw ticketFail(404,'工单不在本机咨询身份下，或已经清理');
 if(action==='followup'){
  if(ticket.status==='closed')throw ticketFail(409,'工单已经结束，不能继续补充');
  const body=clean(data.body);if(body.length<2||body.length>1200)throw ticketFail(400,'补充说明需为2—1200字');if(privateData(body))throw ticketFail(400,'请先删除电话、邮箱、证件号或银行卡号');
  const count=await first("SELECT COUNT(*) n FROM yihu_ticket_message WHERE ticket_id=? AND sender='user'",id);if(count.n>=8)throw ticketFail(429,'这条工单最多补充8次，请等待回复或拨打12348');
  const requestId=clean(data.requestId);if(!/^[a-f0-9-]{36}$/.test(requestId))throw ticketFail(400,'请重新提交补充说明');
  await run("INSERT INTO yihu_ticket_message(id,ticket_id,sender,body,created_ms) VALUES(?,?,'user',?,?) ON CONFLICT DO NOTHING",requestId,id,body,now);
  await run("UPDATE yihu_ticket SET status=CASE WHEN operator_hash IS NULL THEN 'pending' ELSE 'in_progress' END,updated_ms=? WHERE id=? AND owner_hash=?",now,id,owner);
 } else if(action==='close'){
  const result=await run("UPDATE yihu_ticket SET status='closed',updated_ms=? WHERE id=? AND owner_hash=? AND status='replied'",now,id,owner);
  if(result.meta?.changes!==1)throw ticketFail(409,'收到志愿者回复后，才可以确认结束');
 } else throw ticketFail(400,'咨询操作不正确');
 return {ticket:await ticketWithMessages(db,await first('SELECT * FROM yihu_ticket WHERE id=?',id))};
}
