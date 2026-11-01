// Synthetic integration choices only; never applied to real characters.
import {advancementContext} from '../maquette/character-advancement.mjs';
import {classChoiceSpecs} from '../maquette/class-profiles.mjs';
import {classProfile,classSkills,finalScores} from '../maquette/character-rules.mjs';
import {sacredChoices} from '../maquette/cleric-progression.mjs';
export function completeAdvancement(base,candidate,catalogue){
  const c=catalogue;
  let context=advancementContext(base,candidate,catalogue),s=context.candidate,view=context.catalogue;
  if(s.classId==='clerc'&&!s.divineOrder)s.divineOrder='Protecteur';
  if(s.level>=3&&!s.subclassId)s.subclassId=c.subclasses.find(row=>row.classe_parente===s.classId).id;
  const skills=classSkills(s,view);if(s.classSkills.length!==skills.count)s.classSkills=skills.options.slice(0,skills.count);
  if(s.hpMode!=='fixed')s.hpRolls[s.level]=3;
  const row=view.classes.find(row=>row.id===s.classId).niveaux[s.level];
  if(row.amelioration&&!s.advancements[s.level]){
    const scores=finalScores(s,view.backgrounds.find(b=>b.id===s.backgroundId),view),abilities=[];
    for(let n=0;n<2;n++){const ability=Object.keys(scores).sort((a,b)=>scores[a]-scores[b]).find(a=>scores[a]<20);abilities.push(ability);scores[ability]++;}
    s.advancements[s.level]=row.amelioration.type==='don'?{mode:'feat',featId:'faveur_de_vigueur',featAbility:'CON',abilities:[],notes:'',choices:{}}:{mode:'ability',abilities,featId:'',featAbility:'',notes:'',choices:{}};
  }
  if(sacredChoices(s,view).length&&!s.sacredStrike)s.sacredStrike=sacredChoices(s,view)[0].nom;
  for(let pass=0;pass<4;pass++){
    context=advancementContext(base,s,catalogue);s=context.candidate;view=context.catalogue;
    for(const spec of classChoiceSpecs(s,view)){
      const picked=s.classChoices[spec.key]||[];
      if(spec.kind==='names'){s.classChoices[spec.key]=Array.from({length:spec.count},(_,i)=>picked[i]||'Langue '+i);continue;}
      if(spec.kind==='number'){s.classChoices[spec.key]=[picked[0]||'0'];continue;}
      const valid=picked.filter(id=>spec.options.some(row=>row.id===id));
      if(spec.key==='spellbook'&&s.level>=18){
        const required=[...spec.options.filter(o=>c.spells.find(x=>x.id===o.id)?.niveau===2).slice(0,1),...spec.options.filter(o=>c.spells.find(x=>x.id===o.id)?.niveau===3).slice(0,2)].map(o=>o.id);
        for(const id of required)if(!valid.includes(id))valid.push(id);
      }
      s.classChoices[spec.key]=[...valid,...spec.options.map(row=>row.id).filter(id=>!valid.includes(id))].slice(0,spec.count);
    }
  }
  const p=classProfile(s,view);
  for(const [key,pool,count]of [['cantrips',p.cantrips,p.cantripCount],['prepared',p.prepared,p.preparedCount]]){
    const old=s[key].filter(id=>pool.some(row=>row.id===id));s[key]=[...old,...pool.map(row=>row.id).filter(id=>!old.includes(id))].slice(0,count);
  }
  return s;
}
