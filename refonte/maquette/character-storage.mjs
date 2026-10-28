import {ABILITIES,backgroundBonuses,clericProfile,aptitudeErrors,spellErrors,classProfile} from './character-rules.mjs';
import {originErrors,grantInitial} from './origin-rules.mjs';
import {detailFields} from './sheet-model.mjs';
import {ADVANCEMENT_LEVELS,ORIGIN_SLOTS,advancementInitial} from './cleric-progression.mjs';
import {featChoicesInitial} from './feat-effects.mjs';
const strings=['name','classId','speciesId','backgroundId','equipment','statsMethod','bonusMode','bonusTwo','bonusOne','divineOrder','subclassId','hpMode','variantId','speciesSize','speciesSkill','speciesAncestry','speciesCastingAbility','originFeatId','backgroundTool','sacredStrike'];
export function characterSnapshot(state){
  const out={schemaVersion:2};
  for(const key of strings)out[key]=state[key]??'';
  for(const key of ['level','scores','rolls','step','classSkills','cantrips','prepared','hpRolls','originGrants','details','advancements'])out[key]=state[key]??({details:{},advancements:{},hpRolls:{},rolls:[],step:0,originGrants:{background:grantInitial(),human:grantInitial()}}[key]);
  out.originGrants=Object.fromEntries(ORIGIN_SLOTS.map(slot=>[slot,{...grantInitial(),...state.originGrants?.[slot]}]));
  out.classChoices=state.classChoices||{};
  out.advancements=Object.fromEntries(Object.entries(out.advancements).map(([level,row])=>[level,{...advancementInitial(),...row,choices:{...featChoicesInitial(),...row.choices}}]));
  return JSON.parse(JSON.stringify(out));
}
export function validateSavedCharacter(input,catalogue){
  const fail=message=>{const error=new Error(message);error.status=400;throw error;};
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Personnage invalide.');
  const out={schemaVersion:2};
  for(const key of strings){const value=input[key]??'';if(typeof value!=='string'||value.length>150)fail('Un champ du personnage est invalide.');out[key]=key==='name'?value.trim():value;}
  if(!out.name||out.name.length>80)fail('Donnez un nom de 1 à 80 caractères au personnage.');
  if(!Number.isInteger(input.level)||input.level<1||input.level>20)fail('Le niveau doit être compris entre 1 et 20.');out.level=input.level;
  if(!['physical','virtual','standard'].includes(out.statsMethod)||!['fixed','physical','virtual'].includes(out.hpMode))fail('La méthode de dés est invalide.');
  out.scores={};for(const key of ABILITIES){const value=input.scores?.[key];if(value!==null&&(!Number.isInteger(value)||value<3||value>18))fail('Les caractéristiques de base doivent être comprises entre 3 et 18.');out.scores[key]=value;}
  out.step=Number.isInteger(input.step)&&input.step>=0&&input.step<=7?input.step:0;
  for(const key of ['classSkills','cantrips','prepared']){
    const values=input[key]??[];if(!Array.isArray(values)||values.length>200||values.some(v=>typeof v!=='string'||v.length>150))fail('Une sélection est invalide.');out[key]=[...new Set(values)];
  }
  const rolls=input.rolls??[];if(!Array.isArray(rolls)||![0,6].includes(rolls.length)||rolls.some(r=>!Array.isArray(r)||r.length!==4||r.some(n=>!Number.isInteger(n)||n<1||n>6)))fail('Les jets de dés sont invalides.');out.rolls=rolls;
  out.hpRolls={};for(const [level,value]of Object.entries(input.hpRolls??{})){if(!/^([2-9]|1\d|20)$/.test(level)||(value!==null&&(!Number.isInteger(value)||value<1||value>12)))fail('Un jet de points de vie est invalide.');out.hpRolls[level]=value;}
  out.advancements={};for(const level of Object.keys(input.advancements||{}).filter(n=>/^(?:[1-9]|1\d|20)$/.test(n))){
    const raw=input.advancements?.[level];if(!raw)continue;
    if(typeof raw!=='object'||!['','ability','feat'].includes(raw.mode)||!Array.isArray(raw.abilities)||raw.abilities.length>2||raw.abilities.some(a=>a!==''&&!ABILITIES.includes(a)))fail('Un choix de progression est invalide.');
    for(const key of ['featId','featAbility','notes'])if(typeof raw[key]!=='string'||raw[key].length>(key==='notes'?6000:150))fail('Un choix de progression est invalide.');
    const choices=featChoicesInitial();for(const key of ['skill','expertise','damageType','spell']){const value=raw.choices?.[key]??'';if(typeof value!=='string'||value.length>150)fail('Un choix de don est invalide.');choices[key]=value;}
    const rituals=raw.choices?.rituals??[];if(!Array.isArray(rituals)||rituals.length>2||rituals.some(v=>typeof v!=='string'||v.length>150))fail('Un choix de rituel est invalide.');choices.rituals=[...rituals];
    const resistances=raw.choices?.resistances??[];if(!Array.isArray(resistances)||resistances.length>2||resistances.some(v=>typeof v!=='string'||v.length>150))fail('Un choix de résistance est invalide.');choices.resistances=[...resistances];
    out.advancements[level]={mode:raw.mode,abilities:[...raw.abilities],featId:raw.featId,featAbility:raw.featAbility,notes:raw.notes,choices};
  }
  out.originGrants={};for(const slot of ORIGIN_SLOTS){
    const raw=input.originGrants?.[slot]??grantInitial(),grant=grantInitial();
    for(const key of ['magicList','spell']){if(typeof raw[key]!=='string'||raw[key].length>150)fail('Un choix de don est invalide.');grant[key]=raw[key];}
    for(const key of ['proficiencies','cantrips']){if(!Array.isArray(raw[key])||raw[key].length>(key==='cantrips'?2:3)||raw[key].some(v=>typeof v!=='string'||v.length>150))fail('Un choix de don est invalide.');grant[key]=[...new Set(raw[key])];}
    out.originGrants[slot]=grant;
  }
  out.classChoices={};for(const [key,values]of Object.entries(input.classChoices||{})){if(!/^[a-zA-Z][a-zA-Z0-9_]{0,60}$/.test(key)||!Array.isArray(values)||values.length>200||values.some(v=>typeof v!=='string'||!v.trim()||v.length>150))fail('Un choix de classe est invalide.');out.classChoices[key]=[...values];}
  out.details={};for(const key of Object.keys(detailFields)){const value=input.details?.[key];if(value===undefined)continue;if(typeof value!=='string'||value.length>6000)fail('Un texte du personnage est trop long.');out.details[key]=value;}
  for(const [key,list]of [['classId',catalogue.classes],['speciesId',catalogue.species],['backgroundId',catalogue.backgrounds],['subclassId',catalogue.subclasses],['originFeatId',catalogue.feats]])if(out[key]&&!list.some(v=>v.id===out[key]))fail('Un choix ne figure plus dans le catalogue.');
  const issues=[...originErrors(out,catalogue),...aptitudeErrors(out,catalogue),...spellErrors(out,catalogue)];
  if(!out.classId)issues.push('Classe à choisir.');
  if(ABILITIES.some(key=>out.scores[key]===null))issues.push('Caractéristiques à compléter.');
  const bg=catalogue.backgrounds.find(b=>b.id===out.backgroundId),cls=catalogue.classes.find(c=>c.id===out.classId);
  if(Object.values(backgroundBonuses(out,bg)).reduce((sum,n)=>sum+n,0)!==3)issues.push('Bonus d’historique à répartir.');
  if(!cls?.equipment?.some(e=>e.choix===out.equipment))issues.push('Équipement de classe à choisir.');
  if(out.statsMethod!=='physical'&&ABILITIES.every(key=>out.scores[key]!==null)){
    const values=out.statsMethod==='standard'?[15,14,13,12,10,8]:out.rolls.map(r=>r.reduce((a,b)=>a+b,0)-Math.min(...r));
    if(values.slice().sort((a,b)=>a-b).join(',')!==ABILITIES.map(key=>out.scores[key]).sort((a,b)=>a-b).join(','))issues.push('Répartition des résultats à vérifier.');
  }
  if(!classProfile(out,catalogue))issues.push('Parcours de classe encore en cours de construction.');
  return {character:out,status:issues.length?'draft':'ready',issues:[...new Set(issues)]};
}
