/* Competition demo helpers: no telemetry, no background polling. */
'use strict';
let demoBusy=false,demoMessage='',demoError='',demoHealth=null,demoUsage=null;
async function demoRequest(url,body,headers={}){
 if(navigator.onLine===false)throw Error('当前没有网络，请联网后重试。已保存的本机内容仍可查看。');
 let response;
 try{response=await fetch(url,{method:body?'POST':'GET',headers, ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});}
 catch(e){throw Error(e.name==='TimeoutError'||e.name==='AbortError'?'等待超时，操作结果尚未确认。请先刷新状态，再决定是否重试。':'连接失败，请检查网络后重试。');}
 let result;try{result=await response.json();}catch{throw Error('服务返回异常，请稍后刷新重试。');}
 if(!response.ok)throw Error(result.error||'服务暂不可用，请稍后重试。');
 return result;
}
function demoDataPage(){
 return `${back('mine','返回我的')}${heading('数据管理','查看和管理本机与云端保存的内容。')}<section class="form-panel"><h2>保存在手机里的内容</h2><p>维权记录、附件、匿名分享和联系人只保存在本机。可以在各自页面查看和删除。</p><div class="actions"><button class="secondary" data-go="records">我的维权记录</button><button class="secondary" data-go="stories">匿名分享</button><button class="secondary" data-go="guardians">联系人</button></div></section><section class="form-panel"><h2>同步到云端的内容</h2><p>人工咨询和使用反馈包含问题、回复和状态，供团队工作台查看。家庭守护圈同步绑定、求助和确认时间。通知服务保存设备令牌和发送状态。</p><div class="actions"><button class="secondary" data-go="family">管理家庭绑定</button><button class="secondary" data-go="notifications">管理通知</button></div></section><section class="form-panel"><h2>删除本机提交的云端咨询与反馈</h2><p>删除后，本机和工作台将无法查看这些问题与回复，也会移除本机咨询身份的通知订阅。家庭绑定请在上方单独解除。本机维权记录和附件不受影响。</p><button class="text-btn danger" data-demo="delete" ${demoBusy||ticketBusy?'disabled':''}>删除我的云端咨询与反馈</button><p role="status">${esc(demoMessage)}</p><p class="error" role="alert">${esc(demoError)}</p></section>`;
}
function demoStatusPage(){
 return `${back('mine','返回我的')}${heading('服务管理','供维护人员检查连接与服务状态。')}<section class="form-panel"><h2>连接与服务</h2><p>当前网络：${navigator.onLine?'设备显示已联网':'离线'}</p><p>本机版本：V0.9.3</p>${demoHealth?`<p>服务端版本：${esc(demoHealth.version)}</p><p>咨询服务：${demoHealth.tickets?'已配置':'未配置'}</p><p>通知服务：${demoHealth.push?'已配置，送达以设备为准':'未配置'}</p>`:'<p>点击下方按钮检查云端连接。</p>'}<button class="primary" data-demo="check" ${demoBusy?'disabled':''}>${demoBusy?'正在检查…':'检查服务连接'}</button><p class="error" role="alert">${esc(demoError)}</p><p role="status">${esc(demoMessage)}</p><p>此检查不会调用 AI，也不会消耗模型额度。AI 回答效果可在“问法”中用虚构问题验证。</p></section><section class="form-panel"><h2>咨询服务地址</h2><form id="ai-endpoint-form"><label class="field"><span class="field-label">HTTPS 服务地址</span><input name="endpoint" type="url" required value="${esc(aiEndpoint())}"></label><button class="secondary" type="submit">保存服务地址</button><p id="endpoint-status" role="status"></p></form></section><section class="form-panel"><h2>团队用量</h2>${demoUsage?`<p>今日 AI 请求：<strong>${demoUsage.ai.used} / ${demoUsage.ai.limit}</strong>，每人每天最多 ${demoUsage.ai.perPerson} 次。</p><p>通知订阅：${demoUsage.notifications.total} 条，开启 ${demoUsage.notifications.enabled} 条，最近发送失败 ${demoUsage.notifications.failed} 条。</p><p>统计时间：${stamp(demoUsage.serverTime)}</p>`:'<p>登录志愿者工作台后，点击“检查服务连接”查看当日 AI 用量和通知发送失败数。</p>'}<button class="secondary" data-go="volunteer">打开团队工作台</button></section>`;
}
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-demo]');if(!button||demoBusy||ticketBusy)return;
 const action=button.dataset.demo;
 if(action==='delete'&&!confirm('永久删除这台设备提交的所有云端咨询、使用反馈和回复？删除后无法恢复。'))return;
 demoBusy=true;demoError='';demoMessage='';render();
 try{
  if(action==='check'){
   demoHealth=null;demoUsage=null;
   demoHealth=await demoRequest(TICKET_ENDPOINT.replace('/api/tickets','/health'));
   demoUsage=null;
   if(operatorCredential)demoUsage=await ticketRequest('operator-status',{},true);
   demoMessage='检查完成。';
  }else if(action==='delete'){
   if(!consultationToken()){demoMessage='本机没有云端咨询身份，无需删除。';return;}
   await ticketRequest('delete-all',{confirm:true});
   ticketState=[];ticketDraft={category:'',question:''};feedbackDraft={category:'使用反馈',question:''};followupDrafts={};operatorDrafts={};ticketAccess.pilot='';ticketAccess.consent=false;ticketChecked=Date.now();
   saveLocal('yihu-consult-draft','');saveLocal('yihu-consult-pending','');
   operatorTickets=[];operatorChecked=0;demoMessage='云端咨询、反馈与回复已删除。';
  }
 }catch(e){demoError=e.message;}finally{demoBusy=false;render();}
});

document.addEventListener('submit',e=>{if(e.target.id!=='ai-endpoint-form')return;e.preventDefault();const endpoint=String(new FormData(e.target).get('endpoint')).trim();$('#endpoint-status').textContent=!validAIEndpoint(endpoint)?'地址无效，请使用项目咨询服务地址。':saveLocal('yihu-ai-endpoint',endpoint)?'服务地址已保存。':'保存失败，请检查本机存储。';});
