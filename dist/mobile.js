/* Shared app shell. No speech synthesis or automatic network audio generation. */
'use strict';
function stopArticleAudio(){document.querySelectorAll('audio').forEach(a=>a.pause());}
function nativeApp(){return !!window.Capacitor?.isNativePlatform?.();}
async function exportNativeFile(blob,name){
  const plugins=window.Capacitor?.Plugins;
  if(!plugins?.Filesystem||!plugins?.Share){toast('文件导出暂不可用，请保留本机记录后重试。');return;}
  try{
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
    const safeName=name.replace(/[\\/\x00-\x1f:*?"<>|]/g,'_');
    const result=await plugins.Filesystem.writeFile({path:'exports/'+Date.now()+'-'+safeName,data,directory:'CACHE',recursive:true});
    await plugins.Share.share({title:'导出益护夕阳本机材料',files:[result.uri],dialogTitle:'选择保存或分享方式'});
  }catch(error){toast('未完成导出或已取消，原记录和附件仍保存在本机。');}
}
function contentAsset(path,kind){
  if(typeof path!=='string')return '';
  const ext=kind==='audio'?'(?:mp3|m4a|wav)':'(?:png|jpg|jpeg|webp)';
  return new RegExp('^assets/'+kind+'/[a-zA-Z0-9_-]+\\.'+ext+'$','i').test(path)?path:'';
}
function articleMedia(article){
  const cover=article.cover, audio=article.audio;
  const imagePath=cover&&contentAsset(cover.src,'images');
  const audioPath=audio&&audio.reviewed===true&&['human','synthetic'].includes(audio.kind)&&contentAsset(audio.src,'audio');
  return (imagePath?`<figure class="article-figure"><img src="${esc(imagePath)}" alt="${esc(cover.alt||'文章配图')}" loading="lazy">${cover.caption?`<figcaption>${esc(cover.caption)}</figcaption>`:''}</figure>`:'')+
    (audioPath?`<section class="article-audio" aria-label="文章音频"><h2>${audio.kind==='human'?'听真人讲解':'听语音讲解'}</h2><p>${audio.kind==='human'?'真人录制':'AI 合成配音'}${audio.credit?' · '+esc(audio.credit):''}</p><audio controls preload="none" aria-label="${esc(article.title)}音频"><source src="${esc(audioPath)}">您的设备暂不支持播放音频。</audio><p class="audio-error" role="status" hidden>音频暂时无法播放，请先阅读下方文字。</p></section>`:'');
}
function appSettingsEntry(){return `<button class="setting" data-mobile="storage">${icon('lock')}<span><strong>本机数据与使用说明</strong><small>了解记录、附件和分享的保存方式</small></span>${icon('chevron')}</button>`;}
document.addEventListener('click',e=>{
  const save=e.target.closest('[data-save-attachment]');
  if(save){const r=records.find(r=>r.id===save.dataset.record);const f=r?.files[Number(save.dataset.saveAttachment)];if(f)download(f.blob,f.name);return;}
  if(e.target.closest('[data-mobile="storage"]'))modal('本机数据与使用说明',`<p>维权记录、附件、匿名分享和联系人仅保存在当前应用中，不会提交给机构，也不会对其他用户公开。</p><p>网页与安卓安装版各自保存数据，暂不相互同步。卸载 App 或清除应用数据可能删除本机记录；重要记录请先导出，附件请逐个另存。</p><p>体验时请使用虚构或脱敏信息，不填写个人敏感资料。</p>`);
});
document.addEventListener('error',e=>{
  if(e.target.tagName==='AUDIO'||e.target.tagName==='SOURCE'){
    const section=e.target.closest('.article-audio');
    if(section){section.querySelector('.audio-error').hidden=false;section.querySelector('audio').hidden=true;}
  }
},true);
document.addEventListener('play',e=>{if(e.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(a=>{if(a!==e.target)a.pause();});},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopArticleAudio();});
window.addEventListener('pagehide',stopArticleAudio);
window.addEventListener('DOMContentLoaded',()=>{
  const app=window.Capacitor?.Plugins?.App;
  if(nativeApp()&&app){
    app.addListener('backButton',()=>{
      if(document.querySelector('#modal').open){closeModal();return;}
      if(route==='report'&&step>0){persistDraft();step--;render();return;}
      if(route.startsWith('article/'))navigate('learn');
      else if(route.startsWith('lesson/'))navigate('classroom');
      else if(route.startsWith('faq/'))navigate('ask');
      else if(route.startsWith('case/'))navigate('cases');
      else if(route.startsWith('story/'))navigate('stories');
      else if(route==='story-new')navigate('stories');
      else if(route!=='home')navigate('home');
      else app.minimizeApp();
    });
  }
});
