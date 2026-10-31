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
  return {version:1,hpLost:raw.hpLost,tempHp:raw.tempHp,used};
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
  occultiste:[['Astuce mystique','magical-cunning']],
  paladin:[['Toucher guérisseur','lay-on-hands'],['Châtiment divin','divine-smite'],['Canalisation divine','channel-divinity']],
  rodeur:[['Proie jurée','favored-enemy']],
};
export function playResources(state,model){
  const result=[],seen=new Set();
  function add(id,label,max,details){
    if(!integer(max,1))return;
    result.push({id,label,max,details:details||''});seen.add(label);
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
  return {
    started:Boolean(stored),maxHp,
    currentHp:stored&&maxHp!==null?Math.max(0,maxHp-stored.hpLost):null,
    tempHp:stored?.tempHp??0,
    resources:playResources(state,model).map(r=>({...r,used:stored?.used[r.id]||0,remaining:Math.max(0,r.max-(stored?.used[r.id]||0))})),
  };
}

export function applyPlayAction(state,model,action){
  const view=playView(state,model);
  if(view.maxHp===null)throw fault('Complétez les points de vie maximum avant de commencer le suivi.');
  if(action.type==='start'){
    if(view.started)throw fault('Le suivi est déjà commencé.');
    if(!integer(action.currentHp,0,view.maxHp))throw fault('Les PV actuels doivent être compris entre zéro et le maximum.');
    return {version:1,hpLost:view.maxHp-action.currentHp,tempHp:0,used:{}};
  }
  if(!view.started)throw fault('Commencez le suivi avant de modifier les compteurs.');
  const next=validatePlayState(state.playState);
  const amount=action.amount;
  if(!integer(amount,['set-current','set-temp'].includes(action.type)?0:1))throw fault('Saisissez un nombre entier valide.');
  if(action.type==='damage'){
    const absorbed=Math.min(next.tempHp,amount);next.tempHp-=absorbed;
    next.hpLost=view.maxHp-Math.max(0,view.currentHp-(amount-absorbed));
  }else if(action.type==='heal')next.hpLost=view.maxHp-Math.min(view.maxHp,view.currentHp+amount);
  else if(action.type==='set-current'){
    if(amount>view.maxHp)throw fault('Les PV actuels ne peuvent pas dépasser le maximum.');
    next.hpLost=view.maxHp-amount;
  }else if(action.type==='set-temp')next.tempHp=amount;
  else if(['spend','restore'].includes(action.type)){
    const resource=view.resources.find(r=>r.id===action.resource);
    if(!resource)throw fault('Cette ressource n’est pas disponible sur la fiche.');
    if(action.type==='spend'&&amount>resource.remaining)throw fault('Il ne reste pas assez de cette ressource.');
    if(action.type==='restore'&&amount>resource.used)throw fault('Vous ne pouvez pas rendre plus que ce qui a été dépensé.');
    next.used[resource.id]=resource.used+(action.type==='spend'?amount:-amount);
  }else throw fault('Action de suivi inconnue.');
  return next;
}
