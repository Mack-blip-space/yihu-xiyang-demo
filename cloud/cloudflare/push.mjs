const pushFail=(status,message)=>Object.assign(new Error(message),{status});
const pushDigest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const pushSame=(a,b)=>{let n=a.length^b.length;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return n===0;};
const pushClean=value=>typeof value==='string'?value.trim():'';
const kinds=new Set(['family','ticket','operator']);
let cachedAccessToken='',cachedUntil=0;

async function subjectFor(kind,deviceToken,operatorCredential,env){
 if(kind==='operator'){
  if(operatorCredential.length<32||operatorCredential.length>200)throw pushFail(401,'志愿者工作台凭证无效或已撤销');
  const value=await pushDigest(operatorCredential),allowed=(env.OPERATOR_TOKEN_HASHES||'').split(',').map(x=>x.trim()).filter(x=>/^[a-f0-9]{64}$/.test(x));
  if(!allowed.some(x=>pushSame(x,value)))throw pushFail(401,'志愿者工作台凭证无效或已撤销');
  return value;
 }
 if(!/^[a-f0-9]{64}$/.test(deviceToken))throw pushFail(401,'本机通知身份无效');
 const value=await pushDigest(deviceToken);
 if(kind==='family'){
  const row=await env.DB.prepare('SELECT id FROM yihu_family WHERE owner_hash=? OR guardian_hash=?').bind(value,value).first();
  if(!row)throw pushFail(409,'绑定家庭守护圈后，才能接收家人求助通知');
 }
 return value;
}
function pemBytes(value){
 const raw=value.replace(/\\n/g,'\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
 const bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));return bytes.buffer;
}
function base64url(value){const bytes=value instanceof Uint8Array?value:new TextEncoder().encode(value);let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
async function accessToken(env,fetcher,now=Date.now()){
 if(cachedAccessToken&&now<cachedUntil-60000)return cachedAccessToken;
 const key=await crypto.subtle.importKey('pkcs8',pemBytes(env.FIREBASE_PRIVATE_KEY),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const header=base64url(JSON.stringify({alg:'RS256',typ:'JWT'})),issued=Math.floor(now/1000),claims=base64url(JSON.stringify({iss:env.FIREBASE_CLIENT_EMAIL,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:issued,exp:issued+3600}));
 const unsigned=header+'.'+claims,signature=base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned))));
 const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature})});
 if(!response.ok)throw Error('FCM_AUTH_'+response.status);const result=await response.json();if(!result.access_token)throw Error('FCM_AUTH_RESPONSE');cachedAccessToken=result.access_token;cachedUntil=now+(Number(result.expires_in)||3600)*1000;return cachedAccessToken;
}
function configured(env){return !!(env.DB&&env.FIREBASE_PROJECT_ID&&env.FIREBASE_CLIENT_EMAIL&&env.FIREBASE_PRIVATE_KEY);}
async function sendOne(row,payload,env,fetcher,now){
 try{
  const bearer=await accessToken(env,fetcher,now);
  const response=await fetcher(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/messages:send`,{method:'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify({message:{token:row.fcm_token,data:{title:'益护夕阳',body:payload.body,route:payload.route},android:{priority:payload.priority||'normal',ttl:'86400s'}}})});
  if(!response.ok){const body=await response.text();if(response.status===404||/UNREGISTERED|registration-token-not-registered/i.test(body))await env.DB.prepare('DELETE FROM yihu_push_subscription WHERE kind=? AND subject_hash=? AND installation_id=?').bind(row.kind,row.subject_hash,row.installation_id).run();else await env.DB.prepare('UPDATE yihu_push_subscription SET last_error=? WHERE kind=? AND subject_hash=? AND installation_id=?').bind('FCM_'+response.status,row.kind,row.subject_hash,row.installation_id).run();return false;}
  await response.body?.cancel();await env.DB.prepare('UPDATE yihu_push_subscription SET last_success_ms=?,last_error=NULL WHERE kind=? AND subject_hash=? AND installation_id=?').bind(now,row.kind,row.subject_hash,row.installation_id).run();return true;
 }catch(error){await env.DB.prepare('UPDATE yihu_push_subscription SET last_error=? WHERE kind=? AND subject_hash=? AND installation_id=?').bind(String(error?.message||'SEND_FAILED').slice(0,80),row.kind,row.subject_hash,row.installation_id).run();return false;}
}
async function sendTarget(kind,subject,payload,env,fetcher=globalThis.fetch,now=Date.now()){
 if(!configured(env)||!subject)return {sent:0};const rows=await env.DB.prepare('SELECT * FROM yihu_push_subscription WHERE kind=? AND subject_hash=? AND enabled=1 LIMIT 10').bind(kind,subject).all();let sent=0;for(const row of rows.results)if(await sendOne(row,payload,env,fetcher,now))sent++;return {sent};
}
async function sendAll(kind,payload,env,fetcher=globalThis.fetch,now=Date.now()){
 if(!configured(env))return {sent:0};const rows=await env.DB.prepare('SELECT * FROM yihu_push_subscription WHERE kind=? AND enabled=1 LIMIT 50').bind(kind).all();let sent=0;for(const row of rows.results)if(await sendOne(row,payload,env,fetcher,now))sent++;return {sent};
}
export async function notifyAction(data,deviceToken,operatorCredential,env,fetcher=globalThis.fetch,now=Date.now()){
 if(!configured(env))return {sent:0};let kind='',subject='',payload=null,eventKey='';
 if(data.action==='help'){
  const owner=await pushDigest(deviceToken),row=await env.DB.prepare('SELECT guardian_hash FROM yihu_family WHERE owner_hash=?').bind(owner).first();kind='family';subject=row?.guardian_hash;payload={body:'您有一条新的家庭守护消息',route:'family',priority:'high'};eventKey='family-help:'+pushClean(data.requestId);
 }else if(data.action==='operator-reply'){
  const row=await env.DB.prepare('SELECT owner_hash FROM yihu_ticket WHERE id=?').bind(pushClean(data.ticketId)).first();kind='ticket';subject=row?.owner_hash;payload={body:'您的人工咨询有一条新回复',route:'ticket/'+pushClean(data.ticketId)};eventKey='ticket-reply:'+pushClean(data.requestId);
 }else if(data.action==='followup'){
  const row=await env.DB.prepare('SELECT operator_hash FROM yihu_ticket WHERE id=?').bind(pushClean(data.ticketId)).first();kind='operator';subject=row?.operator_hash;payload={body:'工作台有一条新的用户补充',route:'volunteer'};eventKey='ticket-followup:'+pushClean(data.requestId);
 }
 if(!payload||!eventKey||(!subject&&kind!=='operator'))return {sent:0};const reserved=await env.DB.prepare('INSERT INTO yihu_push_event(event_key,created_ms) VALUES(?,?) ON CONFLICT DO NOTHING').bind(eventKey,now).run();if(reserved.meta?.changes!==1)return {sent:0};return subject?sendTarget(kind,subject,payload,env,fetcher,now):sendAll(kind,payload,env,fetcher,now);
}
export async function pushAction(data,deviceToken,operatorCredential,env,fetcher=globalThis.fetch,now=Date.now()){
 if(!env.DB)throw pushFail(503,'通知服务暂不可用');const action=pushClean(data?.action),kind=pushClean(data?.kind),installationId=pushClean(data.installationId),token=pushClean(data.fcmToken);
 if(!/^[a-f0-9-]{36}$/.test(installationId))throw pushFail(400,'本机通知标识无效');
 if(action==='disable-all'){
  if(token.length<40||token.length>4096)throw pushFail(400,'设备通知令牌无效');await env.DB.prepare('UPDATE yihu_push_subscription SET enabled=0,updated_ms=? WHERE installation_id=? AND fcm_token=?').bind(now,installationId,token).run();return {configured:configured(env),disabled:true,serverTime:now};
 }
 if(!kinds.has(kind))throw pushFail(400,'通知类型不正确');const subject=await subjectFor(kind,deviceToken,operatorCredential,env);
 if(action==='subscribe'){
  if(token.length<40||token.length>4096)throw pushFail(400,'设备通知令牌无效');
  await env.DB.prepare('INSERT INTO yihu_push_subscription(kind,subject_hash,installation_id,fcm_token,enabled,created_ms,updated_ms) VALUES(?,?,?,?,1,?,?) ON CONFLICT(kind,subject_hash,installation_id) DO UPDATE SET fcm_token=excluded.fcm_token,enabled=1,updated_ms=excluded.updated_ms,last_error=NULL').bind(kind,subject,installationId,token,now,now).run();
 }else if(action==='disable')await env.DB.prepare('UPDATE yihu_push_subscription SET enabled=0,updated_ms=? WHERE kind=? AND subject_hash=? AND installation_id=?').bind(now,kind,subject,installationId).run();
 else if(action!=='status')throw pushFail(400,'通知操作不正确');
 const row=await env.DB.prepare('SELECT enabled,updated_ms,last_success_ms,last_error FROM yihu_push_subscription WHERE kind=? AND subject_hash=? AND installation_id=?').bind(kind,subject,installationId).first();return {configured:configured(env),subscription:row||null,serverTime:now};
}
