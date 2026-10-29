import {classFixture} from './class-fixtures.mjs';
import {classSkills,classProfile} from '../maquette/character-rules.mjs';
import {classChoiceSpecs} from '../maquette/class-profiles.mjs';
import {grantInitial,reconcileOrigins,originFeats,grantOptions,magicFeatLists,magicFeatProfile,backgroundToolOptions,speciesSkillOptions,humanFeats,backgroundKitOptions,originSizeOptions,speciesChoiceSpecs} from '../maquette/origin-rules.mjs';
import {featChoiceSpecs} from '../maquette/feat-effects.mjs';
import {selectedLevelFeats} from '../maquette/progression.mjs';

export function originCases(c){
  return c.species.flatMap(s=>(s.variantes?.length?s.variantes:[{id:''}]).flatMap(v=>s.taille.categorie.split('_ou_').map(size=>({speciesId:s.id,variantId:v.id,speciesSize:size}))));
}
export function fillOrigins(s,c){
  s.originGrants||={};
  if(backgroundKitOptions(s,c).length&&!s.backgroundKit)s.backgroundKit=backgroundKitOptions(s,c)[0].id;
  s.classSkills=[];
  for(const spec of speciesChoiceSpecs(s,c))if(!spec.options.some(o=>o.id===s[spec.field]))s[spec.field]=spec.optional?'':spec.options[0]?.id||'';
  s.speciesSkill='';
  s.backgroundTool=backgroundToolOptions(s,c)[0]?.id||'';
  s.speciesSkill=speciesSkillOptions(s,c)[0]||'';
  if(s.speciesId==='humain'&&!humanFeats(s,c).some(f=>f.id===s.originFeatId))s.originFeatId=humanFeats(s,c).find(f=>f.id==='robuste')?.id||humanFeats(s,c)[0]?.id||'';
  if(!s.speciesSize)s.speciesSize=originSizeOptions(s,c)[0];
  reconcileOrigins(s,c);
  for(const grant of originFeats(s,c)){
    const selected=s.originGrants[grant.slot]||=grantInitial();
    const options=grantOptions(s,c,grant);
    if(options.length)selected.proficiencies=options.slice(0,3).map(o=>o.id);
    if(grant.feat?.id==='initie_a_la_magie'){
      selected.magicList=grant.forcedList||magicFeatLists(s,c,grant)[0];selected.magicAbility||='INT';
      const p=magicFeatProfile(s,c,grant);selected.cantrips=p.cantrips.slice(0,2).map(x=>x.id);selected.spell=p.spells[0]?.id||'';
    }
  }
  s.classSkills=classSkills(s,c).options.slice(0,classSkills(s,c).count);
  return s;
}
export function finishChoices(s,c){
  for(let pass=0;pass<3;pass++)for(const spec of classChoiceSpecs(s,c)){
    if(s.classChoices[spec.key]?.length===spec.count&&(spec.kind||s.classChoices[spec.key].every(id=>spec.options.some(o=>o.id===id))))continue;
    s.classChoices[spec.key]=spec.kind==='number'?[spec.key==='psiDc'?'12':'0']:spec.kind==='names'?Array.from({length:spec.count},(_,i)=>`${spec.key} ${i+1}`):spec.options.slice(0,spec.count).map(o=>o.id);
  }
  for(const row of selectedLevelFeats(s,c)){
    for(const spec of featChoiceSpecs(s,c,row)){
    if(['rituals','resistances'].includes(spec.field))row.choice.choices[spec.field]=spec.options.slice(0,spec.count||2).map(x=>x.id||x);
    else row.choice.choices[spec.field]=spec.options[0]?.id||spec.options[0]||'';
    }
  }
  const p=classProfile(s,c);s.cantrips=p.cantrips.slice(0,p.cantripCount).map(x=>x.id);s.prepared=(s.classId==='barde'?[...p.prepared].sort((a,b)=>Number(b.classes.includes('Barde'))-Number(a.classes.includes('Barde'))):p.prepared).slice(0,p.preparedCount).map(x=>x.id);
  return s;
}
const fixtureCache=new WeakMap();
export function originFixture(c,classId,level,origin,backgroundId,extra={}){
  const sub=c.subclasses.find(x=>x.classe_parente===classId);
  if(!fixtureCache.has(c))fixtureCache.set(c,new Map());
  const cache=fixtureCache.get(c),cacheKey=classId+':'+level;
  if(!cache.has(cacheKey))cache.set(cacheKey,classFixture(c,classId,level,sub.id,{scores:{FOR:12,DEX:12,CON:12,INT:12,SAG:12,CHA:12}}));
  const s=Object.assign(structuredClone(cache.get(cacheKey)),origin,{backgroundId},extra);
  if(classId==='clerc'){s.divineOrder='Protecteur';s.sacredStrike=level>=7?'Magie puissante':'';}
  fillOrigins(s,c);return finishChoices(s,c);
}
