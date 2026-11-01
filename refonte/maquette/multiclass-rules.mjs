// New optional character format. Rules: frozen FR SRD 5.2.1 pp. 26–27,
// multiclass entries of each class, plus the frozen third-caster supplements.
import {ABILITIES,backgroundBonuses,modifier,finalScores,classProfile,normalize} from './character-rules.mjs';
import {evaluateProgression,selectedLevelFeats,classTraining} from './progression.mjs';
import {classChoiceEffects} from './class-profiles.mjs';
import {originSkills,originFeats} from './origin-rules.mjs';
import {classMagic} from './class-magic.mjs';
import {validatePlayState} from './play-state.mjs';
import {clearOnPositiveHp} from './condition-rules.mjs';

export const CLASS_FIELDS=['subclassId','divineOrder','classSkills','cantrips','prepared','hpMode','hpRolls','advancements','originGrants','classChoices','sacredStrike'];
export const MULTICLASS_REQUIREMENTS={barbare:[['FOR']],barde:[['CHA']],clerc:[['SAG']],druide:[['SAG']],ensorceleur:[['CHA']],guerrier:[['FOR','DEX']],magicien:[['INT']],moine:[['DEX'],['SAG']],occultiste:[['CHA']],paladin:[['FOR'],['CHA']],rodeur:[['DEX'],['SAG']],roublard:[['DEX']]};
const arms=['armures_legeres','armures_intermediaires','boucliers'];
export const MULTICLASS_TRAINING={
  barbare:{armors:['boucliers'],weapons:['armes_de_guerre']},barde:{armors:['armures_legeres'],skill:1,instruments:1},
  clerc:{armors:arms},druide:{armors:['armures_legeres','boucliers']},ensorceleur:{},guerrier:{armors:arms,weapons:['armes_de_guerre']},
  magicien:{},moine:{},occultiste:{armors:['armures_legeres']},paladin:{armors:arms,weapons:['armes_de_guerre']},
  rodeur:{armors:arms,weapons:['armes_de_guerre'],skill:1},roublard:{armors:['armures_legeres'],skill:1,tools:['outils_de_voleur']},
};
const fail=message=>{const error=new Error(message);error.status=400;throw error;};
const unique=values=>[...new Set(values.filter(Boolean))];
export const isMulticlass=state=>Boolean(state.multiclass);
export function classRecord(state){return Object.fromEntries(['classId','level',...CLASS_FIELDS].map(key=>[key,structuredClone(state[key]??({classSkills:[],cantrips:[],prepared:[],hpRolls:{},advancements:{},originGrants:{},classChoices:{}}[key]??''))]));}
export function classRecords(state){return state.multiclass?.classes||[classRecord(state)];}
export const classSequence=state=>state.multiclass?.sequence||Array(state.level).fill(state.classId);
export function multiclassCatalogue(c,state,id){
  const secondary=id!==state.classId;
  if(!secondary)return c;
  const policy=MULTICLASS_TRAINING[id];if(!policy)fail('Classe de multiclassage inconnue.');
  return {...c,classes:c.classes.map(cls=>cls.id!==id?cls:{...cls,niveaux:{...cls.niveaux,0:{...cls.niveaux[0],sauvegardes_maitrise:[],maitrises_armures:policy.armors||[],maitrises_armes:policy.weapons||[],maitrises_outils:policy.tools||[],competences_choisies:{...cls.niveaux[0].competences_choisies,nombre:policy.skill||0}}}})};
}
export function rawClassState(state,id){
  const row=classRecords(state).find(r=>r.classId===id);if(!row)fail('Cette classe ne figure pas sur la fiche.');
  const result={...structuredClone(state),...structuredClone(row)};delete result.multiclass;delete result.playState;delete result.advancementDraft;
  return result;
}
export function multiclassProgression(state,c,through=state.level){
  const bg=c.backgrounds.find(b=>b.id===state.backgroundId),bonuses=backgroundBonuses(state,bg);
  let scores=Object.fromEntries(ABILITIES.map(a=>[a,Number.isInteger(state.scores[a])?Math.min(20,state.scores[a]+bonuses[a]):null]));
  const levels={},rows=[],issues=[],taken=[];
  for(const [index,id]of classSequence(state).slice(0,through).entries()){
    const level=levels[id]=(levels[id]||0)+1;
    const own={...rawClassState(state,id),level,_characterLevel:index+1,_priorFeatIds:[...taken]};
    const others=Object.entries(levels).filter(([other])=>other!==id).map(([other,n])=>({...rawClassState(state,other),level:n}));
    own._otherTraining={armors:unique(others.flatMap(other=>classTraining(other,multiclassCatalogue(c,state,other.classId)).armors)),weapons:unique(others.flatMap(other=>classTraining(other,multiclassCatalogue(c,state,other.classId)).weapons))};
    own._hasSpellcasting=[own,...others].some(s=>s.classId!=='occultiste'&&classMagic(s,c).enabled);
    own._hasPactMagic=[own,...others].some(s=>s.classId==='occultiste');
    const result=evaluateProgression(own,multiclassCatalogue(c,state,id),scores,level,level);
    scores=result.scores;issues.push(...result.issues.map(e=>c.classes.find(x=>x.id===id).nom+' : '+e));
    for(const row of result.rows){rows.push({...row,classId:id,characterLevel:index+1});if(row.feat)taken.push(row.feat.id);}
  }
  return {scores,rows,issues};
}
export function multiclassPrerequisites(state,c,target,through=state.level){
  const scores=isMulticlass(state)?multiclassProgression(state,c,through).scores:finalScores(state,c.backgrounds.find(b=>b.id===state.backgroundId),c);
  const ids=unique([...classSequence(state).slice(0,through),target]);
  return ids.flatMap(id=>(MULTICLASS_REQUIREMENTS[id]||[]).filter(group=>!group.some(a=>Number.isFinite(scores[a])&&scores[a]>=13)).map(group=>(c.classes.find(x=>x.id===id)?.nom||id)+' : '+group.join(' ou ')+' 13 requis.'));
}
export function multiclassHitDice(state,c){
  const groups={};for(const row of classRecords(state)){const die=c.classes.find(x=>x.id===row.classId)?.niveaux[0]?.de_vie?.type;if(die)groups[die]=(groups[die]||0)+row.level;}
  return Object.entries(groups).map(([die,max])=>({die,max}));
}
export function multiclassHitPoints(state,c,scores=multiclassProgression(state,c).scores){
  const con=modifier(scores.CON);if(con===null)return null;
  const counts={};let hp=0;
  for(const [index,id]of classSequence(state).entries()){
    const row=classRecords(state).find(r=>r.classId===id),level=counts[id]=(counts[id]||0)+1;
    const die=Number(c.classes.find(x=>x.id===id)?.niveaux[0]?.de_vie?.type?.match(/d(\d+)/)?.[1]);
    const value=index===0?die:row.hpMode==='fixed'?Math.floor(die/2)+1:row.hpRolls[level];
    if(!Number.isInteger(value)||value<1||value>die)return null;hp+=Math.max(1,value+con);
  }
  const origins=classRecords(state).flatMap(row=>originFeats(rawClassState(state,row.classId),c));
  const feats=multiclassProgression(state,c).rows.filter(row=>row.feat).map(row=>row.feat.id);
  if(origins.some(g=>g.feat?.id==='robuste')||feats.includes('robuste'))hp+=2*state.level;
  if(c.species.find(x=>x.id===state.speciesId)?.traits?.some(t=>t.id==='tenacite_naine'))hp+=state.level;
  const dragon=classRecords(state).find(r=>r.subclassId==='ensorceleur_sorcellerie_draconique'&&r.level>=3);if(dragon)hp+=dragon.level;
  if(feats.includes('faveur_de_vigueur'))hp+=40;
  return hp;
}
export function multiclassSlots(state,c){
  const casters=classRecords(state).map(row=>({row,magic:classMagic(rawClassState(state,row.classId),c)})).filter(x=>x.magic.enabled&&x.row.classId!=='occultiste');
  let level=0;
  for(const {row}of casters)level+=['paladin','rodeur'].includes(row.classId)?Math.ceil(row.level/2):['guerrier','roublard'].includes(row.classId)?Math.floor(row.level/3):row.level;
  const slots=casters.length===1?casters[0].magic.row.emplacements_de_sort||{}:casters.length?c.classes.find(x=>x.id==='clerc').niveaux[Math.min(20,level)].emplacements_de_sort:{};
  const warlock=classRecords(state).find(r=>r.classId==='occultiste');
  const pact=warlock?classMagic(rawClassState(state,'occultiste'),c).row.emplacements_de_sort:{};
  return {slots,pactSlots:pact||{},casterLevel:level};
}
export function projectMulticlass(state,c,id){
  const result=rawClassState(state,id),progression=multiclassProgression(state,c);
  const others=classRecords(state).filter(row=>row.classId!==id).map(row=>rawClassState(state,row.classId));
  result._characterLevel=state.level;result._secondaryClass=id!==state.classId;
  result._multiclassScores=progression.scores;result._multiclassHp=multiclassHitPoints(state,c,progression.scores);
  result._multiclassProgression={...progression,rows:progression.rows.filter(row=>row.classId===id)};
  result._allLevelFeats=progression.rows.filter(row=>row.feat).map(row=>({level:row.level,feat:row.feat,choice:row.choice,classId:row.classId,characterLevel:row.characterLevel}));
  result._extraSkills=unique(others.flatMap(other=>[...(other.classSkills||[]),...originSkills(other,multiclassCatalogue(c,state,other.classId)),...classChoiceEffects(other,multiclassCatalogue(c,state,other.classId)).skills]));
  result._extraOriginFeatIds=unique(others.flatMap(other=>originFeats(other,c).map(g=>g.feat?.id)));
  result._otherTraining={armors:unique(others.flatMap(other=>classTraining(other,multiclassCatalogue(c,state,other.classId)).armors)),weapons:unique(others.flatMap(other=>classTraining(other,multiclassCatalogue(c,state,other.classId)).weapons))};
  result._allStyles=unique(others.flatMap(other=>[...(other.classChoices?.combatStyle||[]),...(other.classChoices?.combatStyle10||[])]));
  result._startingEquipment={classId:state.classId,equipment:state.equipment};
  if(id==='magicien'&&result.level>=2){
    // Count only Wizard occurrences, then reconstruct the other classes that
    // existed when Scholar was gained; later skills cannot create a new duty.
    let wizardLevels=0,at=0;for(const [index,classId]of classSequence(state).entries())if(classId===id&&++wizardLevels===2){at=index;break;}
    const counts={};for(const classId of classSequence(state).slice(0,at+1))counts[classId]=(counts[classId]||0)+1;
    result._scholarOtherSkills=unique(Object.entries(counts).filter(([other])=>other!==id).flatMap(([other,level])=>{
      const previous={...rawClassState(state,other),level},view=multiclassCatalogue(c,state,other);
      return [...(previous.classSkills||[]),...originSkills(previous,view),...classChoiceEffects(previous,view).skills];
    }));
  }
  result._hasSpellcasting=classRecords(state).some(row=>row.classId!=='occultiste'&&classMagic(rawClassState(state,row.classId),c).enabled);
  result._hasPactMagic=classRecords(state).some(row=>row.classId==='occultiste');
  return result;
}
export function validateMulticlass(input,c,validateSingle){
  const mc=input.multiclass;
  if(!mc||mc.version!==1||!Array.isArray(mc.sequence)||mc.sequence.length!==input.level||input.level<2||input.level>20||!Array.isArray(mc.classes)||mc.classes.length<2||mc.classes.length>12)fail('La répartition multiclassée est invalide.');
  const ids=mc.classes.map(row=>row?.classId);
  if(new Set(ids).size!==ids.length||ids[0]!==input.classId||mc.sequence[0]!==input.classId||ids.some(id=>typeof id!=='string'||!Object.hasOwn(MULTICLASS_REQUIREMENTS,id)||!c.classes.some(cls=>cls.id===id))||mc.sequence.some(id=>!ids.includes(id)))fail('Les classes et leur ordre sont invalides.');
  if(mc.armorClassSource&&!ids.includes(mc.armorClassSource))fail('La méthode de classe d’armure est invalide.');
  for(const row of mc.classes){if(row.level!==mc.sequence.filter(id=>id===row.classId).length||!Number.isInteger(row.level)||row.level<1)fail('Les niveaux de classe ne correspondent pas au total.');}
  const clean={...input,multiclass:{version:1,sequence:[...mc.sequence],classes:mc.classes.map(classRecord),armorClassSource:mc.armorClassSource||input.classId}};
  const results=[];
  for(const row of clean.multiclass.classes){
    const projected=projectMulticlass(clean,c,row.classId);
    const context=Object.fromEntries(Object.entries(projected).filter(([key])=>key.startsWith('_')));
    const result=validateSingle(projected,multiclassCatalogue(c,clean,row.classId),context);results.push(result);
    Object.assign(row,classRecord(result.character));
  }
  const first=results[0].character;
  for(const key of CLASS_FIELDS)clean[key]=structuredClone(first[key]);
  const issues=results.flatMap((result,index)=>result.issues.map(message=>c.classes.find(x=>x.id===ids[index]).nom+' : '+message));
  const seen=new Set();for(const [index,id]of mc.sequence.entries()){if(!seen.has(id)&&seen.size)issues.push(...multiclassPrerequisites(clean,c,id,index));seen.add(id);}
  const duplicateFeats=multiclassProgression(clean,c).issues;issues.push(...duplicateFeats);
  const root={...first,level:input.level,multiclass:clean.multiclass};
  if(input.playState!==undefined)root.playState=clearOnPositiveHp(validatePlayState(input.playState),multiclassHitPoints(root,c));
  return {character:root,status:issues.length?'draft':'ready',issues:unique(issues)};
}
export function mergeMulticlassModels(state,c,modelFor){
  const items=classRecords(state).map(row=>({state:projectMulticlass(state,c,row.classId),catalogue:multiclassCatalogue(c,state,row.classId)}));
  const models=items.map(item=>modelFor(item.state,item.catalogue));
  const first=models[0],result={...first},slots=multiclassSlots(state,c);
  const flatten=key=>models.flatMap(m=>m[key]||[]);
  result.classModels=models.map((model,i)=>({state:items[i].state,model}));
  result.classLevels=classRecords(state).map(row=>({classId:row.classId,level:row.level,name:c.classes.find(x=>x.id===row.classId).nom}));
  result.cls={...first.cls,nom:result.classLevels.map(row=>row.name+' '+row.level).join(' / ')};
  result.subclass={nom:unique(models.map(m=>m.subclass?.nom)).join(' / ')};
  result.proficiency=2+Math.floor((state.level-1)/4);result.hp=multiclassHitPoints(state,c);result.hitDiceGroups=multiclassHitDice(state,c);
  result.slots=slots.slots;result.pactSlots=slots.pactSlots;result.casterLevel=slots.casterLevel;
  result.skills=first.skills.map(skill=>{
    const parts=models.map((m,index)=>({skill:m.skills.find(s=>normalize(s.nom)===normalize(skill.nom)),state:items[index].state})).filter(row=>row.skill);
    const trained=parts.some(row=>row.skill.trained),expertise=trained&&parts.some(row=>row.skill.expertise),mod=first.mods[skill.ability];
    const jack=items.some(item=>item.state.classId==='barde'&&item.state.level>=2);
    const extras=parts.reduce((sum,{skill:part,state:own})=>{
      const base=mod===null?null:mod+(part.trained?result.proficiency*(part.expertise?2:1):own.classId==='barde'&&own.level>=2?Math.floor(result.proficiency/2):0);
      return sum+(base===null||part.value===null?0:part.value-base);
    },0);
    return {...skill,trained,expertise,value:mod===null?null:mod+(trained?result.proficiency*(expertise?2:1):jack?Math.floor(result.proficiency/2):0)+extras};
  });
  result.saves=first.saves.map(save=>models.map(m=>m.saves.find(s=>s.ability===save.ability)).sort((a,b)=>(b.value??-100)-(a.value??-100))[0]);
  for(const key of ['classFeatures','subclassFeatures','classResources','levelFeats'])result[key]=flatten(key);
  for(const key of ['weaponTraining','armorTraining','tools','resistances','immunities'])result[key]=unique(flatten(key));
  result.attacksPerAction=Math.max(...models.map(m=>m.attacksPerAction));
  result.attacks=[];
  for(const attack of flatten('attacks')){
    const old=result.attacks.find(a=>a.nom===attack.nom);
    if(!old)result.attacks.push({...attack,featRules:[...(attack.featRules||[])]});
    else{const rules=unique([...(old.featRules||[]),...(attack.featRules||[])]),criticalFrom=Math.min(old.criticalFrom||20,attack.criticalFrom||20),botteActive=old.botteActive||attack.botteActive;
      const average=a=>{const dice=String(a.degats?.de).match(/^(\d+)d(\d+)$/);return dice?+dice[1]*(+dice[2]+1)/2:0;};
      const damage=average(attack)>average(old)?attack.degats:old.degats;
      if((attack.attack??-100)>(old.attack??-100))Object.assign(old,attack);
      old.degats=damage;old.criticalFrom=criticalFrom;old.botteActive=botteActive;old.featRules=rules;
    }
  }
  result.acOptions=models.map((m,index)=>({classId:items[index].state.classId,label:c.classes.find(x=>x.id===items[index].state.classId).nom,value:m.ac,note:m.acNote}));
  const ac=result.acOptions.find(row=>row.classId===state.multiclass.armorClassSource)||result.acOptions[0];result.ac=ac.value;result.acNote=ac.note;
  result.magicProfiles=models.map((m,i)=>({...m.magic,classId:items[i].state.classId,className:c.classes.find(x=>x.id===items[i].state.classId).nom})).filter(m=>m.ability);
  result.magic=result.magicProfiles[0]||first.magic;
  result.spells=[];for(const spell of flatten('spells'))if(!result.spells.some(s=>s.id===spell.id&&s.source===spell.source&&s.ability===spell.ability))result.spells.push(spell);
  result.progression=multiclassProgression(state,c);
  result.errors=unique(flatten('errors').concat(result.progression.issues));
  result.ruleNotices=unique(models.map(m=>m.ruleNotices)).join(' ');
  result.classEffects={...first.classEffects};
  for(const key of ['skills','expertise','tools','languages','masteries','forms','summaries'])result.classEffects[key]=models.flatMap(m=>m.classEffects[key]||[]);
  for(const key of ['companion','familiar','dragonForm'])result.classEffects[key]=models.find(m=>m.classEffects[key])?.classEffects[key];
  const baselineSpeed=(first.species?.vitesse||0)+first.effects.speedBonus;
  result.speed=baselineSpeed+models.reduce((sum,m)=>sum+Math.max(0,(m.speed||0)-baselineSpeed),0);
  for(const key of ['darkvision','blindvision','climb','swim'])result[key]=Math.max(0,...models.map(m=>Number(m[key])||0))||null;
  result.initiative=Math.max(...models.map(m=>m.initiative));
  result.passive=10+(result.skills.find(s=>normalize(s.nom)==='perception')?.value||0);
  result.channel=models.find(m=>m.channel)?.channel;result.sparkDice=models.find(m=>m.channel)?.sparkDice;
  result.sacredStrike=items.find(item=>item.state.classId==='clerc')?.state.sacredStrike||'';
  return result;
}
