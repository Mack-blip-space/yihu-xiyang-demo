/* Human consultation pilot. Device identity persists locally; credentials stay in memory. */
'use strict';
const TICKET_ENDPOINT='https://yihu-ai-consult.1201wburbankblvd.workers.dev/api/tickets';
const TICKET_STATUS={pending:'待接单',in_progress:'处理中',replied:'已回复',closed:'已结束'};
let ticketState=[],ticketBusy=false,ticketError='',ticketNotice='',ticketChecked=0,ticketTimer=null,operatorCredential='',operatorTickets=[],operatorError='',operatorBusy=false,operatorChecked=0,ticketDraft={category:'',question:''},followupPending={},operatorPending={};
function consultationToken(create=false){
 let value=readLocal('yihu-consult-device-v1','');
 if(/^[a-f0-9]{64}$/.test(value))return value;
 if(!create)return '';
 value=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
 if(!saveLocal('yihu-consult-device-v1',value))throw Error('本机无法保存咨询身份，请检查存储权限');
 return value;
}
async function ticketRequest(action,data={},operator=false){
 const headers={'Content-Type':'application/json'};
 if(operator)headers['X-Operator-Credential']=operatorCredential;
 else {const token=consultationToken(action==='create');if(!token)throw Error('本机还没有咨询工单');headers.Authorization='Bearer '+token;}
 return demoRequest(TICKET_ENDPOINT,{action,...data},headers);
}
function ticketStatus(status){return `<span class="ticket-status status-${esc(status)}">${esc(TICKET_STATUS[status]||'状态未知')}</span>`;}
function ticketList(){
 if(ticketBusy&&!ticketChecked)return '<div class="form-panel ticket-loading" role="status">正在读取本机咨询工单…</div>';
 if(!ticketState.length)return '<div class="empty"><h3>还没有线上咨询工单</h3><p>提交后会得到咨询编号，可在这台设备查看回复。</p></div>';
 return `<div class="ticket-list">${ticketState.map(t=>`<button class="ticket-card" data-go="ticket/${t.id}"><span>${ticketStatus(t.status)}<small>${esc(t.code)}</small></span><strong>${esc(t.category)}：${esc(t.question.slice(0,42))}${t.question.length>42?'…':''}</strong><small>最近更新 ${stamp(t.updated_ms)}</small>${icon('chevron')}</button>`).join('')}</div>`;
}
function consultationPage(){
 const draft=ticketDraft.question||readLocal('yihu-consult-draft','');
 return `${moduleIntro(route==='feedback'?'使用反馈':'申请人工咨询',route==='feedback'?'比赛演示：说明操作问题，在下方查看团队处理回复。':'团队内测：提交脱敏问题，由指定志愿者查看和回复。')}<div class="notice"><strong>不是即时服务，也没有接入律所或检察机关。</strong><p>紧急危险请拨打110；普通公共法律咨询可拨打12348。请不要填写姓名、电话、住址、证件号、银行卡号，也不要上传案件材料。</p></div><form id="consultation-submit-form" class="form-panel"><h2>${route==='feedback'?'提交使用反馈':'提交一个新问题'}</h2><label class="field"><span class="field-label">问题类型</span><select name="category" required><option value="">请选择</option>${['诈骗疑虑','消费合同','投资理财','数字权益','财产纠纷','公益诉讼','其他','使用反馈'].map(x=>`<option>${x}</option>`).join('')}</select></label><label class="field"><span class="field-label">您想咨询什么？</span><textarea name="question" minlength="10" maxlength="1200" required placeholder="用虚构或脱敏信息简要说明经过和想了解的问题。">${esc(typeof draft==='string'?draft:'')}</textarea><small class="field-hint">10—1200字；不收附件。本轮内测请勿提交真实敏感案件。</small></label><label class="field"><span class="field-label">项目内测邀请码</span><input name="pilot" type="password" minlength="32" maxlength="200" autocomplete="off" required><small class="field-hint">使用负责人提供的项目邀请码，不要填写模型 API Key。</small></label><label class="consent"><input type="checkbox" name="consent" required>我同意将脱敏问题、随机设备身份和工单状态同步至项目 Cloudflare 服务（可能在境外处理），供指定内测志愿者查看。</label><button class="primary" type="submit" ${ticketBusy?'disabled':''}>${ticketBusy?'正在提交…':'确认提交人工咨询'}</button><p class="error" id="ticket-form-error" role="alert">${esc(ticketError)}</p><p id="ticket-form-status" role="status">${esc(ticketNotice)}</p></form><div class="section-head"><h2>我的咨询与反馈</h2><button class="text-btn" data-ticket="refresh">刷新</button></div><div id="ticket-list-live" aria-live="polite">${ticketList()}</div><details class="form-panel"><summary>数据与换机说明</summary><p>只同步工单问题、往来回复、随机设备身份和时间。不上传本机维权记录、联系人、家庭守护圈、附件或 AI 对话。</p><p>清除应用数据、换浏览器或换手机后不能自动恢复原工单。请保存咨询编号，但编号本身不能在其他设备登录或读取工单。</p></details>`;
}
function ticketPage(id){
 const t=ticketState.find(x=>x.id===id);
 if(!t)return `${back('consultations','返回人工咨询')}${heading('正在查找工单','请刷新；工单只在原提交设备显示。')}<button class="secondary" data-ticket="refresh">刷新状态</button>`;
 const canReply=t.status!=='closed',canClose=t.status==='replied';
 return `${back('consultations','返回我的咨询与反馈')}${heading(t.code,`${esc(t.category)} · ${TICKET_STATUS[t.status]||'状态未知'}`)}<section class="form-panel ticket-summary">${ticketStatus(t.status)}<h2>提交的问题</h2><p class="preserve-text">${esc(t.question)}</p><small>提交于 ${stamp(t.created_ms)} · 最近更新 ${stamp(t.updated_ms)}</small></section><div class="section-head"><h2>沟通记录</h2></div>${t.messages.length?`<div class="message-thread">${t.messages.map(m=>`<section class="message ${m.sender==='operator'?'message-operator':'message-user'}"><strong>${m.sender==='operator'?'志愿者回复':'我的补充'}</strong><p class="preserve-text">${esc(m.body)}</p><small>${stamp(m.created_ms)}</small></section>`).join('')}</div>`:'<div class="empty"><p>暂时没有回复。团队内测不承诺即时响应。</p></div>'}${canReply?`<form id="ticket-followup-form" class="form-panel" data-ticket-id="${esc(t.id)}"><h2>补充说明</h2><label class="field"><span class="field-label">只补充脱敏文字</span><textarea name="body" minlength="2" maxlength="1200" required></textarea></label><button class="secondary" type="submit" ${ticketBusy?'disabled':''}>提交补充说明</button><p class="error" role="alert">${esc(ticketError)}</p></form>`:''}<p class="error" role="alert">${esc(ticketError)}</p><div class="actions"><button class="secondary" data-ticket="refresh">刷新状态</button>${canClose?`<button class="primary" data-ticket="close" data-ticket-id="${esc(t.id)}">我已看完，确认结束</button>`:''}</div>${t.status==='closed'?'<div class="notice soft">这条咨询已经结束。如有新的问题，请重新提交工单。</div>':''}`;
}
function volunteerPage(){
 if(!operatorCredential)return `${back('mine','返回我的')}${heading('志愿者工作台','仅供项目指定内测人员使用。')}<div class="notice">工作台会显示用户主动提交的脱敏问题。不得复制外传，不得索要姓名、电话、证件、银行卡或原始案件材料。</div><form id="operator-login-form" class="form-panel"><label class="field"><span class="field-label">志愿者工作台凭证</span><input name="credential" type="password" minlength="32" maxlength="200" autocomplete="off" required></label><button class="primary" type="submit">进入工作台</button><p class="error" role="alert">${esc(operatorError)}</p></form>`;
 const counts={pending:0,in_progress:0,replied:0};operatorTickets.forEach(t=>counts[t.status]=(counts[t.status]||0)+1);
 return `${back('mine','返回我的')}${heading('志愿者工作台','团队内测 · 不代表律师服务或机构受理')}<div class="ticket-stats"><section><strong>${counts.pending}</strong><span>待接单</span></section><section><strong>${counts.in_progress}</strong><span>处理中</span></section><section><strong>${counts.replied}</strong><span>已回复</span></section></div><div class="actions"><button class="secondary" data-operator="refresh">刷新队列</button><button class="text-btn" data-operator="logout">退出工作台</button></div><button class="secondary" data-go="demo-status">查看服务与用量</button><p class="error" role="alert">${esc(operatorError)}</p>${operatorBusy?'<div class="form-panel ticket-loading" role="status">正在同步队列…</div>':''}<div class="operator-queue">${operatorTickets.length?operatorTickets.map(operatorCard).join(''):'<div class="empty"><p>目前没有待处理咨询或反馈。</p></div>'}</div>`;
}
function operatorCard(t){
 return `<section class="form-panel operator-ticket">${ticketStatus(t.status)}<span class="label">${esc(t.code)} · ${esc(t.category)}</span><h2>用户问题</h2><p class="preserve-text">${esc(t.question)}</p><small>提交 ${stamp(t.created_ms)} · 更新 ${stamp(t.updated_ms)}</small>${t.messages.length?`<div class="message-thread compact">${t.messages.map(m=>`<div class="message ${m.sender==='operator'?'message-operator':'message-user'}"><strong>${m.sender==='operator'?'志愿者':'用户补充'}</strong><p class="preserve-text">${esc(m.body)}</p><small>${stamp(m.created_ms)}</small></div>`).join('')}</div>`:''}${t.status==='pending'?`<button class="primary" data-operator="claim" data-ticket-id="${t.id}">接下这条咨询</button>`:`<form class="operator-reply-form" data-ticket-id="${t.id}"><label class="field"><span class="field-label">回复用户</span><textarea name="body" minlength="2" maxlength="1500" required placeholder="给出一般信息、核实事项和下一步建议；不作结果承诺。"></textarea></label><button class="primary" type="submit">发送回复</button></form><button class="text-btn danger" data-operator="close" data-ticket-id="${t.id}">结束这条工单</button>`}</section>`;
}
async function refreshTickets(renderAfter=true){
 if(ticketBusy||!consultationToken())return;ticketBusy=true;ticketError='';ticketChecked=Date.now();
 try{const result=await ticketRequest('list');ticketState=result.tickets;ticketChecked=Date.now();}
 catch(e){ticketError=e.name==='TimeoutError'?'同步超时，请稍后刷新':e.message||'同步失败';}
 finally{ticketBusy=false;if(renderAfter&&(route==='consultations'||route==='feedback'||route.startsWith('ticket/')))render();}
}
async function refreshOperator(){
 if(operatorBusy||!operatorCredential)return;operatorBusy=true;operatorError='';operatorChecked=Date.now();if(route==='volunteer')render();
 try{operatorTickets=(await ticketRequest('operator-list',{},true)).tickets;operatorChecked=Date.now();}
 catch(e){operatorError=e.name==='TimeoutError'?'队列同步超时，请重试':e.message||'工作台连接失败';if(/凭证/.test(operatorError))operatorCredential='';}
 finally{operatorBusy=false;if(route==='volunteer')render();}
}
function ticketAfterRender(){
 clearTimeout(ticketTimer);
 if((route==='consultations'||route==='feedback')&&(ticketDraft.category||route==='feedback')){const select=$('#consultation-submit-form [name=category]');if(select)select.value=route==='feedback'?'使用反馈':ticketDraft.category;}
 if((route==='consultations'||route==='feedback'||route.startsWith('ticket/'))&&!ticketError&&consultationToken()&&Date.now()-ticketChecked>15000)ticketTimer=setTimeout(()=>refreshTickets(),0);
 if(route==='volunteer'&&operatorCredential&&!operatorBusy&&!operatorError&&Date.now()-operatorChecked>15000)ticketTimer=setTimeout(refreshOperator,0);
}
setInterval(()=>{if(!document.hidden&&(route==='consultations'||route==='feedback'||route.startsWith('ticket/')))refreshTickets();},20000);
document.addEventListener('submit',async e=>{
 const form=e.target,data=new FormData(form);
 if(form.id==='consultation-submit-form'){
  e.preventDefault();if(ticketBusy)return;ticketDraft={category:String(data.get('category')),question:String(data.get('question')).trim()};ticketBusy=true;ticketError='';ticketNotice='正在创建咨询工单…';render();
  try{let requestId=readLocal('yihu-consult-pending','');if(!/^[a-f0-9-]{36}$/.test(requestId)){requestId=crypto.randomUUID();saveLocal('yihu-consult-pending',requestId);}const result=await ticketRequest('create',{requestId,category:ticketDraft.category,question:ticketDraft.question,pilot:String(data.get('pilot')).trim(),consent:data.get('consent')==='on'});ticketState=ticketState.filter(x=>x.id!==result.ticket.id);ticketState.unshift(result.ticket);ticketChecked=Date.now();ticketDraft={category:'',question:''};saveLocal('yihu-consult-draft','');saveLocal('yihu-consult-pending','');ticketNotice=`提交成功，咨询编号 ${result.ticket.code}`;route='ticket/'+result.ticket.id;location.hash=route;}
  catch(err){ticketError=err.name==='TimeoutError'?'等待超时，结果尚未确认。请刷新工单列表，确认没有新增后再重试。':err.message;}
  finally{ticketBusy=false;render();}return;
 }
 if(form.id==='ticket-followup-form'){
  e.preventDefault();if(ticketBusy)return;ticketBusy=true;ticketError='';const id=form.dataset.ticketId,requestId=followupPending[id]||crypto.randomUUID();followupPending[id]=requestId;try{const result=await ticketRequest('followup',{ticketId:id,body:String(data.get('body')).trim(),requestId});delete followupPending[id];ticketState=ticketState.map(x=>x.id===result.ticket.id?result.ticket:x);ticketNotice='补充说明已提交。';}catch(err){ticketError=err.name==='TimeoutError'?'等待超时，请先刷新确认；未出现补充内容时可重试':err.message;}finally{ticketBusy=false;render();}return;
 }
 if(form.id==='operator-login-form'){
  e.preventDefault();operatorCredential=String(data.get('credential')).trim();form.querySelector('[name=credential]').value='';operatorError='';await refreshOperator();pushResumeIfNeeded?.();return;
 }
 if(form.classList.contains('operator-reply-form')){
  e.preventDefault();if(operatorBusy)return;operatorBusy=true;operatorError='';const id=form.dataset.ticketId,requestId=operatorPending[id]||crypto.randomUUID();operatorPending[id]=requestId;try{const result=await ticketRequest('operator-reply',{ticketId:id,body:String(data.get('body')).trim(),requestId},true);delete operatorPending[id];operatorTickets=operatorTickets.map(x=>x.id===result.ticket.id?result.ticket:x);operatorChecked=Date.now();}catch(err){operatorError=err.name==='TimeoutError'?'等待超时，请先刷新确认；未出现回复时可重试':err.message;}finally{operatorBusy=false;render();}
 }
});
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-ticket],[data-operator],[data-ai-handoff]');if(!b)return;
 if((b.dataset.ticket&&ticketBusy)||(b.dataset.operator&&operatorBusy))return;
 if(b.dataset.aiHandoff!==undefined){saveLocal('yihu-consult-draft',aiQuestion);location.hash='consultations';return;}
 if(b.dataset.ticket==='refresh'){await refreshTickets();return;}
 if(b.dataset.ticket==='close'){if(!confirm('确认已经看完回复并结束这条咨询？结束后不能继续补充。'))return;ticketBusy=true;try{const result=await ticketRequest('close',{ticketId:b.dataset.ticketId});ticketState=ticketState.map(x=>x.id===result.ticket.id?result.ticket:x);ticketNotice='工单已经结束。';}catch(err){ticketError=err.message;}finally{ticketBusy=false;render();}return;}
 if(b.dataset.operator==='logout'){operatorCredential='';operatorTickets=[];operatorError='';demoUsage=null;render();return;}
 if(b.dataset.operator==='refresh'){await refreshOperator();return;}
 if(b.dataset.operator==='claim'){operatorBusy=true;try{const result=await ticketRequest('operator-claim',{ticketId:b.dataset.ticketId},true);operatorTickets=operatorTickets.map(x=>x.id===result.ticket.id?result.ticket:x);operatorChecked=Date.now();}catch(err){operatorError=err.message;}finally{operatorBusy=false;render();}return;}
 if(b.dataset.operator==='close'){if(!confirm('确认结束这条工单？用户将不能继续补充。'))return;operatorBusy=true;try{const result=await ticketRequest('operator-close',{ticketId:b.dataset.ticketId},true);operatorTickets=operatorTickets.filter(x=>x.id!==result.ticket.id);operatorChecked=Date.now();}catch(err){operatorError=err.message;}finally{operatorBusy=false;render();}}
});
