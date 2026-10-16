/* Android notification opt-in. Generic lock-screen text only; no legal content is sent. */
'use strict';
const PUSH_ENDPOINT='https://yihu-ai-consult.1201wburbankblvd.workers.dev/api/push';
let pushBusy=false,pushError='',pushNotice='',pushRows=[],pushToken='';
const pushPrefs=(()=>{try{return JSON.parse(localStorage.getItem('yihu-push-prefs-v1'))||{enabled:false,mutedUntil:0,installationId:''};}catch{return {enabled:false,mutedUntil:0,installationId:''};}})();
function pushInstallation(){if(/^[a-f0-9-]{36}$/.test(pushPrefs.installationId))return pushPrefs.installationId;pushPrefs.installationId=crypto.randomUUID();saveLocal('yihu-push-prefs-v1',pushPrefs);return pushPrefs.installationId;}
function pushPlugin(){return nativeApp()?window.Capacitor?.Plugins?.YihuPush:null;}
function pushSupported(){return !!pushPlugin();}
function pushKinds(){const out=[];if(familyToken())out.push(['family',familyToken(),'']);out.push(['ticket',consultationToken(true),'']);if(operatorCredential)out.push(['operator','',operatorCredential]);return out;}
async function pushRequest(action,kind,deviceToken,operatorCredential){
 const headers={'Content-Type':'application/json'};if(operatorCredential)headers['X-Operator-Credential']=operatorCredential;else headers.Authorization='Bearer '+deviceToken;
 const response=await fetch(PUSH_ENDPOINT,{method:'POST',headers,body:JSON.stringify({action,kind,installationId:pushInstallation(),...(['subscribe','disable-all'].includes(action)?{fcmToken:pushToken}:{})}),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error||'通知服务暂不可用');return {kind,...result};
}
async function pushSync(action='subscribe'){
 if(!pushSupported())return;if(action==='subscribe'){const result=await pushPlugin().register();pushToken=result.token;if(!pushToken)throw Error('未取得设备通知令牌');}
 const results=[];for(const [kind,token,operator] of pushKinds()){try{results.push(await pushRequest(action,kind,token,operator));}catch(error){if(kind==='family'&&!familyState?.role)continue;throw error;}}pushRows=results;
}
function pushStateText(){
 if(!pushSupported())return '网页版请保持页面打开并手动刷新；安装安卓体验版后可开启锁屏通知。';
 if(pushPrefs.mutedUntil>Date.now())return `已暂停至 ${stamp(pushPrefs.mutedUntil)}，打开 App 后会自动恢复。`;
 if(!pushPrefs.enabled)return '当前已关闭。只有您主动开启后，系统才会询问通知权限。';
 const failure=pushRows.find(x=>x.subscription?.last_error)?.subscription?.last_error;if(failure)return '通知服务已开启，但最近一次发送未成功；请打开 App 重新同步。';const success=pushRows.map(x=>x.subscription?.last_success_ms).filter(Boolean).sort((a,b)=>b-a)[0];return success?`通知服务已开启。服务器最近接受发送：${stamp(success)}。`:'通知服务已开启，等待新的守护或咨询消息。';
}
function notificationsPage(){
 const supported=pushSupported(),enabled=pushPrefs.enabled&&pushPrefs.mutedUntil<=Date.now();
 return `${back('mine','返回我的')}${heading('消息通知','有新消息时，及时提醒您查看。')}<div class="notice"><strong>锁屏只显示概括提醒，不显示问题、回复或案件内容。</strong><p>点击通知后才进入益护夕阳查看。紧急危险仍请直接拨打110，家庭急事请直接打电话。</p></div><section class="form-panel push-card"><div class="push-state"><span class="push-dot ${enabled?'on':''}" aria-hidden="true"></span><div><h2>${enabled?'通知已开启':'通知未开启'}</h2><p>${esc(pushStateText())}</p></div></div><p class="error" role="alert">${esc(pushError)}</p><p role="status">${esc(pushNotice)}</p>${supported?`<div class="actions"><button class="primary" data-push="enable" ${pushBusy?'disabled':''}>${enabled?'重新同步':'开启通知'}</button>${enabled?'<button class="secondary" data-push="mute" '+(pushBusy?'disabled':'')+'>暂停8小时</button>':''}<button class="text-btn danger" data-push="disable" ${pushBusy||!pushPrefs.enabled?'disabled':''}>关闭通知</button></div>`:'<a class="primary" href="downloads/yihu-xiyang-latest.apk">下载安卓体验版</a>'}</section><section class="form-panel"><h2>会提醒哪些事情</h2><ul class="checklist"><li>长辈发送家庭求助后，提醒已绑定的家人。</li><li>志愿者回复咨询后，提醒原提交设备。</li><li>用户补充咨询后，提醒接单志愿者的工作台设备。</li></ul><p class="field-hint">通知不代表机构受理，也不保证即时送达。系统省电、断网或关闭权限时可能延迟。</p></section><details class="form-panel"><summary>通知使用了哪些数据</summary><p>仅同步随机安装标识、Firebase 设备令牌、通知类型和发送状态。不把咨询正文、回复内容、姓名、电话、定位或附件放入通知服务。</p><p>关闭通知后，服务器会停用本机订阅。卸载应用也会使设备令牌失效。</p></details>`;
}
async function pushEnable(){if(pushBusy)return;pushBusy=true;pushError='';pushNotice='正在申请系统权限并登记本机…';render();try{const permission=await pushPlugin().requestPermission();if(!permission.granted)throw Error('系统没有允许通知。可在手机“设置—应用—益护夕阳—通知”中重新开启。');pushPrefs.enabled=true;pushPrefs.mutedUntil=0;saveLocal('yihu-push-prefs-v1',pushPrefs);await pushSync('subscribe');pushNotice='通知已开启。';}catch(error){pushPrefs.enabled=false;saveLocal('yihu-push-prefs-v1',pushPrefs);pushError=error.message||'通知开启失败';pushNotice='';}finally{pushBusy=false;render();}}
async function pushDisable(mute=false){if(pushBusy)return;pushBusy=true;pushError='';pushNotice='正在更新通知设置…';render();try{if(!pushToken){const result=await pushPlugin().register();pushToken=result.token;}await pushRequest('disable-all','ticket',consultationToken(true),'');pushRows=[];pushPrefs.enabled=!!mute;pushPrefs.mutedUntil=mute?Date.now()+8*3600000:0;saveLocal('yihu-push-prefs-v1',pushPrefs);pushNotice=mute?'已暂停8小时。':'通知已关闭。';}catch(error){pushError=error.message||'设置更新失败，请稍后重试';pushNotice='';}finally{pushBusy=false;render();}}
async function pushResumeIfNeeded(){if(!pushSupported()||!pushPrefs.enabled||pushPrefs.mutedUntil>Date.now()||pushBusy)return;try{await pushSync('subscribe');}catch{}if(route==='notifications')render();}
async function consumePushRoute(){if(!pushSupported())return;try{const result=await pushPlugin().consumeRoute();if(/^(family|consultations|ticket\/[a-f0-9-]{36}|volunteer)$/.test(result.route||''))navigate(result.route);}catch{}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-push]');if(!b)return;if(b.dataset.push==='enable')pushEnable();if(b.dataset.push==='mute')pushDisable(true);if(b.dataset.push==='disable')pushDisable(false);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){consumePushRoute();pushResumeIfNeeded();}});
window.addEventListener('DOMContentLoaded',()=>{consumePushRoute();pushResumeIfNeeded();});
