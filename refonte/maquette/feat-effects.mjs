import {selectedLevelFeats,domainBenefits} from './cleric-progression.mjs';
import {originFeats,originSkills} from './origin-rules.mjs';
const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const skillKey=v=>key(v)==='intuition'?'perspicacite':key(v);
export const featChoicesInitial=()=>({skill:'',expertise:'',damageType:'',rituals:[],resistances:[],spell:''});
export const damageTypes=['acide','contondants','feu','force','foudre','froid','nécrotique','perforants','poison','psychique','radiant','tonnerre','tranchants'];
export const damageKey=v=>({radiance:'radiant',contondant:'contondants',perforant:'perforants',tranchant:'tranchants'}[key(v)]||key(v));
export function priorSkillNames(state,c,level){
  const before={...state,level:level-1};
  const values=[...originSkills(before,c),...(state.classSkills||[]),...domainBenefits(before,c).skills];
  for(const row of selectedLevelFeats(before,c))if(row.feat.id==='comedien'&&row.choice.choices?.skill)values.push(row.choice.choices.skill);
  return values.filter((v,i)=>values.findIndex(x=>skillKey(x)===skillKey(v))===i).map(v=>c.skills.find(s=>skillKey(s.nom)===skillKey(v))?.nom||v);
}
export function classSpellPool(state,c,level){
 const cls=c.classes.find(x=>x.id===state.classId),slots=cls?.niveaux?.[level]?.emplacements_de_sort||{};const max=Math.max(0,...Object.entries(slots).filter(([,count])=>count>0).map(([rank])=>+rank));
 return c.spells.filter(s=>s.niveau>=0&&s.niveau<=max&&s.classes?.some(n=>key(n)===key(cls?.nom)));
}
export function ritualPool(state,c,level){
  const cls=c.classes.find(x=>x.id===state.classId),row=cls?.niveaux?.[level];
  const max=Math.max(0,...Object.entries(row?.emplacements_de_sort||{}).filter(([,count])=>count>0).map(([rank])=>+rank));
  return c.spells.filter(s=>s.rituel===true&&s.niveau>=1&&s.niveau<=max&&(s.classes||[]).some(name=>key(name)===key(cls?.nom)));
}
export function featChoiceSpec(state,c,row){
  const id=row.feat?.id,level=row.level;
  if(id==='faveur_de_competence')return {field:'expertise',label:'Expertise de la faveur de compétence',options:c.skills.map(s=>s.nom)};
  if(id==='faveur_de_resistance_aux_energies')return {field:'resistances',label:'Deux résistances distinctes',options:['acide','feu','froid','foudre','nécrotique','poison','psychique','radiant','tonnerre']};
  if(id==='faveur_du_destin')return {field:'spell',label:'Sort accordé par la faveur du destin',options:classSpellPool(state,c,level)};
  if(id==='comedien')return {field:'skill',label:'Compétence accordée par Comédien',options:['Représentation','Tromperie']};
  if(id==='expert')return {field:'expertise',label:'Expertise dans une compétence déjà maîtrisée',options:priorSkillNames(state,c,level)};
  if(id==='observateur')return {field:'expertise',label:'Compétence observée (expertise si elle est maîtrisée)',options:['Perception','Investigation','Perspicacité']};
  if(id==='adepte_elementaire'){
    const used=selectedLevelFeats({...state,level:level-1},c).filter(r=>r.feat.id===id).map(r=>r.choice.choices?.damageType);
    return {field:'damageType',label:'Type de dégâts élémentaires',options:['acide','froid','feu','foudre','tonnerre'].filter(v=>!used.some(x=>damageKey(x)===damageKey(v)))};
  }
  if(id==='incantateur_d_elite')return {field:'damageType',label:'Type de dégâts dont les sorts ignorent la résistance',options:damageTypes};
  if(id==='magie_rituelle')return {field:'rituals',label:'Deux sorts rituels de votre liste de classe',options:ritualPool(state,c,level)};
  return null;
}
export function featChoiceErrors(state,c){
  const errors=[];
  for(const row of selectedLevelFeats(state,c)){
    const spec=featChoiceSpec(state,c,row);if(!spec)continue;
    const choices={...featChoicesInitial(),...row.choice.choices};
    if(spec.field==='rituals'||spec.field==='resistances'){
      if(spec.field==='resistances'){if(choices.resistances.length!==2||new Set(choices.resistances).size!==2||choices.resistances.some(v=>!spec.options.includes(v)))errors.push(`Niveau ${row.level} · ${row.feat.nom} : choisissez deux résistances distinctes.`);continue;}
      if(choices.rituals.length!==2||new Set(choices.rituals).size!==2||choices.rituals.some(id=>!spec.options.some(s=>s.id===id)))errors.push(`Niveau ${row.level} · ${row.feat.nom} : choisissez deux rituels distincts accessibles à ce niveau.`);
    }else if(spec.field==='spell'){if(!spec.options.some(s=>s.id===choices.spell))errors.push(`Niveau ${row.level} · ${row.feat.nom} : choisissez un sort de votre liste.`);
    }else if(!spec.options.includes(choices[spec.field]))errors.push(`Niveau ${row.level} · ${row.feat.nom} : ${spec.label.toLocaleLowerCase('fr')}.`);
  }
  return errors;
}
export function epicGrantSpells(state,c){return selectedLevelFeats(state,c).filter(r=>r.feat.id==='faveur_du_destin').flatMap(r=>{const spell=classSpellPool(state,c,r.level).find(s=>s.id===r.choice.choices?.spell);return spell?[{...spell,source:r.feat.nom,utilisation:'1_repos_long'}]:[];});}
export function ritualGrantSpells(state,c){
  return selectedLevelFeats(state,c).filter(r=>r.feat.id==='magie_rituelle').flatMap(row=>{
    const pool=ritualPool(state,c,row.level);
    return [...new Set(row.choice.choices?.rituals||[])].map(id=>pool.find(s=>s.id===id)).filter(Boolean).map(s=>({...s,sourceName:s.nom,grantSource:`Magie rituelle · niveau ${row.level}`}));
  });
}
function numericText(text,mods,pb,ability){
  const signed=v=>v===null||v===undefined?'—':String(v);
  const chosen=mods[ability];
  text=String(text).replace(/DD\s*8\s*\+\s*mod\. CHA\s*\+\s*bonus maîtrise/gi,()=>`DD ${mods.CHA===null?'—':8+pb+mods.CHA}`)
    .replace(/DD\s*=\s*8\s*\+\s*bonus maîtrise\s*\+\s*mod\. caract\./gi,()=>`DD ${chosen===null||chosen===undefined?'—':8+pb+chosen}`)
    .replace(/8\s*\+\s*bonus maîtrise\s*\+\s*modificateur de caract\./gi,()=>chosen===null||chosen===undefined?'à compléter':String(8+pb+chosen))
    .replace(/mod(?:ificateur)?\.?(?: de)?\s*(FOR|DEX|CON|INT|SAG|CHA)\b/gi,(_,a)=>signed(mods[a.toUpperCase()]))
    .replace(/modificateur de caract\./gi,()=>signed(chosen))
    .replace(/bonus (?:de )?maîtrise/gi,String(pb)).replace(/\+\s*-/g,'− ');
  return text;
}
export function featEffects(state,c,mods,proficiency){
  const rows=selectedLevelFeats(state,c),all=[...originFeats(state,c).filter(g=>g.feat).map(g=>({...g,label:g.label||(g.slot==='human'?'Don humain':'Don d’historique')})),...rows.filter(r=>r.feat.categorie!=='origine').map(r=>({...r,label:`Don du niveau ${r.level}`}))];
  const ids=new Set(all.map(g=>g.feat.id)),has=id=>ids.has(id);
  const mastered=[],expertise=[],elements=[];
  for(const row of rows){
    const choice={...featChoicesInitial(),...row.choice.choices};
    if(row.feat.id==='comedien'&&['Représentation','Tromperie'].includes(choice.skill))mastered.push(choice.skill);
    if(['expert','observateur','faveur_de_competence'].includes(row.feat.id)&&choice.expertise)expertise.push(choice.expertise);
    if(['adepte_elementaire','incantateur_d_elite'].includes(row.feat.id)&&choice.damageType)elements.push({type:choice.damageType,rerollOnes:row.feat.id==='adepte_elementaire',source:row.feat.nom});
  }
  return {
    has,mastered:has('faveur_de_competence')?c.skills.map(s=>s.nom):mastered,expertise,elements,trueSight:has('faveur_de_vision_lucide')?18:0,
    tools:[...(has('chef_cuisinier')?['Ustensiles de cuisinier']:[]),...(has('empoisonneur')||has('preparateur_de_poison')?["Matériel d’empoisonneur"]:[])],
    weapons:[...(has('formation_aux_armes_de_guerre')?['armes_de_guerre']:[]),...(has('cogneur_lourd')?['armes_lourdes']:[]),...(has('bagarreur_de_tavernes')?['armes_improvisees']:[])],
    armors:[...(has('protection_legere')?['armures_legeres','boucliers']:[]),...(has('protection_intermediaire')?['armures_intermediaires']:[]),...(has('protection_lourde')?['armures_lourdes']:[])],
    speedBonus:(has('mobile')?3:0)+(has('faveur_de_vitesse')?9:0),climb:has('athlete'),darkvision:has('discret')?18:0,mediumDexCap:has('maitre_des_armures_intermediaires')?3:null,
    resistances:[...(has('empoisonneur')||has('preparateur_de_poison')?['poison']:[]),...rows.filter(r=>r.feat.id==='faveur_de_resistance_aux_energies').flatMap(r=>r.choice.choices?.resistances||[])],
    schools:has('affinite_ombreuse')?['illusion','necromancie']:[],
    summaries:all.map(g=>({name:g.feat.nom,source:g.label,choices:g.choice?.choices||null,ability:g.choice?.featAbility||null,effects:(g.feat.effets||[]).filter(e=>e.type!=='caracteristique').map(e=>numericText(e.valeur,mods,proficiency,g.choice?.featAbility))})),
  };
}
export function weaponWithFeats(weapon,effects){
  const copy=structuredClone(weapon),name=key(copy.nom);copy.featRules=[];
  if(name.includes('arbalete')){
    if(effects.has('tireur_d_elite')||effects.has('maitre_arbaletrier')&&name.includes('legere'))for(const prop of ['legere','allonge'])if(!copy.proprietes.includes(prop))copy.proprietes.push(prop);
    if(effects.has('maitre_arbaletrier')&&(name.includes('legere')||name.includes('main'))){copy.proprietes=copy.proprietes.filter(p=>key(p)!=='chargement');copy.featRules.push('Chargement ignoré ; tir à 1,50 m sans désavantage.');}
    if(effects.has('tireur_d_elite'))copy.featRules.push('Tir à 1,50 m sans désavantage.');
  }
  if(effects.has('combattant_a_deux_armes'))copy.featRules.push('Seconde attaque à deux armes : le modificateur de caractéristique s’ajoute aux dégâts.');
  const type=damageKey(copy.degats?.type);
  if(effects.has('faveur_d_attaque_irresistible')&&['contondants','perforants','tranchants'].includes(type))copy.featRules.push('Faveur d’attaque irrésistible : cette arme ignore la résistance à ses dégâts.');
  if(effects.has('perforateur')&&type==='perforants')copy.featRules.push('Dégâts perforants : relancer les 1 ; un dé supplémentaire en cas de critique.');
  if(effects.has('broyeur')&&type==='contondants')copy.featRules.push('Critique : dégâts supplémentaires égaux à la maîtrise. Poussée ou renversement : une fois par tour.');
  if(effects.has('trancheur')&&type==='tranchants')copy.featRules.push('Critique : désavantage à la prochaine attaque de la cible.');
  return copy;
}
