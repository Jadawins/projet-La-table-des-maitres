import {createHash} from 'node:crypto';
import {parseDamage,throwDice,integer} from './attack-rules.mjs';

const fault=message=>Object.assign(new Error(message),{status:400});
export const abilities=['FOR','DEX','CON','INT','SAG','CHA'];
export const spellStamp=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key=s=>spellStamp([s.id,s.source,s.ability]).slice(0,24);

// Explicit, small suggestions, not a parser of rule prose. Everything else needs
// the MJ to read the canonical spell and declare the resolution plan.
const reviewed={
  soins:{effect:'heal',die:8,count:2,up:2,ability:true,maxTargets:1},
  mot_de_guerison:{effect:'heal',die:4,count:2,up:2,ability:true,maxTargets:1},
  boule_de_feu:{effect:'damage',die:6,count:8,up:1},
  mains_brulantes:{effect:'damage',die:6,count:3,up:1},
  vague_tonnante:{effect:'damage',die:8,count:2,up:1},
  rayon_tracant:{effect:'damage',die:6,count:4,up:1,maxTargets:1},
};

export function spellChoices(state,model,live){
  return (model.spells||[]).filter(s=>integer(s.niveau,0,9)).map(s=>({
    key:key(s),id:s.id,name:s.nom,level:s.niveau,source:s.source,ability:s.ability,dc:s.dc,attackBonus:s.attackBonus,
    description:s.description||'',higher:s.niveau_superieur||'',range:s.portee||'',duration:s.duree||'',
    castingTime:s.temps_incantation||'',components:s.composantes||{},concentration:Boolean(s.concentration),ritual:Boolean(s.rituel),zone:s.zone||null,
    save:abilities.includes(s.sauvegarde?.caracteristique)?{ability:s.sauvegarde.caracteristique,half:Boolean(s.sauvegarde.demi_si_reussi)}:null,
    attack:Boolean(s.attaque),usage:s.utilisation||'',notes:s.featRules||[],
    slots:s.niveau===0?[]:live.slots.filter(slot=>slot.rank>=s.niveau&&slot.remaining>0),
    suggestions:Object.fromEntries(Array.from({length:s.niveau===0?1:10-s.niveau},(_,i)=>{
      const rank=s.niveau===0?0:s.niveau+i;return [rank,suggestSpell(s,model,rank)];
    }))
  }));
}

export function suggestSpell(s,model,rank){
  const rule=reviewed[s.id],save=s.sauvegarde;
  let formula='',effect='note',reviewRequired=true;
  if(rule){
    const mod=rule.ability?model.mods?.[s.ability]:0;
    if(integer(mod,-20,30)){
      formula=(rule.count+rule.up*(rank-s.niveau))+'d'+rule.die+(mod>0?'+'+mod:mod<0?mod:'');effect=rule.effect;reviewRequired=false;
    }
  }else if(s.niveau===0&&Array.isArray(s.degats)&&s.degats.length===1&&/^\d+d\d+\s+[^·]+$/.test(s.damageAtLevel||'')&&!['glas','decharge_occulte'].includes(s.id)){
    formula=s.damageAtLevel.match(/^\d+d\d+/)[0];const bonus=s.cantripBonus??0;
    if(integer(bonus,-20,30)){formula+=bonus>0?'+'+bonus:bonus<0?bonus:'';effect='damage';reviewRequired=false;}
  }
  try{if(formula)parseDamage(formula);}catch{formula='';reviewRequired=true;effect='note';}
  return {kind:s.attaque?'attack':save?'save':'direct',effect,formula,damageType:s.degats?.[0]?.type||'',
    saveAbility:save?.caracteristique||'DEX',success:save?.demi_si_reussi?'half':'none',reviewRequired,
    maxTargets:rule?.maxTargets||null};
}

export function validateSpellPlan(input){
  if(!input||!['attack','save','direct'].includes(input.kind)||!['damage','heal','temp','condition','note'].includes(input.effect))throw fault('Choisissez une résolution et un effet.');
  const formula=typeof input.formula==='string'?input.formula.trim():'';
  if(['damage','heal','temp'].includes(input.effect))parseDamage(formula);
  if(input.kind==='save'&&!abilities.includes(input.saveAbility))throw fault('Choisissez la caractéristique de sauvegarde.');
  if(!['none','half','full'].includes(input.success))throw fault('Choisissez l’effet d’une sauvegarde réussie.');
  const note=typeof input.note==='string'?input.note.trim():'';
  if(note.length>2000)throw fault('Limitez le rappel à 2 000 caractères.');
  if(input.effect==='note'&&!note)throw fault('Décrivez l’effet à suivre.');
  if(!integer(input.rounds,0,10000))throw fault('Indiquez une durée de zéro à 10 000 rounds (zéro : suivi manuel).');
  const impacts=input.impacts===undefined?1:input.impacts;
  if(!integer(impacts,1,100))throw fault('Déclarez de un à cent impacts selon le sort.');
  if(input.sharedImpacts===true&&input.kind!=='direct')throw fault('Le partage du jet entre impacts est réservé à une résolution sans jet d’attaque.');
  const conditionOperation=input.conditionOperation||'add';if(!['add','remove'].includes(conditionOperation))throw fault('Choisissez l’application ou le retrait de l’état.');
  return {kind:input.kind,effect:input.effect,formula,damageType:String(input.damageType||'').slice(0,100),saveAbility:input.saveAbility,
    success:input.success,note,condition:input.condition||'',conditionOperation,conditionOnSuccess:input.conditionOnSuccess===true,releaseOnSuccess:input.releaseOnSuccess!==false,
    rounds:input.rounds,impacts,sharedImpacts:input.sharedImpacts===true};
}

export function savingThrow({mode,advantage='normal',dice,bonus,adjustment=0,penalty=0,dc},randomFace){
  if(!['normal','advantage','disadvantage'].includes(advantage)||!integer(bonus,-100,100)||!integer(adjustment,-100,100)||!integer(penalty,0,100)||!integer(dc,0,100))throw fault('Paramètres de sauvegarde invalides.');
  const rolls=throwDice(advantage==='normal'?[20]:[20,20],mode,dice,randomFace);
  const kept=advantage==='normal'?0:advantage==='advantage'?(rolls[0].value>=rolls[1].value?0:1):(rolls[0].value<=rolls[1].value?0:1);
  const total=rolls[kept].value+bonus+adjustment-penalty;
  return {mode,advantage,dice:rolls.map((d,i)=>({...d,kept:i===kept})),bonus,adjustment,penalty,total,dc,success:total>=dc};
}
