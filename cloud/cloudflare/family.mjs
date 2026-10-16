const familyFail=(status,message)=>Object.assign(new Error(message),{status});
const familyHash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const familyRandom=()=>Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function familyAction(data,token,env,now=Date.now()){
 if(!env.DB)throw familyFail(503,'守护圈暂不可用，请直接联系家人');
 if(!/^[a-f0-9]{64}$/.test(token))throw familyFail(401,'本机身份无效，请使用原设备打开守护圈');
 const db=env.DB,identity=await familyHash(token),action=data?.action;
 const one=(sql,...params)=>db.prepare(sql).bind(...params).first();
 const run=(sql,...params)=>db.prepare(sql).bind(...params).run();
 if(action==='create'){
  if(data.consent!==true)throw familyFail(400,'请先确认守护圈数据同步说明');
  const proof=typeof data.pilot==='string'?data.pilot:'';
  if(proof.length<32||proof.length>200||!(env.TESTER_TOKEN_HASHES||'').split(',').map(s=>s.trim()).includes(await familyHash(proof)))throw familyFail(401,'请填写负责人提供的内测邀请码');
  // Cap pilot provisioning without consuming model credits.
  await run('INSERT INTO yihu_family(id,owner_hash,created_ms) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM yihu_family)<100 AND NOT EXISTS(SELECT 1 FROM yihu_family WHERE owner_hash=? OR guardian_hash=?) ON CONFLICT DO NOTHING',crypto.randomUUID(),identity,now,identity,identity);
 }
 if(action==='join'){
  if(data.consent!==true)throw familyFail(400,'请先确认守护圈数据同步说明');
  if(typeof data.invite!=='string'||!/^\s*[a-fA-F0-9 -]{32,48}\s*$/.test(data.invite))throw familyFail(400,'请粘贴完整的家庭邀请口令');
  const invite=data.invite.replace(/[\s-]/g,'').toLowerCase();
  if(!/^[a-f0-9]{32}$/.test(invite))throw familyFail(400,'家庭邀请口令格式不正确');
  // One atomic conditional update: a single invitation cannot bind two devices.
  const joined=await one('UPDATE yihu_family SET guardian_hash=?,invite_hash=NULL,invite_until=NULL WHERE invite_hash=? AND invite_until>? AND guardian_hash IS NULL AND owner_hash<>? AND NOT EXISTS(SELECT 1 FROM yihu_family WHERE owner_hash=? OR guardian_hash=?) RETURNING id',identity,await familyHash(invite),now,identity,identity,identity);
  if(!joined){const existing=await one('SELECT id FROM yihu_family WHERE guardian_hash=?',identity);if(!existing)throw familyFail(409,'邀请已失效、已被使用，或本机已加入守护圈。请刷新状态；需要时让长辈生成新口令');}
 }
 let circle=await one('SELECT * FROM yihu_family WHERE owner_hash=? OR guardian_hash=?',identity,identity);
 if(!circle){if(action==='state')return {role:null,paired:false,alerts:[],serverTime:now};throw familyFail(409,'本机尚未绑定，或绑定已解除；请重新进入守护圈');}
 const owner=circle.owner_hash===identity;
 if(action==='invite'){
  if(!owner)throw familyFail(403,'请在长辈手机生成邀请');
  const invite=familyRandom(),expiresAt=now+15*60*1000;
  const updated=await one('UPDATE yihu_family SET invite_hash=?,invite_until=? WHERE id=? AND owner_hash=? AND guardian_hash IS NULL RETURNING id',await familyHash(invite),expiresAt,circle.id,identity);
  if(!updated)throw familyFail(409,'已经绑定家人，请先解除绑定再邀请');
  return {invite,expiresAt};
 }
 if(action==='help'){
  if(!owner)throw familyFail(403,'请由长辈手机发送求助');
  if(typeof data.requestId!=='string'||!/^[-a-f0-9]{36}$/.test(data.requestId))throw familyFail(400,'请重新点击发送求助');
  // Authorization and pairing checked inside the write; retries never create duplicates.
  await run('INSERT INTO yihu_family_alert(id,circle_id,created_ms) SELECT ?,id,? FROM yihu_family WHERE id=? AND owner_hash=? AND guardian_hash IS NOT NULL AND (SELECT COUNT(*) FROM yihu_family_alert WHERE circle_id=? AND created_ms>?)<20 ON CONFLICT DO NOTHING',data.requestId,now,circle.id,identity,circle.id,now-86400000);
  const alert=await one('SELECT * FROM yihu_family_alert WHERE circle_id=? AND (id=? OR ack_ms IS NULL) ORDER BY created_ms DESC LIMIT 1',circle.id,data.requestId);
  if(!alert)throw familyFail(409,'尚未绑定家人，或24小时内求助已达20次。请直接拨打家人电话');
 }
 if(action==='ack'){
  if(owner)throw familyFail(403,'请由家人确认已联系');
  const alert=await one('UPDATE yihu_family_alert SET ack_ms=COALESCE(ack_ms,?) WHERE id=? AND circle_id=? AND EXISTS(SELECT 1 FROM yihu_family WHERE id=? AND guardian_hash=?) RETURNING id',now,String(data.alertId||''),circle.id,circle.id,identity);
  if(!alert)throw familyFail(409,'求助已失效或绑定已解除，请刷新状态');
 }
 if(action==='unlink'){
  // D1 batch executes transactionally. Invalidate invitation and access together.
  await db.batch([
   db.prepare('DELETE FROM yihu_family_alert WHERE circle_id IN(SELECT id FROM yihu_family WHERE id=? AND (owner_hash=? OR guardian_hash=?))').bind(circle.id,identity,identity),
   db.prepare('UPDATE yihu_family SET guardian_hash=NULL,invite_hash=NULL,invite_until=NULL WHERE id=? AND (owner_hash=? OR guardian_hash=?)').bind(circle.id,identity,identity)
  ]);
 }
 if(!['create','join','state','help','ack','unlink'].includes(action))throw familyFail(400,'操作不正确');
 circle=await one('SELECT * FROM yihu_family WHERE owner_hash=? OR guardian_hash=?',identity,identity);
 if(!circle)return {role:null,paired:false,alerts:[],serverTime:now};
 const alerts=await db.prepare('SELECT id,created_ms,ack_ms FROM yihu_family_alert WHERE circle_id=? ORDER BY created_ms DESC LIMIT 20').bind(circle.id).all();
 return {role:circle.owner_hash===identity?'elder':'family',paired:!!circle.guardian_hash,alerts:alerts.results,serverTime:now};
}
