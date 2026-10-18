/* Private pilot: model key stays in the cloud. Tester credential lives in memory only. */
'use strict';
let aiCredential='',aiAnswer='',aiQuestion='',aiBusy=false,aiReferences=[];
function aiReferenceLinks(){return aiReferences.length?'<div class="ai-references"><h3>本次检索参考</h3>'+aiReferences.map(r=>'<button class="secondary" data-go="'+facultyRoute(r)+'">'+esc(r.title)+'</button>').join('')+'</div>':'';}
const DEFAULT_AI_ENDPOINT='https://yihu-ai-consult.1201wburbankblvd.workers.dev/api/consult';
function aiEndpoint(){const value=readLocal('yihu-ai-endpoint','');return typeof value==='string'&&value.trim()?value:DEFAULT_AI_ENDPOINT;}
function validAIEndpoint(value){try{const u=new URL(value);const cloudbase=/^[a-z0-9.-]+\.app\.tcloudbase\.com$/.test(u.hostname);const worker=u.hostname==='yihu-ai-consult.1201wburbankblvd.workers.dev'&&u.pathname==='/api/consult';return u.protocol==='https:'&&(cloudbase||worker)&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}}
function aiPanel(){return `<section class="form-panel" aria-label="AI咨询体验"><span class="label">AI 智能问法</span><h2>把想问的事情说一说</h2><p>输入邀请码后即可提问。回答由 AI 生成，复杂情况请咨询专业人员。</p><details open><summary>输入内测邀请码</summary><form id="ai-setup-form"><label class="field"><span class="field-label">内测邀请码</span><input name="credential" type="password" minlength="32" maxlength="200" autocomplete="off" required></label><p>邀请码仅在本次打开期间有效保存，重新打开需再次输入。请勿填写模型 API Key。</p><details class="ai-advanced"><summary>高级设置（负责人使用）</summary><label class="field"><span class="field-label">项目负责人提供的 HTTPS 服务地址</span><input name="endpoint" type="url" value="${esc(aiEndpoint())}" required></label></details><button class="secondary" type="submit">开始体验</button><button class="text-btn" type="button" data-ai="clear">退出内测</button><p id="ai-setup-status" role="status"></p></form></details><form id="ai-question-form"><label class="field"><span class="field-label">您的问题</span><textarea name="question" minlength="5" maxlength="1200" required placeholder="请用虚构或脱敏信息体验，不填写姓名、地址、证件号、银行卡号。">${esc(aiQuestion)}</textarea></label><label class="consent"><input type="checkbox" name="consent" required>我同意将这一条脱敏问题发送至项目云服务（Cloudflare 服务可能在境外处理）及千问模型平台生成回答。不会同时发送本机记录或附件。</label><button class="primary" type="submit" ${aiBusy?'disabled':''}>${aiBusy?'正在生成，请稍候…':'向 AI 提问'}</button><p id="ai-status" role="status"></p></form><div id="ai-answer" class="preserve-text" aria-live="polite">${esc(aiAnswer)}</div><div id="ai-references">${aiReferenceLinks()}</div>${aiQuestion?'<button class="secondary" data-ai-handoff>整理后申请人工咨询</button>':''}<p class="field-hint">AI 优先参考知识库资料，回答本身仍由 AI 生成；不代表律师意见或机构受理。</p></section>`;}
document.addEventListener('submit',async e=>{
  if(!['ai-setup-form','ai-question-form'].includes(e.target.id))return;e.preventDefault();const form=e.target,data=new FormData(form);
  if(form.id==='ai-setup-form'){
    const endpoint=String(data.get('endpoint')).trim(),credential=String(data.get('credential')).trim();
    if(!validAIEndpoint(endpoint)){$('#ai-setup-status').textContent='请使用项目负责人提供的 Cloudflare 咨询地址或 CloudBase HTTPS 网关地址。';return;}
    if(credential.length<32||credential.length>200){$('#ai-setup-status').textContent='请粘贴负责人提供的完整内测邀请码。';return;}
    if(!saveLocal('yihu-ai-endpoint',endpoint)){$('#ai-setup-status').textContent='地址保存失败，请检查本机空间。';return;}
    aiCredential=credential;form.querySelector('[name=credential]').value='';$('#ai-setup-status').textContent='邀请码已填写，请在下方提问；是否有效以服务返回结果为准。';return;
  }
  if(aiBusy)return;const status=form.querySelector('#ai-status'),button=form.querySelector('button[type=submit]');
  const endpoint=aiEndpoint();if(!validAIEndpoint(endpoint)||!aiCredential){status.textContent='请先输入内测邀请码。目前没有发送问题。';return;}
  aiQuestion=String(data.get('question')).trim();if(aiQuestion.length<5||aiQuestion.length>1200||data.get('consent')!=='on'){status.textContent='请填写问题并确认发送。';return;}
  if(privateInfo(aiQuestion)){status.textContent='请先隐去电话、证件号、银行卡号或邮箱。';return;}
  aiBusy=true;button.disabled=true;status.textContent='正在生成…';aiAnswer='';aiReferences=[];$('#ai-answer').textContent='';$('#ai-references').textContent='';
  try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+aiCredential},body:JSON.stringify({question:aiQuestion,consent:true}),signal:AbortSignal.timeout(35000)});
    const result=await response.json();if(!response.ok)throw new Error(typeof result.error==='string'?result.error:'服务暂不可用');
    if(result.knowledgeVersion!=='2026-10-15')throw new Error('AI 知识库正在升级，请先查阅上方常见问答，或咨询12348。');
    if(typeof result.answer!=='string'||!result.answer.trim())throw new Error('服务没有返回有效回答');
    aiReferences=Array.isArray(result.references)?result.references.map(r=>facultyRecord(r.id)).filter(Boolean):[];
    aiAnswer=(result.answerMode==='reviewed-excerpt'?'参考资料摘要 · 请结合具体情况':'AI 生成 · 未经人工审核')+'\n\n'+result.answer.slice(0,6000);status.textContent=result.reviewedKnowledge?'回答已生成，下方可查看本次检索资料。':'回答已生成；本次未匹配到参考资料，请进一步核实。';
  }catch(error){status.textContent=error.name==='TimeoutError'?'等待超时，请稍后重试。':error instanceof TypeError?'连接失败，请检查网络和服务配置。':error.message;}
  finally{aiBusy=false;button.disabled=false;if($('#ai-answer'))$('#ai-answer').textContent=aiAnswer;if($('#ai-references'))$('#ai-references').innerHTML=aiReferenceLinks();}
});
document.addEventListener('click',e=>{if(e.target.closest('[data-ai="clear"]')){aiCredential='';aiAnswer='';aiQuestion='';aiReferences=[];try{localStorage.removeItem('yihu-ai-endpoint');}catch{}render();toast('已退出内测并清除当前回答，服务地址恢复默认');}});
