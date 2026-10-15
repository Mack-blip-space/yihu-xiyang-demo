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
export function checkGrounding(answer,records){
  const trusted=records.map(r=>r.sections.map(s=>s.text).join('\n')).join('\n');
  const specifics=answer.match(/(?:\d+|[一二三四五六七八九十百]+)\s*(?:个工作日|工作日|日内|天内|个月内)|第\s*[\d一二三四五六七八九十百]+\s*条/g)||[];
  const unsupported=specifics.some(x=>!trusted.includes(x))||/依法免交|不收诉讼费|一律免交|肯定免交|保证全部追回|必然胜诉/.test(answer)||/\[(?:QA|KT|AL|LJ)\d{2}\]/g.test(answer)&&[...answer.matchAll(/\[((?:QA|KT|AL|LJ)\d{2})\]/g)].some(m=>!records.some(r=>r.id===m[1]));
  if(!unsupported)return {answer,answerMode:'generated'};
  const preferred=records.find(r=>r.kind==='QA')||records[0];
  return {answer:preferred?'本次生成内容含无法核实的具体结论，改为展示审核资料摘要：\n\n['+preferred.id+'] '+preferred.title+'\n'+preferred.sections.slice(0,2).map(s=>s.heading+'\n'+s.text).join('\n\n')+'\n\n具体适用条件请向受理机构或12348核实。':'当前资料不足以支持具体期限、费用或个案结论。请说明问题类型和办理阶段，或向12348咨询。',answerMode:'reviewed-excerpt'};
}
