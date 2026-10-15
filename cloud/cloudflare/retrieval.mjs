import {KNOWLEDGE} from './knowledge.mjs';
const normalize=s=>s.toLowerCase().replace(/[\s\p{P}]/gu,'');
const grams=s=>new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));
export function retrieve(question){
  const q=grams(normalize(question));
  return KNOWLEDGE.map(r=>{
    const title=grams(normalize(r.title+r.summary));
    const body=grams(normalize(r.sections.map(s=>s.text).join('')));
    let score=0,hits=0;for(const g of q){if(title.has(g)){score+=4;hits++;}else if(body.has(g)){score++;hits++;}}
    return {r,score,hits};
  }).filter(x=>x.hits>=2&&x.score>=7).sort((a,b)=>b.score-a.score||a.r.id.localeCompare(b.r.id)).slice(0,3).map(x=>x.r);
}
export function knowledgePrompt(question){
  const records=retrieve(question);
  const context=records.length?records.map(r=>`[${r.id}] ${r.title}\n${r.sections.map(s=>s.heading+'：'+s.text).join('\n')}`).join('\n\n'):'没有检索到匹配的审核资料。';
  return {records,context};
}
