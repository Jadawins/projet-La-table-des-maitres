// Optional session state. Calculated character rules are never changed here.
const LIMIT=100000;
const fault=message=>{const error=new Error(message);error.status=400;return error;};
const integer=(value,min=0,max=LIMIT)=>Number.isInteger(value)&&value>=min&&value<=max;
const slug=name=>name.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export function validatePlayState(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1||!integer(raw.hpLost)||!integer(raw.tempHp))throw fault('Le suivi des points de vie est invalide.');
  if(!raw.used||typeof raw.used!=='object'||Array.isArray(raw.used)||Object.keys(raw.used).length>100)throw fault('Le suivi des ressources est invalide.');
  const used={};
  for(const [key,value]of Object.entries(raw.used)){
    if(!/^[a-z0-9][a-z0-9-]{0,90}$/.test(key)||!integer(value))throw fault('Une ressource du suivi est invalide.');
    used[key]=value;
  }
  const result={version:1,hpLost:raw.hpLost,tempHp:raw.tempHp,used};
  if(raw.slotUsed!==undefined){
    if(!raw.slotUsed||typeof raw.slotUsed!=='object'||Array.isArray(raw.slotUsed)||Object.keys(raw.slotUsed).length>10)throw fault('Le suivi des emplacements est invalide.');
    result.slotUsed={};
    for(const [key,value]of Object.entries(raw.slotUsed)){
      if(!/^(?:spell-[1-9]|pact)$/.test(key)||!integer(value))throw fault('Un emplacement suivi est invalide.');
      result.slotUsed[key]=value;
    }
  }
  if(raw.hitDiceUsed!==undefined){if(!integer(raw.hitDiceUsed))throw fault('Le suivi des dés de vie est invalide.');result.hitDiceUsed=raw.hitDiceUsed;}
  if(raw.lastRest!==undefined){
    if(!raw.lastRest||!['short','long'].includes(raw.lastRest.kind)||typeof raw.lastRest.at!=='string'||!Number.isFinite(Date.parse(raw.lastRest.at))||new Date(raw.lastRest.at).toISOString()!==raw.lastRest.at)throw fault('Le dernier repos est invalide.');
    result.lastRest={kind:raw.lastRest.kind,at:raw.lastRest.at};
  }
  return result;
}

// Only real expendable reserves are listed. A damage die, DC, range or bonus
// displayed among class resources must never become a spendable counter.
const reserves={
  barbare:[['Rage','rage']],
  barde:[['Élan artistique','inspiration','ability','Inspiration bardique']],
  druide:[['Forme animale','wild-shape']],
  ensorceleur:[['Magie innée','innate-magic'],['Points de sorcellerie','sorcery']],
  guerrier:[['Souffle vital','second-wind'],['Élan guerrier','action-surge'],['Inflexible','indomitable']],
  magicien:[['Récupération magique','arcane-recovery','once']],
  moine:[['Énergie martiale','focus'],['Récupération martiale','uncanny-metabolism']],
  occultiste:[['Astuce mystique','magical-cunning','once']],
  paladin:[['Toucher guérisseur','lay-on-hands'],['Châtiment divin','divine-smite'],['Canalisation divine','channel-divinity']],
  rodeur:[['Proie jurée','favored-enemy']],
};
// Reviewed recovery policies; never infer recharge from a prose description.
const longOnly=new Set(['innate-magic','sorcery','indomitable','arcane-recovery','uncanny-metabolism','magical-cunning','lay-on-hands','divine-smite','favored-enemy',
  'quota-couronne-de-lumiere','quota-rayon-tracant-gratuit','quota-presage-cosmique','quota-pas-de-lune','quota-retablissement-de-l-equilibre','quota-deluge-de-guerison-et-de-blessure','quota-pas-feeriques','quota-chance-du-tenebreux','quota-defense-glorieuse','quota-resistance-primitive-utilisations','quota-manteau-naturel','quota-frappe-redoutable','quota-vagabond-brumeux']);
export function resourceRecovery(id,state){
  if(['rage','wild-shape','second-wind','channel-divinity'].includes(id))return {short:1,long:'all'};
  if(['action-surge','focus','quota-pretre-de-la-guerre'].includes(id))return {short:'all',long:'all'};
  if(id==='inspiration')return {short:state.level>=5?'all':0,long:'all'};
  if(id==='quota-flash-protecteur')return {short:state.level>=6?'all':0,long:'all'};
  return longOnly.has(id)?{short:0,long:'all'}:null;
}
export function playResources(state,model){
  const result=[],seen=new Set();
  function add(id,label,max,details){
    if(!integer(max,1))return;
    result.push({id,label,max,details:details||'',recovery:resourceRecovery(id,state)});seen.add(label);
  }
  for(const [name,id,kind,label]of reserves[state.classId]||[]){
    const row=model.classResources.find(r=>r.nom===name);if(!row)continue;
    const max=kind==='once'?1:kind==='ability'?(Number.isInteger(model.mods[row.ability])?Math.max(row.minimum||1,model.mods[row.ability]):null):row.valeur;
    add(id,label||name,max,row.details);seen.add(name);
  }
  if(state.classId==='clerc')add('channel-divinity','Canal divin',model.channel,'Dépenses communes aux effets de Canal divin. La récupération reste manuelle.');
  for(const row of model.classResources){
    if(row.kind!=='quota'||seen.has(row.nom)||!Number.isInteger(model.mods[row.ability]))continue;
    add('quota-'+slug(row.nom),row.nom,Math.max(row.minimum||0,model.mods[row.ability]),row.details);
  }
  return result;
}

export function playView(state,model){
  const stored=state.playState===undefined?null:validatePlayState(state.playState);
  const maxHp=integer(model.hp,1)?model.hp:null;
  const hitDiceMax=integer(state.level,1,20)?state.level:0;
  const slots=Object.entries(model.slots||{}).filter(([rank,max])=>/^[1-9]$/.test(rank)&&integer(max,1)).map(([rank,max])=>{
    const pact=state.classId==='occultiste',id=pact?'pact':'spell-'+rank,used=stored?.slotUsed?.[id]||0;
    return {id,rank:Number(rank),max,used,remaining:Math.max(0,max-used),pact};
  });
  return {
    started:Boolean(stored),maxHp,
    currentHp:stored&&maxHp!==null?Math.max(0,maxHp-stored.hpLost):null,
    tempHp:stored?.tempHp??0,
    slots,hitDice:{max:hitDiceMax,used:stored?.hitDiceUsed||0,remaining:Math.max(0,hitDiceMax-(stored?.hitDiceUsed||0)),die:model.base?.de_vie?.type||'—'},
    lastRest:stored?.lastRest||null,
    resources:playResources(state,model).map(r=>({...r,used:stored?.used[r.id]||0,remaining:Math.max(0,r.max-(stored?.used[r.id]||0))})),
  };
}

export function applyPlayAction(state,model,action){
  const view=playView(state,model);
  if(view.maxHp===null)throw fault('Complétez les points de vie maximum avant de commencer le suivi.');
  if(action.type==='start'){
    if(view.started)throw fault('Le suivi est déjà commencé.');
    if(!integer(action.currentHp,0,view.maxHp))throw fault('Les PV actuels doivent être compris entre zéro et le maximum.');
    return {version:1,hpLost:view.maxHp-action.currentHp,tempHp:0,used:{},slotUsed:{},hitDiceUsed:0};
  }
  if(!view.started)throw fault('Commencez le suivi avant de modifier les compteurs.');
  if(['short-rest','long-rest'].includes(action.type)){
    if(action.confirmed!==true)throw fault('Confirmez le repos et les récupérations avant de les appliquer.');
    const next=restOutcome(state,model,action);
    next.lastRest={kind:action.type==='short-rest'?'short':'long',at:new Date().toISOString()};
    return next;
  }
  const next=validatePlayState(state.playState);
  const amount=action.amount;
  if(!integer(amount,['set-current','set-temp','set-hit-dice-used'].includes(action.type)?0:1))throw fault('Saisissez un nombre entier valide.');
  if(action.type==='damage'){
    const absorbed=Math.min(next.tempHp,amount);next.tempHp-=absorbed;
    next.hpLost=view.maxHp-Math.max(0,view.currentHp-(amount-absorbed));
  }else if(action.type==='heal')next.hpLost=view.maxHp-Math.min(view.maxHp,view.currentHp+amount);
  else if(action.type==='set-current'){
    if(amount>view.maxHp)throw fault('Les PV actuels ne peuvent pas dépasser le maximum.');
    next.hpLost=view.maxHp-amount;
  }else if(action.type==='set-temp')next.tempHp=amount;
  else if(action.type==='set-hit-dice-used'){
    if(amount>view.hitDice.max)throw fault('La dépense ne peut pas dépasser le nombre de dés de vie de la fiche.');
    next.hitDiceUsed=amount;
  }else if(['spend-slot','restore-slot'].includes(action.type)){
    const slot=view.slots.find(s=>s.id===action.slot);
    if(!slot)throw fault('Cet emplacement n’est pas disponible sur la fiche.');
    if(action.type==='spend-slot'&&amount>slot.remaining)throw fault('Il ne reste pas assez d’emplacements de ce niveau.');
    if(action.type==='restore-slot'&&amount>slot.used)throw fault('Vous ne pouvez pas rendre plus d’emplacements que vous en avez dépensés.');
    next.slotUsed||={};next.slotUsed[slot.id]=slot.used+(action.type==='spend-slot'?amount:-amount);
  }
  else if(['spend','restore'].includes(action.type)){
    const resource=view.resources.find(r=>r.id===action.resource);
    if(!resource)throw fault('Cette ressource n’est pas disponible sur la fiche.');
    if(action.type==='spend'&&amount>resource.remaining)throw fault('Il ne reste pas assez de cette ressource.');
    if(action.type==='restore'&&amount>resource.used)throw fault('Vous ne pouvez pas rendre plus que ce qui a été dépensé.');
    next.used[resource.id]=resource.used+(action.type==='spend'?amount:-amount);
  }else throw fault('Action de suivi inconnue.');
  return next;
}

function restOutcome(state,model,action){
  const view=playView(state,model);
  if(!view.started||view.maxHp===null||view.currentHp<1)throw fault('Le suivi doit être commencé avec au moins 1 PV pour prendre ce repos.');
  const short=action.type==='short-rest';
  if(!short&&action.type!=='long-rest')throw fault('Repos inconnu.');
  const next=validatePlayState(state.playState);
  if(short){
    const count=action.hitDice,healing=action.healing;
    if(!integer(count,0,view.hitDice.remaining)||!integer(healing)||count===0&&healing!==0||count>0&&healing<count)throw fault('Indiquez les dés de vie disponibles dépensés et le total de leurs soins : au moins 1 PV par dé, ou zéro sans dé.');
    next.hitDiceUsed=(next.hitDiceUsed||0)+count;
    next.hpLost=view.maxHp-Math.min(view.maxHp,view.currentHp+healing);
  }else{next.hpLost=0;next.tempHp=0;next.hitDiceUsed=0;}
  for(const resource of view.resources){
    const recovery=resource.recovery?.[short?'short':'long'];
    if(recovery==='all')next.used[resource.id]=0;
    else if(integer(recovery,1))next.used[resource.id]=Math.max(0,resource.used-recovery);
  }
  for(const slot of view.slots)if(!short||slot.pact){next.slotUsed||={};next.slotUsed[slot.id]=0;}
  return next;
}

export function restPreview(state,model,action){
  const before=playView(state,model),next=restOutcome(state,model,action),after=playView({...state,playState:next},model);
  const lines=[`PV : ${before.currentHp} → ${after.currentHp} / ${before.maxHp}`,`PV temporaires : ${before.tempHp} → ${after.tempHp}`,`Dés de vie disponibles : ${before.hitDice.remaining} → ${after.hitDice.remaining} / ${before.hitDice.max}`];
  for(const slot of after.slots){const old=before.slots.find(s=>s.id===slot.id);lines.push(`${slot.pact?'Pacte':'Emplacements'} · niveau ${slot.rank} : ${old.remaining} → ${slot.remaining} / ${slot.max}`);}
  for(const resource of after.resources){const old=before.resources.find(r=>r.id===resource.id);if(old.remaining!==resource.remaining)lines.push(`${resource.label} : ${old.remaining} → ${resource.remaining} / ${resource.max}`);}
  const manual=after.resources.filter(r=>!r.recovery).map(r=>r.label);
  if(manual.length)lines.push('Récupération à vérifier manuellement : '+manual.join(', '));
  return lines;
}
