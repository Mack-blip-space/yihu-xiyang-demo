/* Private pilot: model key stays in the cloud. Tester credential lives in memory only. */
'use strict';
let aiCredential='',aiAnswer='',aiQuestion='',aiBusy=false;
function aiEndpoint(){const value=readLocal('yihu-ai-endpoint','');return typeof value==='string'?value:'';}
function validAIEndpoint(value){try{const u=new URL(value);return u.protocol==='https:'&&/^[a-z0-9.-]+\.app\.tcloudbase\.com$/.test(u.hostname)&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}}
function aiPanel(){return `<section class="form-panel" aria-label="AI咨询体验"><span class="label">AI 咨询 · 团队内测</span><h2>把想问的事情说一说</h2><p>${aiEndpoint()?'已填写服务地址，是否可用以实际请求结果为准。':'尚未配置云服务，开通后可在下方填写体验服务信息。'}一般回复由 AI 生成，复杂情况请咨询专业人员。</p><details><summary>配置内测服务</summary><form id="ai-setup-form"><label class="field"><span class="field-label">项目负责人提供的 HTTPS 服务地址</span><input name="endpoint" type="url" value="${esc(aiEndpoint())}" required></label><label class="field"><span class="field-label">个人内测凭证（不是模型 API 密钥）</span><input name="credential" type="password" minlength="32" maxlength="200" autocomplete="off" required></label><p>凭证仅留在本次页面内存中，重新打开需再次填写。</p><button class="secondary" type="submit">保存体验配置</button><button class="text-btn" type="button" data-ai="clear">清除配置</button><p id="ai-setup-status" role="status"></p></form></details><form id="ai-question-form"><label class="field"><span class="field-label">您的问题</span><textarea name="question" minlength="5" maxlength="1200" required placeholder="请用虚构或脱敏信息体验，不填写姓名、地址、证件号、银行卡号。">${esc(aiQuestion)}</textarea></label><label class="consent"><input type="checkbox" name="consent" required>我同意将这一条脱敏问题发送至项目云服务及阿里云百炼生成回答。不会同时发送本机记录或附件。</label><button class="primary" type="submit" ${aiBusy?'disabled':''}>${aiBusy?'正在生成，请稍候…':'向 AI 提问'}</button><p id="ai-status" role="status"></p></form><div id="ai-answer" class="preserve-text" aria-live="polite">${esc(aiAnswer)}</div><p class="field-hint">AI 内容可能有误，尚无经法学院审核的知识库支撑；不代表律师意见或机构受理。</p></section>`;}
document.addEventListener('submit',async e=>{
  if(!['ai-setup-form','ai-question-form'].includes(e.target.id))return;e.preventDefault();const form=e.target,data=new FormData(form);
  if(form.id==='ai-setup-form'){
    const endpoint=String(data.get('endpoint')).trim(),credential=String(data.get('credential')).trim();
    if(!validAIEndpoint(endpoint)){$('#ai-setup-status').textContent='请使用项目负责人提供的 CloudBase HTTPS 网关地址。';return;}
    if(credential.length<32||credential.length>200){$('#ai-setup-status').textContent='内测凭证格式不正确。';return;}
    if(!saveLocal('yihu-ai-endpoint',endpoint)){$('#ai-setup-status').textContent='地址保存失败，请检查本机空间。';return;}
    aiCredential=credential;form.querySelector('[name=credential]').value='';$('#ai-setup-status').textContent='配置已保存，尚未验证连接。';return;
  }
  if(aiBusy)return;const status=form.querySelector('#ai-status'),button=form.querySelector('button[type=submit]');
  const endpoint=aiEndpoint();if(!validAIEndpoint(endpoint)||!aiCredential){status.textContent='请先完成内测服务配置。目前没有发送问题。';return;}
  aiQuestion=String(data.get('question')).trim();if(aiQuestion.length<5||aiQuestion.length>1200||data.get('consent')!=='on'){status.textContent='请填写问题并确认发送。';return;}
  if(privateInfo(aiQuestion)){status.textContent='请先隐去电话、证件号、银行卡号或邮箱。';return;}
  aiBusy=true;button.disabled=true;status.textContent='正在生成…';aiAnswer='';$('#ai-answer').textContent='';
  try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+aiCredential},body:JSON.stringify({question:aiQuestion,consent:true}),signal:AbortSignal.timeout(35000)});
    const result=await response.json();if(!response.ok)throw new Error(typeof result.error==='string'?result.error:'服务暂不可用');
    if(typeof result.answer!=='string'||!result.answer.trim())throw new Error('服务没有返回有效回答');
    aiAnswer='AI 生成 · 未经人工审核\n\n'+result.answer.slice(0,6000);status.textContent='回答已生成。';
  }catch(error){status.textContent=error.name==='TimeoutError'?'等待超时，请稍后重试。':error instanceof TypeError?'连接失败，请检查网络和服务配置。':error.message;}
  finally{aiBusy=false;button.disabled=false;if($('#ai-answer'))$('#ai-answer').textContent=aiAnswer;}
});
document.addEventListener('click',e=>{if(e.target.closest('[data-ai="clear"]')){aiCredential='';aiAnswer='';aiQuestion='';try{localStorage.removeItem('yihu-ai-endpoint');}catch{}render();toast('已清除内测配置和当前回答');}});
