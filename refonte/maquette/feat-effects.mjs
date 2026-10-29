import {selectedLevelFeats,domainBenefits} from './cleric-progression.mjs';
import {originFeats,originSkills} from './origin-rules.mjs';
import {classMagic} from './class-magic.mjs';
import {classTraining} from './progression.mjs';
const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const skillKey=v=>key(v)==='intuition'?'perspicacite':key(v);
export const featChoicesInitial=()=>({skill:'',expertise:'',damageType:'',rituals:[],resistances:[],spell:'',weapon:''});
export const damageTypes=['acide','contondants','feu','force','foudre','froid','nécrotique','perforants','poison','psychique','radiant','tonnerre','tranchants'];
export const damageKey=v=>({radiance:'radiant',contondant:'contondants',perforant:'perforants',tranchant:'tranchants'}[key(v)]||key(v));
export function priorSkillNames(state,c,level){
  const before={...state,level:level-1};
  const values=[...originSkills(before,c),...(state.classSkills||[]),...domainBenefits(before,c).skills];
  if(state.classId==='barbare'&&level>3)values.push(...(state.classChoices?.wildSkill||[]));
  if(state.classId==='rodeur'&&level>3&&state.subclassId==='rodeur_vagabond_feerique')values.push(...(state.classChoices?.feySkill||[]));
  if(state.classId==='guerrier'&&level>3&&state.subclassId==='guerrier_maitre_guerre')values.push(...(state.classChoices?.studentSkill||[]));
  if(state.classId==='moine'&&level>3&&state.subclassId==='moine_credo_misericorde')values.push('Perspicacité','Médecine');
  if(state.classId==='barde'&&level>3){if(state.subclassId==='barde_college_savoir')values.push(...(state.classChoices?.loreSkills||[]));}
  for(const row of selectedLevelFeats(before,c)){
    if(row.feat.id==='expert'&&row.choice.choices?.skill)values.push(row.choice.choices.skill);
    if(['observateur','keen_mind'].includes(row.feat.id)&&row.choice.choices?.expertise)values.push(row.choice.choices.expertise);
    if(row.feat.id==='faveur_de_competence')values.push(...c.skills.map(s=>s.nom));
  }
  return values.filter((v,i)=>values.findIndex(x=>skillKey(x)===skillKey(v))===i).map(v=>c.skills.find(s=>skillKey(s.nom)===skillKey(v))?.nom||v);
}
export function classSpellPool(state,c,level){
 const magic=classMagic(state,c,level),slots=magic.row.emplacements_de_sort||{};const max=Math.max(0,...Object.entries(slots).filter(([,count])=>count>0).map(([rank])=>+rank));
 return c.spells.filter(s=>s.niveau>=0&&s.niveau<=max&&s.classes?.some(n=>key(n)===key(magic.spellClass)));
}
export function ritualPool(state,c,level){
  return c.spells.filter(s=>s.rituel===true&&s.niveau===1);
}
function priorExpertise(state,c,level){
  const names=[];
  if(['barde','rodeur'].includes(state.classId)){if(level>=2)names.push(...(state.classChoices?.expertise2||[]));if(level>=9)names.push(...(state.classChoices?.expertise9||[]));}
  if(state.classId==='roublard'){names.push(...(state.classChoices?.expertise1||[]));if(level>=6)names.push(...(state.classChoices?.expertise6||[]));}
  if(state.classId==='magicien'&&level>=2)names.push(...(state.classChoices?.scholar||[]));
  for(const row of selectedLevelFeats({...state,level:level-1},c)){
    if(['expert','faveur_de_competence'].includes(row.feat.id))names.push(row.choice.choices?.expertise);
    if(['observateur','keen_mind'].includes(row.feat.id)&&priorSkillNames(state,c,row.level).some(n=>skillKey(n)===skillKey(row.choice.choices?.expertise)))names.push(row.choice.choices?.expertise);
  }
  return names.filter(Boolean).map(skillKey);
}
export function featChoiceSpec(state,c,row){
  const id=row.feat?.id,level=row.level;
  if(id==='faveur_de_competence')return {field:'expertise',label:'Expertise de la faveur de compétence',options:c.skills.map(s=>s.nom).filter(n=>!priorExpertise(state,c,level).includes(skillKey(n)))};
  if(id==='faveur_de_resistance_aux_energies')return {field:'resistances',label:'Deux résistances distinctes',options:['acide','feu','froid','foudre','nécrotique','poison','psychique','radiant','tonnerre']};
  if(id==='expert')return {field:'expertise',label:'Expertise dans une compétence maîtrisée',options:[...new Set([...priorSkillNames(state,c,level),row.choice.choices?.skill].filter(Boolean))].filter(n=>!priorExpertise(state,c,level).includes(skillKey(n)))};
  if(id==='observateur')return {field:'expertise',label:'Compétence observée (expertise si elle est maîtrisée)',options:['Perception','Investigation','Perspicacité']};
  if(id==='keen_mind')return {field:'expertise',label:'Connaissance approfondie (expertise si déjà maîtrisée)',options:['Arcanes','Histoire','Investigation','Nature','Religion']};
  if(id==='weapon_master'){
    const training=classTraining({...state,level},c).weapons;
    if(selectedLevelFeats({...state,level:level-1},c).some(r=>r.feat.id==='formation_aux_armes_de_guerre'))training.push('armes_de_guerre');
    return {field:'weapon',label:'Type d’arme dont vous pouvez utiliser la botte',options:c.weapons.filter(w=>w.botte&&training.some(t=>key(t)===key(w.nom)||t==='armes_courantes'&&w.categorie.includes('courante')||t==='armes_de_guerre'&&w.categorie.includes('guerre')||t==='armes_courantes_corps_a_corps'&&w.categorie==='arme_courante_corps_a_corps'||t==='armes_de_guerre_finesse_ou_legeres'&&w.categorie.includes('guerre')&&w.proprietes.some(p=>['finesse','legere'].includes(p)))).map(w=>w.nom)};
  }
  if(['affinite_feerique','affinite_ombreuse'].includes(id))return {field:'spell',label:'Sort de niveau 1 accordé par le don',options:c.spells.filter(s=>s.niveau===1&&(id==='affinite_feerique'?['divination','enchantement']:['illusion','necromancie']).includes(key(s.ecole)))};
  if(id==='adepte_elementaire'){
    const used=selectedLevelFeats({...state,level:level-1},c).filter(r=>r.feat.id===id).map(r=>r.choice.choices?.damageType);
    return {field:'damageType',label:'Type de dégâts élémentaires',options:['acide','froid','feu','foudre','tonnerre'].filter(v=>!used.some(x=>damageKey(x)===damageKey(v)))};
  }
  if(id==='magie_rituelle')return {field:'rituals',label:'Sorts rituels de niveau 1, toute liste',count:Math.ceil(state.level/4)+1,options:ritualPool(state,c,level)};
  return null;
}
export function featChoiceSpecs(state,c,row){
  const primary=featChoiceSpec(state,c,row);
  if(row.feat?.id==='expert')return [{field:'skill',label:'Nouvelle compétence maîtrisée',options:c.skills.map(s=>s.nom).filter(n=>!priorSkillNames(state,c,row.level).some(p=>skillKey(p)===skillKey(n)))},primary];
  return primary?[primary]:[];
}
export function featChoiceErrors(state,c){
  const errors=[];
  for(const row of selectedLevelFeats(state,c)){
    for(const spec of featChoiceSpecs(state,c,row)){
    const choices={...featChoicesInitial(),...row.choice.choices};
    if(spec.field==='rituals'||spec.field==='resistances'){
      if(spec.field==='resistances'){if(choices.resistances.length!==2||new Set(choices.resistances).size!==2||choices.resistances.some(v=>!spec.options.includes(v)))errors.push(`Niveau ${row.level} · ${row.feat.nom} : choisissez deux résistances distinctes.`);continue;}
      if(choices.rituals.length!==spec.count||new Set(choices.rituals).size!==spec.count||choices.rituals.some(id=>!spec.options.some(s=>s.id===id)))errors.push(`Niveau ${row.level} · ${row.feat.nom} : choisissez ${spec.count} rituels distincts de niveau 1.`);
    }else if(spec.field==='spell'){if(!spec.options.some(s=>s.id===choices.spell))errors.push(`Niveau ${row.level} · ${row.feat.nom} : choisissez un sort de votre liste.`);
    }else if(!spec.options.includes(choices[spec.field]))errors.push(`Niveau ${row.level} · ${row.feat.nom} : ${spec.label.toLocaleLowerCase('fr')}.`);
    }
  }
  return errors;
}
export function epicGrantSpells(){return [];}
export function ritualGrantSpells(state,c){
  return selectedLevelFeats(state,c).filter(r=>r.feat.id==='magie_rituelle').flatMap(row=>{
    const pool=ritualPool(state,c,row.level);
    return [...new Set(row.choice.choices?.rituals||[])].map(id=>pool.find(s=>s.id===id)).filter(Boolean).map(s=>({...s,sourceName:s.nom,caracteristique:row.choice.featAbility,grantSource:`Magie rituelle · niveau ${row.level}`,utilisation:'Toujours préparé, rituel ou emplacement ; Rituel rapide une fois par Repos long, partagé entre tous les rituels préparés.'}));
  });
}
export function featGrantSpells(state,c){
  const result=ritualGrantSpells(state,c);
  for(const row of selectedLevelFeats(state,c)){
    const id=row.feat.id,selected=row.choice.choices?.spell;
    const ids=id==='affinite_feerique'?['foulee_brumeuse',selected]:id==='affinite_ombreuse'?['invisibilite',selected]:id==='telepathe'?['detection_des_pensees']:id==='telekinesiste'?['main_du_mage']:[];
    for(const spellId of ids.filter(Boolean)){
      const spell=c.spells.find(s=>s.id===spellId);if(!spell)continue;
      let value={...spell,caracteristique:row.choice.featAbility,grantSource:row.feat.nom,utilisation:id==='telekinesiste'?'Sort mineur, à volonté.':'Une utilisation gratuite par Repos long pour ce sort ; emplacements possibles.'};
      if(id==='telepathe')value={...value,composantes:{V:false,S:false,M:false}};
      if(id==='telekinesiste')value={...value,portee:'18 m',composantes:{...spell.composantes,V:false,S:false},description:spell.description+' Télékinésiste : main Invisible au choix ; distance maximale d’éloignement augmentée de 9 m.'};
      result.push(value);
    }
  }
  return result;
}
function numericText(text,mods,pb,ability){
  const signed=v=>v===null||v===undefined?'—':String(v);
  const chosen=mods[ability];
  text=String(text).replace(/DD\s*8\s*\+\s*mod\. CHA\s*\+\s*bonus (?:de )?maîtrise/gi,()=>`DD ${mods.CHA===null?'—':8+pb+mods.CHA}`)
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
    if(row.feat.id==='expert'&&choice.skill)mastered.push(choice.skill);
    if(['expert','faveur_de_competence'].includes(row.feat.id)&&choice.expertise)expertise.push(choice.expertise);
    if(['observateur','keen_mind'].includes(row.feat.id)&&choice.expertise){
      if(priorSkillNames(state,c,row.level).some(n=>skillKey(n)===skillKey(choice.expertise)))expertise.push(choice.expertise);
      else mastered.push(choice.expertise);
    }
    if(row.feat.id==='adepte_elementaire'&&choice.damageType)elements.push({type:choice.damageType,rerollOnes:true,source:row.feat.nom});
  }
  return {
    has,mastered:has('faveur_de_competence')?c.skills.map(s=>s.nom):mastered,expertise,elements,trueSight:has('faveur_de_vision_lucide')?18:0,masteries:rows.filter(r=>r.feat.id==='weapon_master').map(r=>key(r.choice.choices?.weapon)).filter(Boolean),
    tools:[...(has('chef_cuisinier')?['Ustensiles de cuisinier']:[]),...(has('empoisonneur')||has('preparateur_de_poison')?["Matériel d’empoisonneur"]:[])],
    weapons:[...(has('formation_aux_armes_de_guerre')?['armes_de_guerre']:[]),...(has('bagarreur_de_tavernes')?['armes_improvisees']:[])],
    armors:[...(has('protection_legere')?['armures_legeres','boucliers']:[]),...(has('protection_intermediaire')?['armures_intermediaires']:[]),...(has('protection_lourde')?['armures_lourdes']:[])],
    speedBonus:(has('mobile')?3:0)+(has('faveur_de_vitesse')?9:0),climb:has('athlete'),darkvision:0,blindsight:has('discret')?3:0,mediumDexCap:has('maitre_des_armures_intermediaires')?3:null,
    resistances:rows.filter(r=>r.feat.id==='faveur_de_resistance_aux_energies').flatMap(r=>r.choice.choices?.resistances||[]),
    schools:[],
    summaries:all.map(g=>({name:g.feat.nom,source:g.label,choices:g.choice?.choices||null,ability:g.choice?.featAbility||null,effects:(g.feat.effets||[]).filter(e=>e.type!=='caracteristique').map(e=>numericText(e.valeur,mods,proficiency,g.choice?.featAbility))})),
  };
}
export function weaponWithFeats(weapon,effects){
  const copy=structuredClone(weapon),name=key(copy.nom);copy.featRules=[];
  if(name.includes('arbalete')){
    if(effects.has('maitre_arbaletrier')){copy.proprietes=copy.proprietes.filter(p=>key(p)!=='chargement');copy.featRules.push('Maître arbalétrier : Chargement ignoré, pas besoin de main libre pour recharger ; ennemi à 1,50 m sans désavantage ; modificateur aux dégâts de l’attaque supplémentaire de Légère si arbalète Légère.');}
  }
  if(effects.has('tireur_d_elite'))copy.featRules.push('Tireur d’élite : attaques à distance avec arme ignorant Abris partiels et importants ; armes à distance sans Désavantage de portée longue ou d’ennemi à 1,50 m.');
  if(effects.has('combattant_a_deux_armes'))copy.featRules.push('Combat à deux armes amélioré : après une attaque d’arme Légère à votre tour, attaque en action Bonus avec une autre arme de corps à corps sans Deux mains ; pas de modificateur positif aux dégâts par ce don seul.');
  if(effects.has('cogneur_lourd')&&copy.proprietes?.includes('lourde'))copy.featRules.push('Cogneur lourd : à votre tour dans l’action Attaque, +bonus de maîtrise aux dégâts sur une touche contre une créature.');
  const type=damageKey(copy.degats?.type);
  if(effects.has('faveur_d_attaque_irresistible')&&['contondants','perforants','tranchants'].includes(type))copy.featRules.push('Faveur d’attaque irrésistible : cette arme ignore la résistance à ses dégâts.');
  if(effects.has('perforateur')&&type==='perforants')copy.featRules.push('Perforateur : une fois par tour sur une touche contre une créature, relancez un dé de dégâts, nouveau résultat obligatoire ; un dé perforant supplémentaire en cas de critique.');
  if(effects.has('broyeur')&&type==='contondants')copy.featRules.push('Broyeur : une fois par tour, déplacez la créature touchée de 1,50 m vers un espace inoccupé si au plus une taille de plus ; critique : Avantage aux attaques contre elle jusqu’au début de votre prochain tour.');
  if(effects.has('trancheur')&&type==='tranchants')copy.featRules.push('Trancheur : une fois par tour, Vitesse de la créature touchée −3 m jusqu’au début de votre prochain tour ; critique : Désavantage à ses attaques jusqu’au début de votre prochain tour.');
  return copy;
}
