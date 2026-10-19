/* Device identity is separate from the AI credential. No contact or evidence upload. */
'use strict';
const FAMILY_ENDPOINT='https://yihu-ai-consult.1201wburbankblvd.workers.dev/api/family';
let familyState=null,familyBusy=false,familyError='',familyNotice='',familyInvite=null,familyChecked=0,familyTimer=null;
function familyToken(create=false){
 let token=readLocal('yihu-family-device-v1','');
 if(/^[a-f0-9]{64}$/.test(token))return token;
 if(!create)return '';
 token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
 if(!saveLocal('yihu-family-device-v1',token))throw Error('本机无法保存守护圈身份，请检查存储权限后再试');
 return token;
}
async function familyRequest(action,data={}){
 const token=familyToken(action==='create'||action==='join');
 if(!token)throw Error('请先创建或加入守护圈');
 return demoRequest(FAMILY_ENDPOINT,{action,...data},{'Content-Type':'application/json',Authorization:'Bearer '+token});
}
function familyLive(){
 const s=familyState;
 return `<p class="error" role="alert">${esc(familyError)}</p><p role="status">${esc(familyNotice)}</p>${s?.role?`<div class="notice soft"><strong>${s.role==='elder'?'长辈手机':'家人手机'} · ${s.paired?'已绑定':'等待家人绑定'}</strong><p>${familyChecked?'最近同步：'+stamp(familyChecked):'正在核对状态'}${familyError?'（同步失败，以下为上次状态）':''}</p></div><h2>求助与联系记录</h2>${s.alerts.length?s.alerts.map(a=>`<section class="form-panel"><strong>${a.ack_ms?'家人已确认联系':'等待家人确认联系'}</strong><p>我遇到一件拿不准的事，请联系我一起看看。</p><p>发送时间：${stamp(a.created_ms)}</p>${a.ack_ms?`<p>确认时间：${stamp(a.ack_ms)}</p>`:s.role==='family'?`<button class="primary" data-family="ack" data-alert-id="${esc(a.id)}" ${familyBusy?'disabled':''}>我已联系长辈，确认处理</button>`:'<p>消息已保存到守护圈，不代表家人已看到。急事请直接打电话。</p>'}</section>`).join(''):'<p>还没有求助记录。</p>'}`:''}`;
}
function familyPage(){
 const s=familyState,role=s?.role;
 return `${back('guardians','返回多方守护')}${heading('家庭守护圈','两部手机，一起照应。')}<div class="notice"><strong>需联网；安卓体验版可在“我的—消息通知”主动开启锁屏提醒。</strong><p>通知可能受断网或系统省电影响。遇到急事请直接拨打家人电话，紧急危险请拨打 110。</p></div><div id="family-live" aria-live="polite">${familyLive()}</div>${!role?`<div class="family-columns"><form class="form-panel" id="family-create"><h2>我是长辈</h2><p>先创建守护圈，再把家庭邀请口令交给一位信任的家人。</p><label class="field"><span class="field-label">邀请码</span><input name="pilot" type="password" autocomplete="off" minlength="32" maxlength="200" required></label>${familyConsent()}<button class="primary" type="submit" ${familyBusy?'disabled':''}>创建我的守护圈</button></form><form class="form-panel" id="family-join"><h2>我是家人</h2><label class="field"><span class="field-label">长辈提供的家庭邀请口令</span><input name="invite" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="48" required placeholder="粘贴完整口令"></label>${familyConsent()}<button class="primary" type="submit" ${familyBusy?'disabled':''}>确认加入守护圈</button></form></div>`:`<section class="form-panel"><h2>${role==='elder'?'联系我的家人':'照应长辈'}</h2>${role==='elder'?(s.paired?`<button class="primary" data-family="help" ${familyBusy?'disabled':''}>发送求助，请家人联系我</button>`:`<p>一部长辈手机可绑定一部家人手机。请只把口令交给信任的人。</p><button class="primary" data-family="invite" ${familyBusy?'disabled':''}>生成新的家庭邀请口令</button>${familyInvite?`<label class="field"><span class="field-label">家庭邀请口令（15 分钟内有效）</span><input id="family-invite-value" readonly value="${esc(familyInvite.invite)}"></label><p>有效至 ${stamp(familyInvite.expiresAt)}。生成新口令会使旧口令失效。</p><button class="secondary" data-family="copy">复制口令</button>`:''}`):'<p>先通过电话或当面联系长辈，确认情况后再点击“我已联系长辈，确认处理”。</p>'}<div class="actions"><button class="secondary" data-family="refresh" ${familyBusy?'disabled':''}>刷新状态</button><button class="text-btn danger" data-family="unlink" ${familyBusy?'disabled':''}>${s.paired?'解除双方绑定':'撤销未使用的邀请'}</button></div></section>`}<div class="actions"><button class="secondary" data-go="emergency">打开电话求助</button><button class="secondary" data-go="guardians">本机家人联系簿</button></div><details class="form-panel"><summary>守护圈数据与换机说明</summary><p>仅同步随机设备身份、绑定关系、求助及确认时间；不上传姓名、电话、定位、聊天、维权记录或附件。求助内容为页面展示的固定消息。</p><p>数据由项目 Cloudflare 服务处理，可能存储在境外。解除绑定会撤销邀请、删除双方共享求助记录，对方将不能继续查看。</p><p>本机身份保存在此 App 或浏览器中。清除数据、换浏览器或换手机后不能自动恢复；请让仍能进入的另一方先解除绑定，再重新邀请。不要复制本机身份给他人。</p></details>`;
}
function familyConsent(){return '<label class="consent"><input type="checkbox" name="consent" required>我同意将随机设备身份、绑定关系与求助状态同步至项目 Cloudflare 服务（可能在境外处理），并仅与信任的家人绑定。</label>';}
function familyPaint(){const node=$('#family-live');if(node)node.innerHTML=familyLive();}
async function familyRefresh(){
 if(familyBusy||!familyToken()||route!=='family'||document.hidden)return;
 familyBusy=true;
 try{const before=familyState;familyState=await familyRequest('state');familyChecked=Date.now();familyError='';familyNotice='';if(familyState.paired)familyInvite=null;familyBusy=false;if(route==='family'&&(before?.role!==familyState.role||before?.paired!==familyState.paired))render();}
 catch(e){familyError=e.name==='TimeoutError'?'同步超时，请刷新重试或直接打电话':e.message||'未能连接，请检查网络';}
 finally{familyBusy=false;familyPaint();}
}
function familyAfterRender(){clearTimeout(familyTimer);if(route==='family'&&!familyError&&(!familyState||Date.now()-familyChecked>15000))familyTimer=setTimeout(familyRefresh,0);}
setInterval(()=>{if(route==='family')familyRefresh();},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&route==='family')familyRefresh();});
async function familyPerform(action,data={}){
 if(familyBusy)return;familyBusy=true;familyError='';familyNotice='正在同步，请稍候…';familyPaint();
 document.querySelectorAll('[data-family],#family-create button,#family-join button').forEach(b=>b.disabled=true);
 try{
  const result=await familyRequest(action,data);
  if(action==='invite'){familyInvite=result;familyNotice='邀请已生成，请交给信任的家人。';}
  else{familyState=result;familyChecked=Date.now();familyNotice=({create:'守护圈已创建。请生成家庭邀请口令。',join:'已绑定，双方可以同步求助状态。',help:'求助已保存到守护圈，等待家人确认。急事请直接打电话。',ack:'已确认联系，长辈刷新后可以看到。',unlink:'绑定和邀请已撤销，共享求助记录已删除。'})[action]||'状态已更新。';if(action==='help'){saveLocal('yihu-family-pending','');if(!result.alerts.some(a=>!a.ack_ms))familyNotice='这条求助已被家人确认联系，请查看记录。';}if(action==='unlink'){familyInvite=null;saveLocal('yihu-family-pending','');}if(action==='create'||action==='join')pushResumeIfNeeded?.();}
 }catch(e){familyNotice='';familyError=(e.name==='TimeoutError'||e.name==='AbortError')?'等待超时，操作结果尚未确认。请刷新状态；未出现求助记录时可重试，急事请直接打电话。':e.message||'连接失败，请检查网络后刷新状态';}
 finally{familyBusy=false;if(route==='family'){render();$('#main')?.focus({preventScroll:true});}}
}
document.addEventListener('submit',e=>{
 if(!['family-create','family-join'].includes(e.target.id))return;e.preventDefault();const form=e.target,data=new FormData(form),action=form.id==='family-create'?'create':'join';
 const values={consent:data.get('consent')==='on',...(action==='create'?{pilot:String(data.get('pilot')).trim()}:{invite:String(data.get('invite')).trim()})};
 if(action==='create')form.querySelector('[name=pilot]').value='';familyPerform(action,values);
});
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-family]');if(!button)return;const action=button.dataset.family;
 if(action==='refresh')return familyRefresh();
 if(action==='unlink'){if(!confirm('解除双方绑定并删除共享求助记录？未使用的邀请也会失效。本机联系簿不受影响。'))return;}
 if(action==='copy'){try{await navigator.clipboard.writeText(familyInvite.invite);toast('口令已复制，请发给信任的家人');}catch{const field=$('#family-invite-value');field?.select();toast('请长按口令并复制');}return;}
 let data={};
 if(action==='help'){let requestId=readLocal('yihu-family-pending','');if(!/^[-a-f0-9]{36}$/.test(requestId)){requestId=crypto.randomUUID();if(!saveLocal('yihu-family-pending',requestId)){toast('本机存储不可用，请直接打电话');return;}}data={requestId};}
 if(action==='ack')data={alertId:button.dataset.alertId};
 familyPerform(action,data);
});
