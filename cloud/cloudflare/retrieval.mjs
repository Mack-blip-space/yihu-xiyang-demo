import {KNOWLEDGE} from './knowledge.mjs';
const normalize=s=>s.toLowerCase().replace(/[\s\p{P}]/gu,'');
const grams=s=>new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));
export function retrieve(question){
  const q=grams(normalize(question));
  const intents=[
    [/解冻费|安全账户|陌生账户|被骗|诈骗|催.{0,8}转账|验证码|冒充|公检法|自称.{0,8}(法院|银行|公安|检察)|法院.{0,12}(电话|短信|出庭)|银行.{0,12}(电话|短信)|要求.{0,8}出庭/,'QA01',100],
    [/证据|凭证|保存.{0,8}(材料|记录)|聊天记录/,'QA02',50],
    [/网购|快递|未收到|没收到|不发货/,'QA03',70],
    [/理财|提现|投资|非法集资/,'QA04',70],
    [/保健品|健康讲座/,'QA05',70],
    [/法律援助|免费律师/,'QA06',90],
    [/诉讼费|减交|缓交|免交/,'QA07',100],
    [/(子女|家人|女儿|儿子).{0,8}(代理|代为|代办|帮.{0,3}起诉)|委托代理/,'QA08',90],
    [/公益诉讼|公益损害/,'QA09',60],
    [/支持起诉|赡养|公益诉讼.{0,12}(不同|区别)/,'QA10',100]
  ];
  const ranked=KNOWLEDGE.map(r=>{
    const title=grams(normalize(r.title+r.summary));
    const body=grams(normalize(r.sections.map(s=>s.text).join('')));
    let score=0,hits=0;for(const g of q){if(title.has(g)){score+=4;hits++;}else if(body.has(g)){score++;hits++;}}
    let intent=false;for(const [pattern,id,boost] of intents)if(r.id===id&&pattern.test(question)){score+=boost;intent=true;}
    return {r,score,hits,intent};
  }).filter(x=>x.score>=50||x.hits>=2&&x.score>=7).sort((a,b)=>b.score-a.score||a.r.id.localeCompare(b.r.id));
  return (ranked.some(x=>x.intent)?ranked.filter(x=>x.intent):ranked).slice(0,3).map(x=>x.r);
}
export function knowledgePrompt(question){
  const records=retrieve(question);
  const context=records.length?records.map(r=>`[${r.id}] ${r.title}\n${r.sections.map(s=>s.heading+'：'+s.text).join('\n')}`).join('\n\n'):'没有检索到匹配的知识库资料。';
  return {records,context};
}
export function checkGrounding(answer,records){
  const trusted=records.map(r=>r.sections.map(s=>s.text).join('\n')).join('\n');
  const specifics=answer.match(/(?:\d+|[一二三四五六七八九十百]+)\s*(?:个工作日|工作日|日内|天内|个月内)|第\s*[\d一二三四五六七八九十百]+\s*条/g)||[];
  const fabricatedQuote=[...answer.matchAll(/[“「]([^”」]{8,})[”」]/g)].some(m=>/依据|规定|指引|原文|》/.test(answer.slice(Math.max(0,m.index-80),m.index))&&!normalize(trusted).includes(normalize(m[1])));
  const unsupportedPhone=(answer.match(/(?<!\d)\d{5,}(?!\d)/g)||[]).some(x=>!['12309','12315','12348'].includes(x)&&!normalize(trusted).includes(x));
  const unsupported=fabricatedQuote||specifics.some(x=>!normalize(trusted).includes(normalize(x)))||unsupportedPhone||/法学院|审校|审核资料|项目团队|开发过程|依法免交|不收诉讼费|一律免交|肯定免交|保证全部追回|必然胜诉/.test(answer)||/\[(?:QA|KT|AL|LJ)\d{2}\]/g.test(answer)&&[...answer.matchAll(/\[((?:QA|KT|AL|LJ)\d{2})\]/g)].some(m=>!records.some(r=>r.id===m[1]));
  if(!unsupported)return {answer,answerMode:'generated'};
  const preferred=records.find(r=>r.kind==='QA')||records[0];
  return {answer:preferred?'本次生成内容含无法核实的信息，改为展示知识库资料摘要：\n\n['+preferred.id+'] '+preferred.title+'\n'+preferred.sections.slice(0,2).map(s=>s.heading+'\n'+s.text).join('\n\n')+'\n\n具体适用条件请向受理机构或12348核实。':'当前资料不足以支持具体期限、费用或个案结论。请说明问题类型和办理阶段，或向12348咨询。',answerMode:'reviewed-excerpt'};
}
