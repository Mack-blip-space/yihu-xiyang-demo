'use strict';
let vaultCache=[],vaultDbPromise=null,snapshotBusy=false;
function vaultDB(){if(!vaultDbPromise)vaultDbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('yihu-evidence-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('snapshots',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>{vaultDbPromise=null;reject(req.error);};});return vaultDbPromise;}
async function vaultOperation(method,value){const vdb=await vaultDB();return new Promise((resolve,reject)=>{const tx=vdb.transaction('snapshots',method==='getAll'?'readonly':'readwrite');const req=tx.objectStore('snapshots')[method](...(value===undefined?[]:[value]));tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
async function loadVault(){try{vaultCache=(await vaultOperation('getAll')).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));if(route==='vault')render();}catch{if(route==='vault')toast('材料快照存储暂不可用。');}}
async function digestBlob(blob){if(!globalThis.crypto?.subtle)throw new Error('当前环境不能计算校验值，请使用安卓 App 或 HTTPS 网页');const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
async function snapshotRecord(record){
  if(snapshotBusy)return;
  if(!record.description?.trim()&&!record.files?.length){toast('还没有可保存的经过或附件，请先记录问题。');return;}
  snapshotBusy=true;
  try{
    const existing=await vaultOperation('getAll');if(existing.length>=30)throw new Error('已保存 30 份快照，请先导出并删除不需要的快照');
    const attachments=record.files||[];const checks=[];
    for(const f of attachments)checks.push({name:f.name,size:f.size,type:f.type,sha256:await digestBlob(f.blob||f)});
    const createdAt=new Date().toISOString();
    const manifest={version:1,sourceRecord:record.id||'未提交草稿',createdAt,timeSource:'设备时间，未经权威授时',description:record.description||'',type:record.type||'不太清楚',date:record.date||'',amount:record.amount||'',other:record.other||'',files:checks};
    const manifestText=JSON.stringify(manifest,null,2);
    const snap={id:'SNAP-'+newLocalId(),createdAt,manifest:manifestText,sha256:await digestBlob(new Blob([manifestText])),files:attachments.map(f=>({name:f.name,size:f.size,type:f.type,blob:f.blob||f}))};
    await vaultOperation('put',snap);vaultCache.unshift(snap);toast('材料副本和校验清单已保存至本机');
    if(route==='vault')render();const status=$('#snapshot-status');if(status)status.textContent='已保存材料快照。可到“材料快照”查看与核对。';
  }catch(e){toast('保存未成功：'+e.message+'。原材料没有删除。');}finally{snapshotBusy=false;}
}
async function verifySnapshot(snap){
  if(await digestBlob(new Blob([snap.manifest]))!==snap.sha256)return false;
  const manifest=JSON.parse(snap.manifest);if(snap.files.length!==manifest.files.length)return false;
  for(let i=0;i<snap.files.length;i++)if(snap.files[i].name!==manifest.files[i].name||snap.files[i].size!==manifest.files[i].size||await digestBlob(snap.files[i].blob)!==manifest.files[i].sha256)return false;
  return true;
}
function vaultPage(){return `${moduleIntro('材料快照','保存当时的经过和附件副本，便于以后核对。')}<div class="notice soft">本机快照使用 SHA-256 校验内容是否变化，时间来自设备。它不是公证、司法存证或电子签章，不能证明事实真实或替代原始证据。</div><section class="form-panel"><h2>从已有记录保存一份副本</h2>${records.length?`<label class="field"><span class="field-label">选择记录</span><select id="snapshot-record">${records.map(r=>`<option value="${esc(r.id)}">${esc(r.type)} · ${stamp(r.createdAt)} · ${esc(r.description.slice(0,24))}</option>`).join('')}</select></label><button class="primary" data-module="snapshot-record">保存这条记录的快照</button>`:'<p>还没有维权记录，可以先填写经过并添加材料。</p><button class="primary" data-go="report">开始记录</button>'}<p id="snapshot-status" role="status"></p></section><div class="section-head"><h2>已保存 ${vaultCache.length} 份</h2></div>${vaultCache.length?vaultCache.map(s=>`<section class="form-panel"><h3>${stamp(s.createdAt)}</h3><p>${s.files.length} 份附件 · 本机不可编辑副本</p><small class="hash-value">清单校验值 ${s.sha256}</small><div class="actions"><button class="secondary" data-snapshot-view="${s.id}">查看与校验</button><button class="text-btn danger" data-snapshot-delete="${s.id}">删除快照</button></div></section>`).join(''):'<div class="empty"><p>保存后会出现在这里；删除原记录不会自动删除已有快照。</p></div>'}`;}
function showSnapshot(id){const s=vaultCache.find(x=>x.id===id);if(!s)return;const m=JSON.parse(s.manifest);modal('查看材料快照',`<p class="preserve-text">${esc(m.description)}</p><p>${esc(m.type)} · ${stamp(s.createdAt)}（设备时间）</p><div class="actions"><button class="primary" data-snapshot-verify="${s.id}">核对完整性</button><button class="secondary" data-snapshot-export="${s.id}">导出校验清单</button></div><p id="verify-status" role="status"></p><p>清单不含附件本体，附件请逐个导出。</p>${s.files.map((f,i)=>`<button class="setting" data-snapshot-file="${i}" data-snapshot="${s.id}">${icon('download')}<span>${esc(f.name)}</span></button>`).join('')}`);}
async function learningReminder(enabled){const status=$('#reminder-status');const plugin=window.Capacitor?.Plugins?.LocalNotifications;const say=t=>{if(status)status.textContent=t;else toast(t);};if(!nativeApp()||!plugin){say('每日提醒需要在安卓 App 中设置；网页版可直接打开课堂学习。');return;}
  try{
    if(!enabled){await plugin.cancel({notifications:[{id:9001}]});say('本机每日学习提醒已关闭。');return;}
    let permission=await plugin.checkPermissions();if(permission.display!=='granted')permission=await plugin.requestPermissions();if(permission.display!=='granted'){say('没有获得通知权限，未开启提醒。您仍可正常学习。');return;}
    await plugin.createChannel({id:'learning',name:'每日反诈课堂',importance:3,visibility:0});
    await plugin.schedule({notifications:[{id:9001,title:'益护夕阳 · 每天学一点',body:'有空时看看今天的防骗情景，慢慢学，不着急。',channelId:'learning',schedule:{on:{hour:9,minute:0},repeats:true},isExactNotification:false,extra:{route:'classroom'}}]});
    say('已设置每天上午 9 点的本机学习提醒，实际到达可能受系统设置影响。');
  }catch{say('提醒未能设置成功，请检查系统通知设置后重试。');}
}
document.addEventListener('submit',e=>{
  const form=e.target,data=new FormData(form),state=moduleStore();
  if(form.id==='risk-form'){e.preventDefault();const q=RISK_QUESTIONS[riskIndex],answer=data.get('risk-answer');if(!q.options.some(o=>o[0]===answer))return;riskAnswers[q.key]=answer;if(riskIndex<3)riskIndex++;else riskDone=true;render();window.scrollTo(0,0);}
  if(form.id==='quiz-form'){e.preventDefault();const lesson=M.lessons.find(l=>l.id===form.dataset.lesson),answer=data.get('answer');if(answer===null)return;const correct=Number(answer)===lesson.answer;$('#quiz-feedback').textContent=(correct?'答对了。':'再想一想。')+lesson.explain;if(correct){state.learned[lesson.id]=new Date().toISOString();saveModule(state);}}
  if(form.id==='faq-search-form'){e.preventDefault();faqSearch=String(data.get('query')).trim();$('#faq-results').innerHTML=faqResults();}
  if(form.id==='guardian-form'){e.preventDefault();const name=String(data.get('name')).trim(),phone=String(data.get('phone')).trim(),relation=String(data.get('relation'));const fail=t=>$('#guardian-error').textContent=t;if(!name||!/^\+?[\d\s()-]{5,24}$/.test(phone))return fail('请填写称呼和有效的联系电话。');if(guardianContacts().length>=6)return fail('最多保存 6 位联系人，请先移除不需要的联系人。');if(guardianContacts().some(c=>c.phone.replace(/\D/g,'')===phone.replace(/\D/g,'')))return fail('这个号码已经保存在联系簿中。');state.guardians.push({id:newLocalId(),name,phone,relation});if(saveModule(state)){render();toast('联系人已保存到本机，没有向对方发送邀请');}}
  if(form.id==='consultation-form'){e.preventDefault();const text=String(data.get('question')).trim();if(text.length<5||text.length>1200){$('#consultation-error').textContent='请填写 5—1200 字的问题。';return;}if(privateInfo(text)){$('#consultation-error').textContent='请先隐去证件号、银行卡号、电话或邮箱。';return;}if(state.questions.length>=30){$('#consultation-error').textContent='最多保存 30 条备忘，请先整理已有问题。';return;}state.questions.unshift({id:newLocalId(),text,createdAt:new Date().toISOString()});if(saveModule(state)){render();toast('问题已记在本机，尚未发送');}}
  if(form.id==='service-form'){e.preventDefault();const service=Object.fromEntries(data);for(const k in service)service[k]=String(service[k]).trim();if(!service.name||!service.area||!service.hours||!/^\+?[\d\s()-]{5,24}$/.test(service.phone)){$('#service-error').textContent='请填写名称、有效电话、地区和服务时间。';return;}if(state.services.length>=20){$('#service-error').textContent='最多保存 20 条服务信息，请先整理。';return;}state.services.push({id:newLocalId(),...service});if(saveModule(state)){render();toast('服务信息仅保存到本机');}}
});
document.addEventListener('input',e=>{if(e.target.id==='case-search'){caseSearch=e.target.value;$('#case-results').innerHTML=caseResults();}});
document.addEventListener('change',e=>{if(e.target.id==='path-type')navigate('path/'+encodeURIComponent(e.target.value));if(e.target.dataset.evidenceCheck){const state=moduleStore();state.evidenceChecks[e.target.dataset.evidenceCheck]=e.target.checked;if(saveModule(state))$('#evidence-progress').textContent=`已整理 ${Object.values(state.evidenceChecks).filter(Boolean).length} / ${EVIDENCE_ITEMS.length} 项`;else e.target.checked=!e.target.checked;}});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  const action=b.dataset.module;
  if(action==='risk-back'){riskIndex=Math.max(0,riskIndex-1);render();}
  if(action==='risk-reset'){riskIndex=0;riskAnswers={};riskDone=false;render();}
  if(action==='risk-use'){const result=riskResult();const state=moduleStore();state.lastRisk={...result,at:new Date().toISOString()};saveModule(state);draft.type=result.type;persistDraft();step=0;navigate('report');}
  if(action==='reminder-on'||action==='reminder-off'){b.disabled=true;await learningReminder(action==='reminder-on');b.disabled=false;}
  if(action==='snapshot-draft'){b.disabled=true;await snapshotRecord({...draft,files});b.disabled=false;}
  if(action==='snapshot-record'){const record=records.find(r=>r.id===$('#snapshot-record')?.value);if(record){b.disabled=true;await snapshotRecord(record);b.disabled=false;}}
  if(b.dataset.snapshotView)showSnapshot(b.dataset.snapshotView);
  if(b.dataset.snapshotVerify){const s=vaultCache.find(x=>x.id===b.dataset.snapshotVerify);if(!s)return;b.disabled=true;try{const valid=await verifySnapshot(s);$('#verify-status').textContent=valid?'当前副本与保存时的校验清单一致。此结果不证明材料事实真实性。':'发现不一致，请保留原件并进一步核查。';}catch{$('#verify-status').textContent='暂时不能完成校验，请保留原始材料。';}finally{b.disabled=false;}}
  if(b.dataset.snapshotExport){const s=vaultCache.find(x=>x.id===b.dataset.snapshotExport);if(s)download(new Blob([JSON.stringify({manifest:JSON.parse(s.manifest),manifestSHA256:s.sha256},null,2)],{type:'application/json'}),s.id+'.json');}
  if(b.dataset.snapshotFile!==undefined){const s=vaultCache.find(x=>x.id===b.dataset.snapshot),f=s?.files[Number(b.dataset.snapshotFile)];if(f)download(f.blob,f.name);}
  if(b.dataset.caseFilter){caseFilter=b.dataset.caseFilter;render();}
  if(b.dataset.helpMessage){const c=guardianContacts().find(c=>c.id===b.dataset.helpMessage);if(c)modal('准备一条求助信息',`<p>发给：${esc(c.name)}</p><p>可以告诉对方：“我遇到一件拿不准的事情，希望您有空时联系我，一起看看。”</p><p>App 不会自动发送短信。请确认收件号码及内容，再由您发送。</p><a class="primary" href="sms:${esc(c.phone.replace(/[^+\d]/g,''))}?body=${encodeURIComponent('我遇到一件拿不准的事情，希望您有空时联系我，一起看看。')}">打开短信编辑</a>`);}
  if(b.dataset.questionExport){const q=moduleStore().questions.find(x=>x.id===b.dataset.questionExport);if(q)download(new Blob(['益护夕阳 · 待咨询问题（未发送）\n'+q.text+'\n记录时间：'+q.createdAt],{type:'text/plain;charset=utf-8'}),'待咨询问题.txt');}
  const deletion=b.dataset.guardianDelete?['guardians',b.dataset.guardianDelete,'移除这位联系人？']:b.dataset.serviceDelete?['services',b.dataset.serviceDelete,'删除这条服务信息？']:b.dataset.questionDelete?['questions',b.dataset.questionDelete,'删除这条咨询备忘？']:b.dataset.snapshotDelete?['vault',b.dataset.snapshotDelete,'删除这份材料快照？']:null;
  if(deletion)modal(deletion[2],`<p>只删除此处的本机内容，不会通知他人。删除后不能从本 App 恢复。</p><button class="primary" data-module-delete="${deletion[0]}" data-delete-id="${esc(deletion[1])}">确认删除</button><button class="secondary" data-action="close">保留</button>`);
  if(b.dataset.moduleDelete){if(b.dataset.moduleDelete==='vault'){try{await vaultOperation('delete',b.dataset.deleteId);vaultCache=vaultCache.filter(x=>x.id!==b.dataset.deleteId);}catch{toast('删除失败，快照仍保留');return;}}else{const state=moduleStore(),key=b.dataset.moduleDelete;if(!['guardians','services','questions'].includes(key))return;state[key]=state[key].filter(x=>x.id!==b.dataset.deleteId);if(!saveModule(state))return;}closeModal();render();toast('已删除本机内容');}
});
window.addEventListener('DOMContentLoaded',()=>{loadVault();const plugin=window.Capacitor?.Plugins?.LocalNotifications;if(nativeApp()&&plugin)plugin.addListener('localNotificationActionPerformed',event=>{if(event.notification?.id===9001)navigate('classroom');});});
