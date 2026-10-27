import {ABILITIES,normalize,skillKey,mainAbility,modifier,finalScores,classData,clericProfile,hitPoints,spellErrors,aptitudeErrors,backgroundBonuses} from './character-rules.mjs';
import {originSkills,originTools,originFeats,originBonuses,selectedVariant,grantedOriginSpells,originErrors} from './origin-rules.mjs';
import {domainBenefits,selectedLevelFeats,evaluateProgression,sacredChoices} from './cleric-progression.mjs';

import {featEffects,weaponWithFeats,damageKey,epicGrantSpells} from './feat-effects.mjs';

export function scaledCantripDamage(effect,text,level,explicit=null){
  if(explicit)return explicit;
  const base=String(effect.valeur).match(/^(\d+)d(\d+)$/),thresholdText=String(text||'').match(/aux niveaux ([\d, et]+)/)?.[1];
  if(!base||!thresholdText)return effect.valeur;
  const increment=[...String(text).matchAll(/\+(\d+)d(\d+)/g)].find(([,count,sides])=>sides===base[2]);
  if(!increment)return effect.valeur;
  const count=(thresholdText.match(/\d+/g)||[]).filter(n=>+n<=level).length;
  return `${+base[1]+count*+increment[1]}d${base[2]}`;
}
export const detailFields = {player:'Joueur ou joueuse',pronouns:'Pronoms',age:'Âge',height:'Taille et poids',appearance:'Apparence',alignment:'Alignement',faith:'Divinité / convictions',languages:'Langues supplémentaires',traits:'Traits de personnalité',ideals:'Idéaux',bonds:'Liens',flaws:'Défauts',story:'Histoire et notes'};
export function sheetModel(state,c) {
  const cls=classData(state,c), base=cls?.niveaux?.['0']||{};
  const species=c.species.find(s=>s.id===state.speciesId), background=c.backgrounds.find(b=>b.id===state.backgroundId);
  const scores=finalScores(state,background,c), mods=Object.fromEntries(ABILITIES.map(k=>[k,modifier(scores[k])]));
  const bonuses=originBonuses(state,c), proficiency=bonuses.proficiency, profile=clericProfile(state,c);
  const subclass=c.subclasses.find(s=>s.id===state.subclassId&&normalize(s.classe_parente)===normalize(cls?.nom)&&state.level>=3);
  const classFeatures=Object.entries(cls?.niveaux||{}).filter(([n])=>Number(n)>0&&Number(n)<=state.level).flatMap(([n,row])=>(row.capacites||[]).map(f=>({...structuredClone(f),source:`${cls.nom} · niveau ${n}`})));
  for(const feature of classFeatures){
    if(feature.nom==='Canal divin'&&profile){
      feature.utilisations.initial=profile.channel;
      for(const effect of feature.effets_disponibles||[])if(effect.jet?.des&&profile.sparkDice){effect.description=effect.description?.replace(effect.jet.des,profile.sparkDice);effect.jet.des=profile.sparkDice;}
    }
    if(feature.nom==='Frappe consacrée améliorée'){feature.effets=(feature.effets||[]).filter(e=>normalize(e.cible)===normalize(state.sacredStrike));feature.description=state.sacredStrike==='Frappe sacrée'?'Frappe sacrée : dégâts supplémentaires de 2d8, une fois par tour.':state.sacredStrike==='Magie puissante'?`Magie puissante : après les dégâts, ${mods.SAG===null?'—':2*mods.SAG} PV temporaires pour soi ou une créature à 18 m.`:'Choisissez votre option au niveau 7.';}
    if(feature.nom==='Frappe consacrée'&&state.sacredStrike){const selected=sacredChoices(state,c).find(o=>o.nom===state.sacredStrike);if(selected){feature.options=[selected];feature.description=selected.description;}}
  }
  const subclassFeatures=Object.entries(subclass?.niveaux||{}).filter(([n])=>Number(n)<=state.level).flatMap(([n,row])=>(row.capacites||[]).map(f=>({...f,source:`${subclass.nom} · niveau ${n}`})));
  const benefits=domainBenefits(state,c),levelFeats=selectedLevelFeats(state,c),progression=evaluateProgression(state,c,finalScores(state,background));
  const effects=featEffects(state,c,mods,proficiency);
  const owned=new Set([...originSkills(state,c),...(state.classSkills||[]),...benefits.skills,...effects.mastered].map(skillKey));
  const skillList=[...c.skills];
  for(const name of [...originSkills(state,c),...(state.classSkills||[])]) if(!skillList.some(s=>skillKey(s.nom)===skillKey(name))) skillList.push({nom:name});
  const choice=classFeatures.flatMap(f=>f.options||[]).find(o=>o.nom===state.divineOrder);
  const skillBonuses=choice?.effets?.filter(e=>e.type==='bonus_test_competence')||[];
  const skills=skillList.map(s=>{
    const ability=mainAbility(s.caracteristique), mod=mods[ability], trained=owned.has(skillKey(s.nom));
    const expertise=trained&&effects.expertise.some(n=>skillKey(n)===skillKey(s.nom));
    let value=mod===null||mod===undefined?null:mod+(trained?proficiency*(expertise?2:1):0);
    for(const effect of skillBonuses) if(effect.competences.some(n=>skillKey(n)===skillKey(s.nom))) {
      const bonus=mods[mainAbility(effect.valeur.replace('modificateur_',''))];
      value=value===null||bonus===null?null:value+Math.max(effect.minimum||0,bonus);
    }
    return {...s,ability,trained,expertise,value};
  }).sort((a,b)=>a.nom.localeCompare(b.nom,'fr'));
  const savingThrows=[...(base.sauvegardes_maitrise||[]).map(mainAbility),...levelFeats.filter(g=>g.feat.id==='resilient').map(g=>g.choice.featAbility)];
  const saves=ABILITIES.map(ability=>({ability,trained:savingThrows.includes(ability),value:mods[ability]===null?null:mods[ability]+(savingThrows.includes(ability)?proficiency:0)}));
  const inventory=[], money={pc:0,pa:0,pe:0,po:0,pp:0};
  function addItem(name,quantity,source) {
    const coin=String(name).match(/^(\d+)\s*(pc|pa|pe|po|pp)$/i);
    if(coin){money[coin[2].toLowerCase()]+=Number(coin[1])*quantity;return;}
    if(normalize(name)==='piecesdor'){money.po+=quantity;return;}
    const existing=inventory.find(i=>normalize(i.nom)===normalize(name));
    if(existing){existing.quantity+=quantity;existing.source+=` / ${source}`;}
    else inventory.push({nom:name,quantity,source});
  }
  const equipment=cls?.equipment?.find(e=>e.choix===state.equipment);
  (equipment?.contenu||[]).forEach(name=>addItem(name,1,'Classe'));
  (background?.equipement||[]).forEach(item=>addItem(item.nom,item.quantite??1,'Historique'));
  const armor=inventory.map(i=>c.armors.find(a=>normalize(a.nom)===normalize(i.nom))).filter(Boolean);
  const suits=armor.filter(a=>a.classe_armure?.base), shields=armor.filter(a=>a.categorie==='bouclier');
  let ac=null,acNote='Équipement à choisir';
  if(equipment) {
    acNote='Sans armure';
    if(!suits.length&&mods.DEX!==null) ac=10+mods.DEX;
    if(suits.length===1){const a=suits[0].classe_armure;ac=a.modificateur_dex&&mods.DEX===null?null:a.base+(a.modificateur_dex?Math.min(mods.DEX,effects.mediumDexCap&&suits[0].categorie==='armure_intermediaire'?effects.mediumDexCap:a.modificateur_dex_max??Infinity):0);acNote=suits[0].nom;}
    if(suits.length>1) acNote='Plusieurs armures : équipement porté à préciser';
    if(shields.length&&ac!==null){ac+=shields[0].classe_armure.bonus||0;acNote+=` + ${shields[0].nom}`;}
    acNote+=' · équipement de départ porté';
    // Les défenses spéciales ne sont pas encore interprétées : ne pas afficher une CA trompeuse.
    if(!suits.length&&[...classFeatures,...(species?.traits||[])].some(f=>/defense.*sans.*armure|armure.*naturelle/.test(normalize(f.nom)))){ac=null;acNote='Défense spéciale : voir les aptitudes';}
  }
  const weaponTraining=[...(base.maitrises_armes||[]),...(benefits.martial?['armes_de_guerre']:[]),...(benefits.rapier?['Rapière']:[]),...effects.weapons];
  const armorTraining=[...(base.maitrises_armures||[]),...(benefits.heavy?['armures_lourdes']:[]),...effects.armors];
  const attacks=inventory.flatMap(item=>{
    const source=(c.weapons||[]).find(w=>normalize(w.nom)===normalize(item.nom));if(!source)return [];
    const weapon=weaponWithFeats(source,effects);
    const finesse=weapon.proprietes?.includes('finesse'), ranged=weapon.categorie?.includes('distance');
    const ability=finesse?(mods.DEX!==null&&mods.FOR!==null?(mods.DEX>mods.FOR?'DEX':'FOR'):null):ranged?'DEX':'FOR';
    const mod=mods[ability],trained=weaponTraining.some(t=>{
      if(normalize(t)===normalize(weapon.nom))return true;
      if(t==='armes_lourdes')return weapon.proprietes?.includes('lourde');
      if(t==='armes_courantes')return weapon.categorie.includes('courante');
      if(t==='armes_de_guerre')return weapon.categorie.includes('guerre');
      if(t==='armes_courantes_corps_a_corps')return weapon.categorie==='arme_courante_corps_a_corps';
      if(t==='armes_de_guerre_propriete_legere')return weapon.categorie.includes('guerre')&&weapon.proprietes?.includes('legere');
      if(t==='armes_de_guerre_finesse_ou_legeres')return weapon.categorie.includes('guerre')&&weapon.proprietes?.some(p=>['finesse','legere'].includes(p));
      return false;
    });
    return [{...weapon,ability,trained,attack:mod===null||mod===undefined?null:mod+(trained?proficiency:0),damageBonus:mod??null}];
  });
  const castingAbility=mainAbility(base.caracteristique_incantation), castMod=mods[castingAbility];
  const magic=castMod===null||castMod===undefined?{ability:castingAbility,dc:null,attack:null}:{ability:castingAbility,dc:8+proficiency+castMod,attack:proficiency+castMod};
  const spellChoices=[...(state.cantrips||[]),...(state.prepared||[])].map(id=>c.spells.find(s=>s.id===id)).filter(Boolean).map(s=>({...s,source:cls?.nom||'Classe',caracteristique:castingAbility}));
  const spells=[...spellChoices,...(profile?.automaticCantrips||[]).map(s=>({...s,source:subclass?.nom||'Domaine',caracteristique:castingAbility,always:true})),...(profile?.always||[]).map(s=>({...s,source:s.grantSource||subclass?.nom||'Domaine',caracteristique:castingAbility,always:true})),...grantedOriginSpells(state,c),...epicGrantSpells(state,c).map(s=>({...s,caracteristique:castingAbility}))].map(s=>{
    const full=c.spells.find(x=>x.id===s.id||normalize(x.nom)===normalize(s.nom));
    const ability=mainAbility(s.caracteristique),mod=mods[ability];
    const scaling=s.niveau===0?[...String(s.niveau_superieur||'').matchAll(/(\d+d\d+)\s+au niveau\s+(\d+)/g)].filter(([,dice,level])=>+level<=state.level).at(-1)?.[1]:null;
    const damage=(s.degats||[]).map(d=>`${s.niveau===0?scaledCantripDamage(d,s.niveau_superieur,state.level,scaling):d.valeur} ${d.type}${d.note?` (${d.note})`:''}`).join(' · ');
    const schoolBonus=effects.schools.includes(normalize(s.ecole))?1:0;
    const featRules=effects.elements.filter(e=>(s.degats||[]).some(d=>damageKey(d.type)===damageKey(e.type))).map(e=>`${e.source} : résistance aux dégâts ${e.type} ignorée${e.rerollOnes?' ; les 1 aux dégâts comptent comme des 2':''}.`);
    if(s.niveau===0&&state.level>=14&&state.sacredStrike==='Magie puissante'&&s.source===cls?.nom)featRules.push(`Frappe consacrée améliorée : après les dégâts, ${mods.SAG===null?'—':2*mods.SAG} PV temporaires pour soi ou une créature à 18 m.`);
    if(schoolBonus)featRules.push('Affinité ombreuse : +1 au DD et aux attaques de ce sort.');
    return {...full,...s,ability,featRules,dc:mod===null||mod===undefined?null:8+proficiency+mod+schoolBonus,attackBonus:mod===null||mod===undefined?null:proficiency+mod+schoolBonus,damageAtLevel:damage,cantripBonus:s.niveau===0&&state.level>=7&&state.sacredStrike==='Magie puissante'&&s.source===cls?.nom?mods.SAG:null};
  }).sort((a,b)=>(a.niveau??99)-(b.niveau??99)||a.nom.localeCompare(b.nom,'fr'));
  const errors=[...originErrors(state,c),...aptitudeErrors(state,c),...spellErrors(state,c)];
  if(!state.name?.trim())errors.unshift('Donnez un nom au personnage.');
  if(ABILITIES.some(k=>scores[k]===null))errors.push('Caractéristiques à compléter.');
  if(background&&Object.values(backgroundBonuses(state,background)).reduce((a,b)=>a+b,0)!==3)errors.push('Bonus d’historique à répartir.');
  if(!equipment) errors.push('Équipement de classe à choisir.');
  if(!profile)errors.push('Les choix de classe de ce parcours restent à compléter (parcours détaillé : clerc niveaux 1 à 20).');
  const perception=skills.find(s=>skillKey(s.nom)==='perception');
  const variant=selectedVariant(state,c),speed=species?.vitesse===undefined?null:species.vitesse+effects.speedBonus+(variant?.vitesse_bonus||0);
  const resistances=[...new Set([...(species?.resistances||[]),...(variant?.resistances||[]),...effects.resistances])];
  const darkvision=Math.max(effects.darkvision,species?.vision_dans_le_noir||0,variant?.vision_dans_le_noir||0,...(species?.traits||[]).filter(t=>normalize(t.nom)==='visiondanslenoir').map(t=>Number(t.description.match(/sur (\d+) m/)?.[1])||0));
  return {effects,speed,darkvision,climb:effects.climb?speed:null,resistances,cls,species,background,subclass,variant:selectedVariant(state,c),scores,mods,proficiency,skills,saves,inventory,money,attacks,ac,acNote,magic,spells,slots:profile?.slots||{},hp:hitPoints(state,c),initiative:mods.DEX===null?null:mods.DEX+bonuses.initiative,passive:perception?.value===null||perception?.value===undefined?null:10+perception.value,classFeatures,subclassFeatures,feats:originFeats(state,c),tools:[...new Set([...originTools(state,c),...effects.tools])],errors:[...new Set(errors)],base,weaponTraining,armorTraining,progression,levelFeats,channel:profile?.channel,sparkDice:profile?.sparkDice,sacredStrike:state.level>=7?state.sacredStrike:''};
}
