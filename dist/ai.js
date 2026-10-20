/* Private pilot: model key stays in the cloud. Tester credential lives in memory only. */
'use strict';
let aiCredential='',aiAnswer='',aiQuestion='',aiBusy=false,aiReferences=[],aiDraft='',aiConsent=false,aiStatus='',aiEpoch=0;
function aiReferenceLinks(){return aiReferences.length?'<div class="ai-references"><h3>本次检索参考</h3>'+aiReferences.map(r=>'<button class="secondary" data-go="'+facultyRoute(r)+'">'+esc(r.title)+'</button>').join('')+'</div>':'';}
const DEFAULT_AI_ENDPOINT='https://swucat.top/yihu-api/api/consult';
const LEGACY_AI_ENDPOINT='https://yihu-ai-consult.1201wburbankblvd.workers.dev/api/consult';
function aiEndpoint(){const value=readLocal('yihu-ai-endpoint','');return typeof value==='string'&&value.trim()&&value!==LEGACY_AI_ENDPOINT?value:DEFAULT_AI_ENDPOINT;}
function validAIEndpoint(value){try{const u=new URL(value);const cloudbase=/^[a-z0-9.-]+\.app\.tcloudbase\.com$/.test(u.hostname);const worker=u.hostname==='yihu-ai-consult.1201wburbankblvd.workers.dev'&&u.pathname==='/api/consult';const ecs=u.hostname==='swucat.top'&&u.pathname==='/yihu-api/api/consult';return u.protocol==='https:'&&(cloudbase||worker||ecs)&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}}
function aiHealthEndpoint(endpoint){const u=new URL(endpoint);u.pathname=u.pathname.replace(/\/api\/consult$/,'/health');return u.href;}
function aiPanel(){return `<section class="form-panel ai-panel" aria-label="AI咨询体验"><span class="label">AI 智能问法</span><h2>把想问的事情说一说</h2><p>回答由 AI 生成，复杂情况请咨询专业人员。</p><form id="ai-question-form"><label class="field"><span class="field-label">您的问题</span><textarea name="question" minlength="5" maxlength="1200" required placeholder="请用虚构或脱敏信息描述问题，不填写个人敏感资料。">${esc(aiDraft)}</textarea></label><label class="consent"><input type="checkbox" name="consent" ${aiConsent?'checked':''} required>我同意将这一条脱敏问题发送至项目云服务及千问模型平台生成回答。不会同时发送本机记录或附件。</label><button class="primary" type="submit" ${aiBusy?'disabled':''}>${aiBusy?'正在生成，请稍候…':'向 AI 提问'}</button><p id="ai-status" role="status">${esc(aiStatus)}</p></form><details class="ai-access" ${aiCredential?'':'open'}><summary>${aiCredential?'邀请码已填写 · 更换或退出':'首次使用：输入邀请码'}</summary><form id="ai-setup-form"><label class="field"><span class="field-label">邀请码</span><input name="credential" type="password" minlength="32" maxlength="200" autocomplete="off" required></label><p>邀请码由服务提供方提供，只在本次打开期间保存。</p><button class="secondary" type="submit">开始体验</button><button class="text-btn" type="button" data-ai="clear">退出咨询</button><p id="ai-setup-status" role="status"></p></form></details><div id="ai-answer" class="preserve-text" aria-live="polite">${esc(aiAnswer)}</div><div id="ai-references">${aiReferenceLinks()}</div><button class="secondary" data-ai-handoff>整理后申请人工咨询</button><p class="field-hint">AI 优先参考知识库资料，回答不代表律师意见或机构受理。未提交的问题在本次打开期间保留。</p></section>`;}
document.addEventListener('input',e=>{if(e.target.matches('#ai-question-form textarea'))aiDraft=e.target.value;});
document.addEventListener('change',e=>{if(e.target.matches('#ai-question-form [name=consent]'))aiConsent=e.target.checked;});
function aiSetStatus(message){aiStatus=message;if($('#ai-status'))$('#ai-status').textContent=message;}
// Include body reads in the deadline, including on older Android WebViews.
async function aiFetchJSON(url,options={},timeoutMs=35000){
  const controller=new AbortController();let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  try{const response=await fetch(url,{...options,signal:controller.signal});const result=await response.json();return {response,result};}
  catch(error){if(timedOut){const e=new Error('请求超时');e.name='TimeoutError';throw e;}throw error;}
  finally{clearTimeout(timer);}
}
async function aiCheckConnection(endpoint){
  if(navigator.onLine===false)throw Error('当前设备没有联网。问题仍保留，请联网后再试。');
  // The historical CloudBase endpoint does not implement the Worker health route.
  if(!new URL(endpoint).pathname.endsWith('/api/consult'))return;
  try{
    const {response,result}=await aiFetchJSON(aiHealthEndpoint(endpoint),{method:'GET',cache:'no-store',credentials:'omit'},8000);
    if(!response.ok||result.service!=='yihu-ai-pilot')throw Error('health');
  }catch{throw Error('当前网络无法连接咨询服务，尚未提交问题。问题仍保留，请切换 Wi-Fi 或移动网络再试；持续失败请联系负责人检查服务入口。');}
}

document.addEventListener('submit',async e=>{
  if(!['ai-setup-form','ai-question-form'].includes(e.target.id))return;e.preventDefault();const form=e.target,data=new FormData(form);
  if(form.id==='ai-setup-form'){
    const endpoint=aiEndpoint(),credential=String(data.get('credential')).trim();
    if(!validAIEndpoint(endpoint)){$('#ai-setup-status').textContent='咨询服务地址无效，请联系服务提供方。';return;}
    if(credential.length<32||credential.length>200){$('#ai-setup-status').textContent='请粘贴负责人提供的完整邀请码。';return;}
    if(!saveLocal('yihu-ai-endpoint',endpoint)){$('#ai-setup-status').textContent='地址保存失败，请检查本机空间。';return;}
    aiCredential=credential;form.querySelector('[name=credential]').value='';render();aiSetStatus('邀请码已填写，可以提交问题；是否有效以服务返回结果为准。');return;
  }
  if(aiBusy)return;const button=form.querySelector('button[type=submit]'),epoch=aiEpoch;
  const endpoint=aiEndpoint();if(!validAIEndpoint(endpoint)||!aiCredential){aiSetStatus('请先在下方输入邀请码。目前没有发送问题。');return;}
  aiQuestion=String(data.get('question')).trim();if(aiQuestion.length<5||aiQuestion.length>1200||data.get('consent')!=='on'){aiSetStatus('请填写问题并确认发送。');return;}
  if(privateInfo(aiQuestion)){aiSetStatus('请先隐去电话、证件号、银行卡号或邮箱。');return;}
  aiBusy=true;button.disabled=true;aiSetStatus('正在检查服务连接…');aiAnswer='';aiReferences=[];$('#ai-answer').textContent='';$('#ai-references').textContent='';
  try{
    await aiCheckConnection(endpoint);if(epoch!==aiEpoch)return;
    aiSetStatus('已连接服务，正在生成回答…');
    const {response,result}=await aiFetchJSON(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+aiCredential},body:JSON.stringify({question:aiQuestion,consent:true})});
    if(epoch!==aiEpoch)return;if(!response.ok)throw new Error(typeof result.error==='string'?result.error:'服务暂不可用');
    if(result.knowledgeVersion!=='2026-10-15')throw new Error('AI 知识库正在升级，请先查阅下方常见问答，或咨询12348。');
    if(typeof result.answer!=='string'||!result.answer.trim())throw new Error('服务没有返回有效回答');
    aiReferences=Array.isArray(result.references)?result.references.map(r=>facultyRecord(r.id)).filter(Boolean):[];
    aiAnswer=(result.answerMode==='reviewed-excerpt'?'参考资料摘要 · 请结合具体情况':'AI 生成 · 未经人工审核')+'\n\n'+result.answer.slice(0,6000);aiSetStatus(result.reviewedKnowledge?'回答已生成，下方可查看本次检索资料。':'回答已生成；本次未匹配到参考资料，请进一步核实。');
  }catch(error){if(epoch!==aiEpoch)return;aiSetStatus(error.name==='TimeoutError'?'服务已连接，但未及时收到回答，可能是网络中断或生成较慢。问题仍保留；本次可能已计入额度，请勿连续重复提交。':error instanceof TypeError?'连接中断，未能收到回答。问题仍保留，请检查网络后重试。':error.message);}
  finally{if(epoch===aiEpoch){aiBusy=false;if(route==='ask'){const b=$('#ai-question-form button[type=submit]');if(b){b.disabled=false;b.textContent='向 AI 提问';}if($('#ai-answer'))$('#ai-answer').textContent=aiAnswer;if($('#ai-references'))$('#ai-references').innerHTML=aiReferenceLinks();}}}
});
document.addEventListener('click',e=>{if(e.target.closest('[data-ai="clear"]')){aiEpoch++;aiBusy=false;aiCredential='';aiAnswer='';aiQuestion='';aiDraft='';aiConsent=false;aiStatus='';aiReferences=[];try{localStorage.removeItem('yihu-ai-endpoint');}catch{}render();toast('已退出咨询并清除本次问题与回答');}});
