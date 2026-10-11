/* Buildless, offline-capable framework. No third-party requests or real legal decisions. */
'use strict';
const C = window.YIHU_CONTENT;
const $ = (s) => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  sun: '<path d="M5 17a7 7 0 0 1 14 0M3 20h18M12 2v3M3 7l3 3M21 7l-3 3"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  book: '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 1z"/>',
  shield: '<path d="m12 2 9 4v6c0 5-6 9-9 10-3-1-9-5-9-10V6z"/><path d="m8 12 3 3 5-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  users: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 4 5v2"/>',
  phone: '<path d="M6 3h3l2 5-3 2a13 13 0 0 0 6 6l2-3 5 2v3c0 3-3 4-5 3C8 19 3 13 2 6c0-2 2-3 4-3z"/>',
  chat: '<path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4zM8 10h8M8 14h5"/>',
  file: '<path d="M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h6"/>',
  lock: '<rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  volume: '<path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  scale: '<path d="M12 3v18M7 21h10M4 6h16M6 6l-4 8h8zm12 0-4 8h8z"/>',
  heart: '<path d="M12 21C6 16 2 13 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 5-4 8-10 13z"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4"/>',
  trash: '<path d="M3 6h18M5 6l1 16h12l1-16M9 6V2h6v4M10 10v8M14 10v8"/>'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const readLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const saveLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const prefs = readLocal('yihu-prefs', { large: false, helper: false, contact: null });
const blankDraft = () => ({type:'', description:'', date:'', amount:'', other:'', helper:prefs.helper});
let draft = {...blankDraft(), ...readLocal('yihu-draft', {})};
let files = [], records = [], db = null, step = 0, filter = '全部', search = '', formError = '', busy = false;
let route = location.hash.slice(1) || 'home';
let speech = null, speechTimer = null, toastTimer = null, returnFocus = null, previewUrls = [];
const navs = [['home','home','首页'],['learn','book','学法与问法'],['report','shield','一键维权'],['mine','user','我的']];
const stamp = (date) => new Date(date).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
function toast(msg) { $('#toast').textContent=msg; $('#toast').style.display='block'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').style.display='none', 3800); }
function persistDraft(){saveLocal('yihu-draft',draft);}
function savePrefs(){if(!saveLocal('yihu-prefs',prefs))toast('当前浏览器无法保存设置，本次操作仍可使用。');}
function openDB(){return new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(new Error('此浏览器不支持本机记录保存'));const request=indexedDB.open('yihu-demo',1);request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});}
function dbAction(action, value){return new Promise((resolve,reject)=>{if(!db)return reject(new Error('本机存储不可用'));const tx=db.transaction('records',action==='getAll'?'readonly':'readwrite');const req=tx.objectStore('records')[action](...(value===undefined?[]:[value]));tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error || new Error('存储失败'));});}
function stopReading(){readerReset();}
function navigate(next){stopReading();formError='';if(location.hash.slice(1)===next){route=next;render();}else location.hash=next;}
window.addEventListener('hashchange',()=>{route=location.hash.slice(1)||'home';formError='';stopReading();render();window.scrollTo(0,0);$('#main')?.focus({preventScroll:true});});
function heading(title, sub=''){return `<div class="page-heading"><h1>${title}</h1>${sub?`<p>${sub}</p>`:''}</div>`;}
function back(to='home',label='返回首页'){return `<button class="back" data-go="${to}">${icon('back')}${label}</button>`;}
function note(){return `<div class="footnote">${icon('lock')}框架演示 · 记录仅保存在当前浏览器</div>`;}
function render(){
  previewUrls.forEach(URL.revokeObjectURL);previewUrls=[];
  document.body.classList.toggle('large',prefs.large);
  let active=route.startsWith('article/')||route==='ask'||route==='path'?'learn':route==='records'||route.startsWith('record/')?'mine':route.startsWith('success/')?'report':route;
  if(route==='stories'||route==='story-new'||route.startsWith('story/'))active='home';
  if(!navs.some(n=>n[0]===active))active='home';
  const title=navs.find(n=>n[0]===active)[2];
  const nav=(mobile)=>navs.map(([id,ic,label])=>`<button class="${mobile?'':'nav-item '}${active===id?'active':''}" data-go="${id}" ${active===id?'aria-current="page"':''}>${mobile?'<span class="nav-icon">':''}${icon(ic)}${mobile?'</span>':''}<span>${label}</span></button>`).join('');
  const logo=`<span class="brandmark">${icon('sun')}</span><div><strong>益护夕阳</strong><small>守护权益 · 安心相伴</small></div>`;
  $('#app').innerHTML=`<div class="shell"><aside class="sidebar"><a class="brand" href="#home" aria-label="益护夕阳首页">${logo}</a><nav class="desktop-nav" aria-label="主导航">${nav(false)}</nav><div class="sidebar-bottom"><div class="line"></div>${icon('heart')}<strong>让每一份权益，<br>都被认真守护。</strong><p>老年人财产权益保护<br>法学院项目 · 框架演示 V0.2</p></div></aside><div class="workspace"><header class="topbar"><span class="topbar-title">益护夕阳 <span aria-hidden="true"> / </span> ${title}</span><a href="#home" class="brand mobile-brand">${logo}</a><div class="top-actions"><button class="utility" data-action="font" aria-pressed="${prefs.large}"><b aria-hidden="true">A</b>${prefs.large?'标准字':'大字版'}</button><button class="utility" data-action="read">${icon('volume')}朗读</button></div></header><main id="main" class="main" tabindex="-1">${content()}</main></div><nav class="bottom-nav" aria-label="底部导航">${nav(true)}</nav></div>`;
  if(route==='learn'){const input=$('#search');input.value=search;}
}
function content(){
  if(route==='stories')return storiesPage();
  if(route==='story-new')return storyCompose();
  if(route.startsWith('story/'))return storyDetail(route.slice(6));
  if(route==='home')return home();
  if(route==='learn')return learn();
  if(route==='report')return report();
  if(route==='mine')return mine();
  if(route==='ask')return ask();
  if(route==='path')return pathway();
  if(route==='records')return recordsPage();
  if(route.startsWith('article/'))return article(route.split('/')[1]);
  if(route.startsWith('success/'))return success(route.slice(8));
  if(route.startsWith('record/'))return recordDetail(route.slice(7));
  return `${heading('这个页面暂时找不到')}<button class="primary" data-go="home">返回首页</button>`;
}
function home(){return `<div class="intro"><div><div class="eyebrow">陪伴每一天 · 守护每一份安心</div><h1>您好，今天也要安心呀</h1><p>遇到难事别着急，我们陪您一步步来。</p></div><span class="demo-chip">初步体验版</span></div>${hotlineSection()}<div class="home-grid"><section class="hero"><div class="hero-sun" aria-hidden="true"></div><div class="eyebrow">权益守护 · 从这里开始</div><h2>您的难处，<br>值得被认真听见。</h2><p>说说发生了什么，<br>一起整理问题，了解求助方向。</p><button class="primary" data-go="report">我要维权 ${icon('arrow')}</button></section><div class="quick-stack"><button class="quick-card" data-go="ask"><span class="icon-box">${icon('chat')}</span><div><h3>咨询问题</h3><p>看得懂的法律问答</p></div>${icon('chevron','arrow')}</button><button class="quick-card" data-action="contact"><span class="icon-box peach">${icon('phone')}</span><div><h3>联系家人</h3><p>有事，一起商量</p></div>${icon('chevron','arrow')}</button></div></div>${readerToolbar()}<div class="section-head"><h2>每天学一点，安心多一点</h2><button class="text-btn" data-go="learn">全部内容 ${icon('chevron')}</button></div><button class="lesson" data-go="article/phone"><span class="lesson-art">${icon('phone')}</span><div><span class="label">今日反诈课堂</span><h3>接到陌生来电，先别急着转账</h3><p>从一通“熟人电话”开始，认识身边的风险。</p><div class="meta"><span>约 2 分钟</span><span>可语音朗读</span><span>待审核示例</span></div></div>${icon('arrow','arrow')}</button><div class="section-head"><h2>有人陪伴，心里更踏实</h2></div><div class="home-bottom"><button class="mini-card" data-go="records">${icon('file')}<div><strong>我的维权记录</strong><p>${records.length?`${records.length} 条本机演示线索`:'填写的事情，在这里查看'}</p></div></button><button class="mini-card" data-action="family">${icon('users')}<div><strong>家人一起帮忙</strong><p>${prefs.helper?'家人协助模式已开启':'一起填写，少一点操心'}</p></div></button></div>${sharingEntry()}${note()}`;}
function articleCards(){const found=C.articles.filter(a=>(filter==='全部'||a.category===filter)&&`${a.title} ${a.summary} ${a.category}`.includes(search.trim()));return found.length?found.map(a=>`<button class="article-card" data-go="article/${a.id}"><span class="icon-box ${a.color}">${icon(a.icon)}</span><span class="label">${a.category}</span><h2>${a.title}</h2><p>${a.summary}</p><div class="meta"><span>${a.minutes}</span><span>${a.status}</span></div></button>`).join(''):`<div class="empty"><h2>暂时没有找到相关内容</h2><p>换个关键词，或试试“全部”分类。</p><button class="secondary" data-action="clear-search">清除筛选</button></div>`;}
function learn(){return `${heading('学一点法律，多一份安心','反诈课堂、身边案例和您关心的问题。')}<div class="search-wrap">${icon('search')}<input id="search" type="search" aria-label="搜索文章、案例和问题" placeholder="搜一搜您关心的问题"></div><div class="chips" aria-label="内容分类">${C.categories.map(c=>`<button class="chip ${filter===c?'active':''}" data-filter="${c}" aria-pressed="${filter===c}">${c}</button>`).join('')}</div><div id="article-results" class="article-list">${articleCards()}</div><div class="editor-note">当前为内容结构示例。正式推文、案例、法令和问答由法学院同学提供并审核。</div>${note()}`;}
function article(id){const a=C.articles.find(a=>a.id===id);if(!a)return back('learn','返回学习栏目')+heading('内容暂未收录');return `${back('learn','返回学法与问法')}<article class="article-body"><span class="label">${a.category} / ${a.label}</span><h1>${a.title}</h1><div class="meta"><span>${a.minutes}</span><span>${a.status}</span></div><div class="reader-tools"><button class="utility" data-feature="voice-settings">声音与语速</button><button class="utility" data-action="read">${icon('volume')}朗读</button><button class="utility" data-action="font">${prefs.large?'标准字号':'放大文字'}</button></div>${a.sections.map(s=>`<section><h2>${s.heading}</h2><p>${s.text}</p></section>`).join('')}<div class="notice">${a.status==='功能说明'?'这是本原型的使用说明。':'示例内容待审核，不作为正式法律答复。'}${a.source?`<br>资料来源：${esc(a.source)}`:''}</div><button class="primary" data-go="report">我想记录遇到的问题 ${icon('arrow')}</button></article>`;}
function ask(){return `${back()}${heading('您想了解什么？','先从常见问题开始，慢慢把事情说清楚。')}<form id="question-form" class="question-form"><input name="question" aria-label="您的问题" placeholder="例如：材料、家人、公益诉讼" maxlength="100" required><button class="primary" type="submit">查找问答</button></form><div class="notice soft">当前提供关键词查找，不调用 AI，也不自动生成法律意见。人工咨询服务尚未接入。</div><div class="section-head"><h2>大家关心的问题</h2></div><div class="settings">${[['记录问题时，可以准备哪些材料？','evidence'],['家人可以帮我填写吗？','family'],['公益诉讼，怎样参与？','public']].map(([q,id])=>`<button class="setting" data-go="article/${id}">${icon('chat')}<span><strong>${q}</strong></span>${icon('chevron')}</button>`).join('')}</div><div class="section-head"><h2>了解求助流程</h2></div><button class="lesson" data-go="path"><span class="icon-box">${icon('scale')}</span><div><h3>从一个问题，到多方帮助</h3><p>查看项目设想的维权服务路径</p></div>${icon('arrow','arrow')}</button>${note()}`;}
function pathway(){return `${back('ask','返回咨询问题')}${heading('从一个问题，到多方帮助','根据项目书整理的服务路径示意。')}<div class="form-panel"><div class="route-list">${[['先记录问题','老人本人或家人描述经过，整理已有材料。'],['了解求助方向','正式渠道、适用条件和材料要求，由法学院团队编写审核。'],['专业人员协助','后续拟对接法律志愿者、社会组织等，当前尚未接入。'],['依法评估与处理','是否适用公益诉讼及具体程序，须由有权机构依法判断。']].map(([t,p],i)=>`<div class="route-row"><b>0${i+1}</b><div><strong>${t}</strong><p>${p}</p></div></div>`).join('')}</div><div class="notice">以上为研究方案的展示，不代表机构已合作或已承诺受理。</div><button class="primary" data-go="report">先记录我的问题 ${icon('arrow')}</button></div>`;}
function report(){const steps=['选问题','说经过','添材料','确认'];return `<div class="form-wrap">${heading('一键维权','不用一次说清楚，我们一步一步来。')}${prefs.helper?'<div class="help-banner">家人协助模式 · 请与长辈一起核对填写内容</div>':''}<ol class="stepper" aria-label="填写进度">${steps.map((s,i)=>`<li class="${i===step?'current':i<step?'done':''}" ${i===step?'aria-current="step"':''}><b>${i<step?'✓':i+1}</b>${s}</li>`).join('')}</ol><div class="form-panel"><form id="report-form" novalidate>${stepContent()}<p id="form-error" class="error" role="alert">${esc(formError)}</p><div class="actions">${step?'<button type="button" class="secondary" data-action="prev-step">上一步</button>':'<button type="button" class="text-btn" data-action="sample">填入演示情景</button>'}<button type="submit" class="primary" ${busy?'disabled':''}>${busy?'正在保存…':step===3?'确认保存演示线索':'下一步'} ${icon(step===3?'check':'arrow')}</button></div></form></div><div class="notice">本次为框架体验，请使用虚构信息。线索不会发送至律所、检察机关或公安机关。</div>${note()}</div>`;}
function stepContent(){
 if(step===0)return `<h2>您遇到了什么问题？</h2><p class="subtext">选择最接近的一项，不确定也没关系。</p><div class="types" role="group" aria-label="问题类型">${C.issueTypes.map(t=>`<button type="button" class="type ${draft.type===t.id?'selected':''}" data-type="${t.id}" aria-pressed="${draft.type===t.id}">${icon(t.icon)}<span><strong>${t.id}</strong><small>${t.note}</small></span></button>`).join('')}</div>`;
 if(step===1)return `<h2>和我们说说事情经过</h2><p class="subtext">记得多少写多少，暂时不清楚的可以空着。</p><label class="field"><span class="field-label">发生了什么？ <span class="optional">必填</span></span><textarea name="description" id="description" maxlength="2000" placeholder="例如：有人打电话邀请我参加养老投资，我想先了解一下……" required>${esc(draft.description)}</textarea><span class="field-hint">可使用手机键盘自带的语音输入。</span></label><div class="field-grid"><label class="field"><span class="field-label">大概是什么时候？ <span class="optional">选填</span></span><input name="date" type="date" value="${esc(draft.date)}" max="${new Date().toLocaleDateString('en-CA')}"></label><label class="field"><span class="field-label">涉及金额（元） <span class="optional">选填</span></span><input name="amount" type="number" min="0" max="9999999999" step="0.01" inputmode="decimal" value="${esc(draft.amount)}" placeholder="不清楚可以不填"></label></div><label class="field"><span class="field-label">对方是谁？ <span class="optional">选填</span></span><input name="other" maxlength="100" value="${esc(draft.other)}" placeholder="填写对方称呼或机构，也可以写“不清楚”"></label>`;
 if(step===2)return `<h2>有相关材料吗？</h2><p class="subtext">可以添加示例文件，也可以直接跳过。</p><label class="upload">${icon('upload')}<strong>点击添加图片或 PDF</strong><small>最多 5 份，每份不超过 5 MB</small><input type="file" id="attachments" multiple accept="image/jpeg,image/png,image/webp,application/pdf" aria-label="添加材料"></label><div class="files">${files.map((f,i)=>`<div class="file-row">${icon('file')}<span>${esc(f.name)}<br><small>${(f.size/1024).toFixed(0)} KB</small></span><button type="button" data-remove="${i}" aria-label="移除 ${esc(f.name)}">${icon('close')}</button></div>`).join('')}</div><div class="notice soft">材料位置示例：聊天截图、交易凭证、合同。具体取证指引由法学院同学补充。</div><p class="field-hint">附件确认提交后保存在本机。提交前刷新页面，需重新选择附件。</p>`;
 return `<h2>一起核对一下</h2><p class="subtext">确认后生成演示编号，您可以随时回来查看。</p>${review(draft,files)}<label class="consent"><input id="consent" type="checkbox" required><span>我知道这是演示线索，仅保存在当前浏览器，未发送给任何机构。我使用虚构信息体验。</span></label>`;
}
function review(d,attachments){return `<dl class="review">${[['问题类型',d.type],['事情经过',d.description],['发生时间',d.date||'暂未填写'],['涉及金额',d.amount!==''?`${d.amount} 元`:'暂未填写'],['对方信息',d.other||'暂未填写'],['填写方式',d.helper?'家人协助填写':'本人填写'],['相关材料',attachments.length?attachments.map(f=>f.name).join('、'):'暂未添加']].map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;}
function error(msg,focus){formError=msg;$('#form-error').textContent=msg;if(focus)$(focus)?.focus();}
async function nextStep(){
 if(busy)return;
 if(step===0&&!draft.type)return error('请先选择一种问题，也可以选择“不太清楚”。');
 if(step===1){if(draft.description.trim().length<5)return error('请再多说一点，至少填写 5 个字。','#description');if(draft.date && new Date(draft.date)>new Date())return error('发生时间不能晚于今天。','[name="date"]');if(draft.amount!==''&&(!Number.isFinite(Number(draft.amount))||Number(draft.amount)<0||Number(draft.amount)>9999999999))return error('请填写有效金额，或先留空。','[name="amount"]');}
 if(step<3){step++;formError='';render();window.scrollTo(0,0);return;}
 if(!$('#consent').checked)return error('请阅读并勾选演示说明。','#consent');
 busy=true;const btn=$('#report-form [type=submit]');btn.disabled=true;btn.textContent='正在保存…';
 const id=`YH-DEMO-${new Date().toLocaleDateString('en-CA').replaceAll('-','')}-${crypto.randomUUID ? crypto.randomUUID().slice(0,8).toUpperCase():Date.now().toString(36).toUpperCase()}`;
 const record={...draft,id,createdAt:new Date().toISOString(),files:files.map(f=>({name:f.name,size:f.size,type:f.type,blob:f})),status:'已保存至本机'};
 try{await dbAction('put',record);records.unshift(record);draft=blankDraft();files=[];step=0;persistDraft();navigate(`success/${id}`);}catch(e){error('保存未成功：本机存储可能不可用或空间不足。请减少附件后重试，填写内容仍在。');}finally{busy=false;if(route==='report'){btn.disabled=false;btn.innerHTML='确认保存演示线索 '+icon('check');}}
}
function success(id){const r=records.find(r=>r.id===id);if(!r)return recordsPage();return `<section class="success"><div class="success-mark">${icon('check')}</div><h1>事情记下来了</h1><p style="margin-top:12px">您已经完成第一步，给自己一点耐心。</p><div class="record-number">${esc(r.id)}</div><div class="notice">演示线索已保存至本机，<strong>未发送给任何机构</strong>。这不是正式案件编号。</div><p>可到“我的维权记录”查看经过和附件，<br>或了解项目设想的后续帮助路径。</p><div class="actions"><button class="primary" data-go="record/${esc(r.id)}">查看我的记录 ${icon('arrow')}</button><button class="secondary" data-go="home">返回首页</button></div></section>`;}
function recordsPage(){return `${back('mine','返回我的')}${heading('我的维权记录','在这里，找回您记录的每一件事。')}${records.length?records.map(r=>`<button class="record" data-go="record/${esc(r.id)}"><div class="record-head"><h2>${esc(r.type)}</h2><span class="status">本机演示记录</span></div><p>${esc(r.description.slice(0,80))}${r.description.length>80?'…':''}</p><small>${stamp(r.createdAt)} · ${r.files.length} 份材料</small></button>`).join(''):`<div class="empty">${icon('file')}<h2>还没有记录</h2><p>遇到了困扰，可以从记录事情开始。</p><button class="primary" data-go="report">记录我的问题 ${icon('plus')}</button></div>`}${note()}`;}
function recordDetail(id){const r=records.find(r=>r.id===id);if(!r)return `${back('records','返回记录')}${heading('这条记录不在当前浏览器中','请使用原来填写时的设备和浏览器查看。')}`;return `${back('records','返回我的记录')}${heading('线索详情','记录仅在本机保存，尚未进入正式办理流程。')}<div class="form-panel"><span class="status">演示线索</span><p class="field-hint" style="overflow-wrap:anywhere">${esc(r.id)}</p><ol class="timeline"><li><strong>已保存至本机</strong><p>${stamp(r.createdAt)} · 经过和附件已记录</p></li><li class="future"><strong>机构接收 · 未发生</strong><p>尚未对接机构，没有发送或受理记录。</p></li><li class="future"><strong>后续处理 · 待接入</strong><p>未来由合作机构确认实际流程后实现。</p></li></ol><h2>您记录的事情</h2>${review(r,r.files)}${r.files.length?`<h3>已保存的材料</h3>${r.files.map((f,i)=>`<button class="setting" data-file="${i}" data-record="${esc(id)}">${icon('file')}<span><strong>${esc(f.name)}</strong><small>点击查看本机附件</small></span>${icon('chevron')}</button>`).join('')}`:''}<div class="actions"><button class="secondary" data-export="${esc(id)}">${icon('download')}导出记录</button><button class="text-btn danger" data-delete="${esc(id)}">删除记录</button></div></div><div class="section-head"><h2>接下来，可以了解</h2></div><button class="lesson" data-go="path"><span class="icon-box">${icon('scale')}</span><div><h3>项目设想的求助路径</h3><p>参与主体与协作流程</p></div>${icon('arrow','arrow')}</button>`;}
function mine(){return `${heading('我的','有家人相伴，也让事情更有条理。')}<div class="profile"><span class="avatar">${icon(prefs.helper?'users':'user')}</span><div><h2>${prefs.helper?'家人协助模式':'欢迎您，长辈朋友'}</h2><p>${prefs.helper?'同一设备协助填写，请与长辈共同确认。':'慢慢操作，我们陪您一起。'}</p></div></div><div class="section-head"><h2>我的服务</h2></div><div class="settings"><button class="setting" data-go="records">${icon('file')}<span><strong>我的维权记录</strong><small>${records.length} 条本机演示线索</small></span>${icon('chevron')}</button><button class="setting" data-action="edit-contact">${icon('phone')}<span><strong>紧急联系人</strong><small>${prefs.contact?esc(prefs.contact.name)+' · '+esc(prefs.contact.phone):'添加一位信任的家人'}</small></span>${icon('chevron')}</button><button class="setting" data-action="helper" role="switch" aria-checked="${prefs.helper}">${icon('users')}<span><strong>家人协助模式</strong><small>开启后，在本机帮长辈填写</small></span><span class="toggle ${prefs.helper?'on':''}" aria-hidden="true"></span></button><button class="setting" data-action="community">${icon('home')}<span><strong>社区与线下帮助</strong><small>线下服务对接入口</small></span>${icon('chevron')}</button></div><div class="section-head"><h2>使用设置</h2></div><div class="settings"><button class="setting" data-action="font" role="switch" aria-checked="${prefs.large}"><b style="width:24px">A</b><span><strong>大字版</strong><small>让文字看得更清楚</small></span><span class="toggle ${prefs.large?'on':''}" aria-hidden="true"></span></button>${readerSettingsEntry()}<button class="setting" data-go="stories">${icon("chat")}<span><strong>夕阳树洞</strong><small>匿名分享经历 · 本机演示</small></span>${icon("chevron")}</button><button class="setting" data-action="about">${icon('sun')}<span><strong>关于益护夕阳</strong><small>法学院项目 · 框架演示 V0.2</small></span>${icon('chevron')}</button></div>${note()}`;}
function modal(title,body){returnFocus=document.activeElement;$('#modal').innerHTML=`<div class="modal-heading"><h2 id="modal-title">${title}</h2><button class="close" data-action="close" aria-label="关闭对话框">${icon('close')}</button></div><div class="modal-body">${body}</div>`;$('#modal').showModal();}
function closeModal(){ $('#modal').close();returnFocus?.focus();}
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal();});
function contactForm(){modal('添加紧急联系人',`<p>用于本机演示联系入口，不会自动发送通知。</p><form id="contact-form"><label class="field"><span class="field-label">称呼</span><input name="name" maxlength="30" value="${esc(prefs.contact?.name||'')}" placeholder="例如：女儿" required></label><label class="field"><span class="field-label">联系电话</span><input name="phone" type="tel" inputmode="tel" maxlength="24" value="${esc(prefs.contact?.phone||'')}" placeholder="填写联系电话" required></label><p id="contact-error" class="error" role="alert"></p><button class="primary" type="submit">保存联系人</button></form>`);}
function readPage(){readerReadPage();}
document.addEventListener('input',e=>{if(e.target.id==='search'){search=e.target.value;$('#article-results').innerHTML=articleCards();}if(e.target.closest('#report-form')&&['description','date','amount','other'].includes(e.target.name)){draft[e.target.name]=e.target.value;persistDraft();}});
document.addEventListener('change',e=>{if(e.target.id!=='attachments')return;let rejected=[];for(const f of e.target.files){if(files.length>=5){rejected.push('最多添加 5 份材料');break;}if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type)){rejected.push('仅支持 JPG、PNG、WebP 和 PDF');continue;}if(f.size>5*1024*1024){rejected.push('单份文件不能超过 5 MB');continue;}if(!files.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified))files.push(f);}render();if(rejected.length)error([...new Set(rejected)].join('；'));});
document.addEventListener('submit',async e=>{e.preventDefault();if(e.target.id==='report-form')return nextStep();if(e.target.id==='question-form'){const query=new FormData(e.target).get('question').trim();if(!query)return;search=query;filter='全部';navigate('learn');return;}if(e.target.id==='contact-form'){const data=new FormData(e.target),name=data.get('name').trim(),phone=data.get('phone').trim();if(!name||!/^\+?[\d\s()-]{5,24}$/.test(phone)){ $('#contact-error').textContent='请填写称呼和有效的联系电话。';return;}prefs.contact={name,phone};savePrefs();closeModal();render();toast('联系人已保存至当前浏览器');}});
document.addEventListener('click',async e=>{
 const b=e.target.closest('button,[data-go]');if(!b)return;
 if(b.dataset.go){navigate(b.dataset.go);return;}
 if(b.dataset.filter){filter=b.dataset.filter;render();return;}
 if(b.dataset.type){draft.type=b.dataset.type;persistDraft();formError='';render();return;}
 if(b.dataset.remove!==undefined){files.splice(Number(b.dataset.remove),1);render();return;}
 if(b.dataset.delete){modal('删除这条演示记录？','<p>这会同时删除本机保存的经过和附件，无法撤销。</p><button class="primary" data-confirm-delete="'+esc(b.dataset.delete)+'">确认删除</button><button class="secondary" data-action="close">保留记录</button>');return;}
 if(b.dataset.confirmDelete){try{await dbAction('delete',b.dataset.confirmDelete);records=records.filter(r=>r.id!==b.dataset.confirmDelete);closeModal();navigate('records');toast('已删除这条本机记录');}catch{toast('删除失败，请稍后重试。');}return;}
 if(b.dataset.export){const r=records.find(r=>r.id===b.dataset.export);if(!r)return;const text=`益护夕阳 · 本机演示记录（未发送给任何机构）\n编号：${r.id}\n创建时间：${r.createdAt}\n问题类型：${r.type}\n事情经过：${r.description}\n发生时间：${r.date||'未填'}\n涉及金额：${r.amount||'未填'}\n对方：${r.other||'未填'}\n填写方式：${r.helper?'家人协助':'本人'}\n附件清单：${r.files.map(f=>f.name).join('、')||'无'}\n\n导出文件不含附件本体；请在原浏览器中查看附件。`;download(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'}),r.id+'.txt');return;}
 if(b.dataset.file!==undefined){const r=records.find(r=>r.id===b.dataset.record),f=r?.files[Number(b.dataset.file)];if(!f)return;const url=URL.createObjectURL(f.blob);previewUrls.push(url);modal('查看材料',`<p>${esc(f.name)}</p>${f.type.startsWith('image/')?`<img src="${url}" alt="${esc(f.name)}" style="max-width:100%;max-height:45vh;object-fit:contain">`:'<p>PDF 材料可保存后，使用本机阅读器查看。</p>'}<a class="primary" href="${url}" download="${esc(f.name)}">保存附件到本机</a>`);return;}
 switch(b.dataset.action){
 case 'close':closeModal();break;
 case 'read':readPage();break;
 case 'font':stopReading();prefs.large=!prefs.large;savePrefs();render();toast(prefs.large?'已切换为大字版':'已切换为标准字号');break;
 case 'helper':prefs.helper=!prefs.helper;draft.helper=prefs.helper;savePrefs();persistDraft();render();toast(prefs.helper?'已开启本机家人协助模式':'已切换为本人填写');break;
 case 'prev-step':if(!busy){step=Math.max(0,step-1);formError='';render();window.scrollTo(0,0);}break;
 case 'sample':draft={...blankDraft(),type:'投资理财',description:'【虚构演示】有人打电话邀请我参加一个养老投资项目，说每个月都有很高的收益。我还没有转账，想和家人一起记录一下这件事。',other:'自称养老项目工作人员',amount:'',date:''};persistDraft();render();toast('已填入虚构情景，继续下一步即可体验');break;
 case 'clear-search':search='';filter='全部';render();break;
 case 'edit-contact':contactForm();break;
 case 'contact':if(!prefs.contact){contactForm();break;}modal('联系信任的家人',`<p>联系人：<strong>${esc(prefs.contact.name)}</strong><br>电话：${esc(prefs.contact.phone)}</p><p>点击下方按钮会请求设备打开拨号界面，是否拨出由您确认。</p><a class="primary" href="tel:${esc(prefs.contact.phone.replace(/[^+\d]/g,''))}">${icon('phone')}打开拨号界面</a><button class="secondary" data-action="edit-contact">修改联系人</button>`);break;
 case 'family':modal('有家人一起，更安心',`<p>第一版支持在同一设备上协助填写。开启后，线索会注明“家人协助填写”。</p><p>远程代操作、风险推送和跨设备共享尚未接入。</p><button class="primary" data-action="family-enable">开启家人协助模式</button>`);break;
 case 'family-enable':prefs.helper=true;draft.helper=true;savePrefs();persistDraft();closeModal();navigate('report');break;
 case 'community':modal('社区与线下帮助',`<p>这里将展示合作社区、养老服务机构和法律志愿者的联系方式、服务时间与预约方式。</p><div class="notice">合作信息待团队确认，目前没有可预约的服务，不会提交预约。</div><button class="secondary" data-action="close">我知道了</button>`);break;
 case 'about':modal('益护夕阳 · V0.2',`<p>根据“数字时代老年人财产权益公益诉讼的多元启动模式与配套程序优化研究”搭建的演示框架。</p><p>您可以体验内容浏览、问题记录、附件保存和家人协助。推文、案例、法令和问答由法学院团队提供并审核。</p><p>数据仅保存在当前浏览器；清除网站数据会删除记录。没有真实机构受理、AI 咨询或风险监控功能。</p><button class="secondary" data-go="path" data-action="close-go">了解项目服务路径</button>`);break;
 }
});
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
document.addEventListener('click',e=>{if(e.target.closest('#modal [data-go]'))closeModal();});
async function boot(){render();try{db=await openDB();records=(await dbAction('getAll')).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));render();}catch{toast('本机存储不可用。您可以浏览页面，但暂时不能保存线索。');}}
boot();
