import {CURRENT_RULES_VERSION} from '../maquette/character-version.mjs';
import {classProfile,classSkills} from '../maquette/character-rules.mjs';
import {classChoiceSpecs} from '../maquette/class-profiles.mjs';
import {advancementInitial,improvementLevels} from '../maquette/progression.mjs';
import {fillBackgroundFixture} from './background-fixture.mjs';
// Integration fixtures only. Browser journeys perform every choice through the actual form.
export function classFixture(c,classId,level,subclassId,overrides={}){
  const s={schemaVersion:2,rulesVersion:CURRENT_RULES_VERSION,name:`Contrôle ${classId} ${level}`,classId,level,subclassId:level>=3?subclassId:'',speciesId:'orc',backgroundId:'charlatan',equipment:'A',backgroundEquipment:'A',scores:{FOR:12,DEX:11,CON:14,INT:14,SAG:16,CHA:15},statsMethod:'physical',bonusMode:'three',classSkills:[],classChoices:{},advancements:{},hpMode:'fixed',hpRolls:{},rolls:[],cantrips:[],prepared:[],details:{},step:7,...overrides};
  s.classSkills=classSkills(s,c).options.slice(0,classSkills(s,c).count);
  for(const [i,n]of improvementLevels(s,c).entries())s.advancements[n]=n===19?{...advancementInitial(),mode:'feat',featId:'faveur_de_vigueur',featAbility:'CON'}:{...advancementInitial(),mode:'ability',abilities:['FOR',classId==='guerrier'&&i>=5?'INT':'CON']};
  if(classId==='magicien'){const reserved=new Set();for(const spec of classChoiceSpecs(s,c).filter(x=>/^savant\d+$/.test(x.key))){const choices=[...spec.options].sort((a,b)=>c.spells.find(x=>x.id===b.id).niveau-c.spells.find(x=>x.id===a.id).niveau).filter(x=>!reserved.has(x.id)).slice(0,spec.count);s.classChoices[spec.key]=choices.map(x=>x.id);choices.forEach(x=>reserved.add(x.id));}}
  // Dependencies (instruments → instrument, skill bonus → expertise) are resolved in descriptor order.
  for(let pass=0;pass<3;pass++)for(const spec of classChoiceSpecs(s,c)){
    if(s.classChoices[spec.key]?.length===spec.count&&(spec.kind||s.classChoices[spec.key].every(id=>spec.options.some(o=>o.id===id))))continue;
    s.classChoices[spec.key]=spec.kind==='number'?[spec.key==='psiDc'?'12':'0']:spec.kind==='names'?Array.from({length:spec.count},(_,i)=>`${spec.key} ${i+1}`):spec.options.slice(0,spec.count).map(o=>o.id);
    if(spec.key==='spellbook'&&level>=18){const forced=[...c.spells.filter(x=>spec.options.some(o=>o.id===x.id)&&x.niveau===2).slice(0,1),...(level>=20?c.spells.filter(x=>spec.options.some(o=>o.id===x.id)&&x.niveau===3).slice(0,2):[])].map(x=>x.id);s.classChoices.spellbook=[...forced,...spec.options.map(o=>o.id).filter(id=>!forced.includes(id))].slice(0,spec.count);}
  }
  const p=classProfile(s,c);
  s.cantrips=p.cantrips.slice(0,p.cantripCount).map(x=>x.id);
  s.prepared=(s.classId==='barde'?[...p.prepared].sort((a,b)=>Number(b.classes.includes('Barde'))-Number(a.classes.includes('Barde'))):p.prepared).slice(0,p.preparedCount).map(x=>x.id);
  return fillBackgroundFixture(s,c);
}
