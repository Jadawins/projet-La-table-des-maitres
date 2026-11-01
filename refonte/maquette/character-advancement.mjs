import {characterSnapshot,validateSavedCharacter} from './character-storage.mjs';
import {sheetModel} from './sheet-model.mjs';
import {classProfile} from './character-rules.mjs';
import {classRecord,classRecords,classSequence,CLASS_FIELDS,multiclassPrerequisites,multiclassCatalogue,projectMulticlass} from './multiclass-rules.mjs';

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fault=message=>{const error=new Error(message);error.status=400;return error;};
export function beginAdvancement(state,c,targetClassId=state.classId){
  const saved=validateSavedCharacter(state,c);
  if(saved.status!=='ready')throw fault('Complétez et vérifiez la fiche avant de monter de niveau.');
  if(state.level>=20)throw fault('Le niveau 20 est le maximum de cette version.');
  if(!c.classes.some(row=>row.id===targetClassId))throw fault('Choisissez une classe disponible.');
  const base=characterSnapshot(state);
  if(state.multiclass||targetClassId!==state.classId){
    const errors=multiclassPrerequisites(state,c,targetClassId);if(errors.length)throw fault(errors[0]);
    const previous=classRecords(base).find(row=>row.classId===targetClassId);
    const fresh={...base,classId:targetClassId,level:1,subclassId:'',divineOrder:'',sacredStrike:'',classSkills:[],cantrips:[],prepared:[],hpMode:'fixed',hpRolls:{},advancements:{},classChoices:{},originGrants:{background:base.originGrants.background,human:base.originGrants.human}};
    const candidate=previous?{...base,...structuredClone(previous),level:previous.level+1}:fresh;
    delete candidate.multiclass;delete candidate.playState;candidate.step=4;
    delete candidate.hpRolls[candidate.level];delete candidate.advancements[candidate.level];
    return {base,candidate};
  }
  const candidate=structuredClone(base);
  candidate.level++;candidate.step=4;
  delete candidate.hpRolls[candidate.level];delete candidate.advancements[candidate.level];
  return {base,candidate};
}
export function advancementClassBase(base,candidate){return classRecords(base).find(row=>row.classId===candidate.classId)||{level:0};}
export function composeAdvancement(base,candidate){
  if(!base.multiclass&&base.classId===candidate.classId)return characterSnapshot(candidate);
  const rows=structuredClone(classRecords(base)),row=classRecord(candidate),index=rows.findIndex(r=>r.classId===row.classId);
  if(index<0)rows.push(row);else rows[index]=row;
  const result=characterSnapshot(base);result.level=base.level+1;
  for(const key of CLASS_FIELDS)result[key]=structuredClone(rows[0][key]);
  result.multiclass={version:1,classes:rows,sequence:[...classSequence(base),candidate.classId],armorClassSource:base.multiclass?.armorClassSource||base.classId};
  return result;
}
export function advancementContext(base,candidate,c){
  const combined=composeAdvancement(base,candidate);
  if(!combined.multiclass)return {candidate,catalogue:c};
  const projected=projectMulticlass(combined,c,candidate.classId);
  return {candidate:{...candidate,...Object.fromEntries(Object.entries(projected).filter(([key])=>key.startsWith('_')))},catalogue:multiclassCatalogue(c,combined,candidate.classId)};
}
function replacementErrors(base,candidate,c){
  const previous=advancementClassBase(base,candidate);if(!previous.level)return [];
  const errors=[],profile=classProfile(candidate,c),automatic=new Set((profile?.always||[]).map(s=>s.id));
  if((previous.classChoices?.spellbook||[]).some(id=>!candidate.classChoices?.spellbook?.includes(id)))errors.push('Les sorts déjà inscrits dans votre grimoire doivent être conservés.');
  if((previous.cantrips||[]).filter(id=>!candidate.cantrips.includes(id)).length>1)errors.push('Vous ne pouvez remplacer qu’un sort mineur pendant cette montée de niveau.');
  if(['barde','ensorceleur','occultiste','rodeur','guerrier','roublard'].includes(candidate.classId)&&(previous.prepared||[]).filter(id=>!candidate.prepared.includes(id)&&!automatic.has(id)).length>1)errors.push('Vous ne pouvez remplacer qu’un sort préparé précédent pendant cette montée de niveau.');
  return errors;
}
export function advancementErrors(base,candidate,c){
  if(base.multiclass||base.classId!==candidate.classId){
    const previous=advancementClassBase(base,candidate),errors=[];
    if(candidate.level!==previous.level+1)errors.push('Ajoutez exactement un niveau dans la classe choisie.');
    if(previous.subclassId&&candidate.subclassId!==previous.subclassId)errors.push('La sous-classe précédente doit être conservée.');
    for(const key of ['divineOrder','sacredStrike'])if(previous[key]&&candidate[key]!==previous[key])errors.push('Un choix de classe antérieur a changé.');
    if(previous.level&&!same(previous.classSkills,candidate.classSkills))errors.push('Les compétences de départ doivent être conservées.');
    if(previous.level&&candidate.hpMode!==previous.hpMode)errors.push('La méthode des PV précédents doit être conservée.');
    for(const key of ['advancements','hpRolls'])for(const [level,value]of Object.entries(previous[key]||{}))if(+level<=previous.level&&!same(value,candidate[key]?.[level]))errors.push('Un choix antérieur a changé.');
    for(const key of ['name','speciesId','backgroundId','scores','statsMethod','rolls','equipment','backgroundEquipment','backgroundKit','bonusMode','bonusTwo','bonusOne','details'])if(!same(base[key],candidate[key]))errors.push('Une donnée d’origine a changé : '+key+'.');
    return [...new Set(errors.concat(replacementErrors(base,candidate,c),validateSavedCharacter(composeAdvancement(base,candidate),c).issues))];
  }
  if(candidate.level!==base.level+1||candidate.level>20)return ['La progression doit ajouter exactement un niveau.'];
  const mutable=new Set(['level','step','classChoices','cantrips','prepared','subclassId','sacredStrike','advancements','hpRolls','originGrants']);
  const errors=[];
  for(const [key,value]of Object.entries(characterSnapshot(base)))if(!mutable.has(key)&&!same(value,characterSnapshot(candidate)[key]))errors.push('La montée de niveau doit conserver les données précédentes : '+key+'.');
  if(base.subclassId&&candidate.subclassId!==base.subclassId)errors.push('Votre sous-classe précédente doit être conservée.');
  if(base.sacredStrike&&candidate.sacredStrike!==base.sacredStrike)errors.push('Votre choix précédent de Frappe consacrée doit être conservé.');
  for(const key of ['advancements','hpRolls'])for(const [level,value]of Object.entries(base[key]||{}))if(+level<=base.level&&!same(value,candidate[key]?.[level]))errors.push('Un choix antérieur du niveau '+level+' a changé.');
  for(const [slot,value]of Object.entries(base.originGrants||{}))if(!slot.startsWith('invocation')&&slot!=='level'+candidate.level&&!same(value,candidate.originGrants?.[slot]))errors.push('Un choix de don antérieur a changé.');
  return [...new Set(errors.concat(replacementErrors(base,candidate,c),validateSavedCharacter(candidate,c).issues))];
}
export function advancementPreview(base,candidate,c){
  const before=sheetModel(base,c),after=sheetModel(composeAdvancement(base,candidate),c);
  const oldFeatures=new Set([...before.classFeatures,...before.subclassFeatures].map(f=>f.source+'|'+f.nom));
  const newFeatures=[...after.classFeatures,...after.subclassFeatures].filter(f=>!oldFeatures.has(f.source+'|'+f.nom));
  const previous=advancementClassBase(base,candidate);
  const oldProfile=previous.level?classProfile({...base,...previous,multiclass:undefined},c):null,newProfile=classProfile(candidate,c);
  return {before,after,newFeatures,cantrips:[oldProfile?.cantripCount||0,newProfile?.cantripCount||0],prepared:[oldProfile?.preparedCount||0,newProfile?.preparedCount||0]};
}
export function finishAdvancement(base,candidate,c,hpPolicy='preserve'){
  const errors=advancementErrors(base,candidate,c);if(errors.length)throw fault(errors[0]);
  if(!['preserve','increase'].includes(hpPolicy))throw fault('Choisissez comment ajuster vos PV actuels.');
  const result=composeAdvancement(base,candidate),oldHp=sheetModel(base,c).hp,newHp=sheetModel(result,c).hp;
  if(base.playState){
    const dead=base.playState.deathSaves?.dead||base.playState.exhaustion===6;
    const current=Math.max(0,oldHp-base.playState.hpLost);
    const target=dead||current===0?0:Math.min(newHp,current+(hpPolicy==='increase'?newHp-oldHp:0));
    result.playState={...structuredClone(base.playState),hpLost:newHp-target};
  }
  result.step=7;
  return validateSavedCharacter(result,c).character;
}
