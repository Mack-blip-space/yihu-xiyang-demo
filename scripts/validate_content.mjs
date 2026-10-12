import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync('dist/content.js','utf8'),sandbox);
const content=sandbox.window.YIHU_CONTENT;
const ids=new Set();
for(const article of content.articles){
  if(!article.id||ids.has(article.id))throw Error('Missing or duplicate article ID');
  ids.add(article.id);
  for(const [kind,media] of [['images',article.cover],['audio',article.audio]]){
    if(!media)continue;
    const extension=kind==='images'?'(?:png|jpg|jpeg|webp)':'(?:mp3|m4a|wav)';
    if(!new RegExp('^assets/'+kind+'/[a-zA-Z0-9_-]+\\.'+extension+'$','i').test(media.src))throw Error(article.id+': invalid media path');
    if(!fs.existsSync(path.join('dist',media.src)))throw Error(article.id+': missing '+media.src);
    if(kind==='audio'&&(media.reviewed!==true||!['human','synthetic'].includes(media.kind)||!media.credit))throw Error(article.id+': audio needs review, type and credit');
    if(kind==='images'&&!media.alt)throw Error(article.id+': image needs alt text');
  }
}
console.log(`Validated ${ids.size} content records and optional media.`);
