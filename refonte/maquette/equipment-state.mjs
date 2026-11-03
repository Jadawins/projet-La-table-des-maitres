// Optional application state; the frozen creation catalogue is not rewritten.
const fault=message=>Object.assign(new Error(message),{status:400});
const key=value=>String(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const reference=value=>typeof value==='string'&&/^(?:start:[a-z0-9]{1,180}|item:[0-9a-f-]{36})$/.test(value);
export const itemCatalogueId=item=>item.id||key(item.nom);
export const POTIONS=Object.freeze([
  {id:'healing',nom:'Potion de guérison',count:2,sides:4,bonus:2},
  {id:'healing-greater',nom:'Potion de guérison (importante)',count:4,sides:4,bonus:4},
  {id:'healing-superior',nom:'Potion de guérison (supérieure)',count:8,sides:4,bonus:8},
  {id:'healing-supreme',nom:'Potion de guérison (suprême)',count:10,sides:4,bonus:20},
]);
// SRD 5.2.1 FR, p.254, table Potions de guérison (CC BY 4.0).
export const POTION_SOURCE='https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf#page=254';
export function validateEquipmentState(raw){
  if(!raw||raw.version!==1||typeof raw.armor!=='string'||typeof raw.shield!=='string'||!Array.isArray(raw.weapons)||raw.weapons.length>30||[raw.armor,raw.shield,...raw.weapons].some(r=>r!==''&&!reference(r))||raw.weapons.some(r=>!r)||new Set(raw.weapons).size!==raw.weapons.length)throw fault('L’équipement porté est invalide.');
  return {version:1,armor:raw.armor,shield:raw.shield,weapons:[...raw.weapons]};
}
export function validateSpent(raw){
  if(!raw||Array.isArray(raw)||typeof raw!=='object'||Object.keys(raw).length>100)throw fault('Le suivi du matériel de départ est invalide.');
  const out={};for(const [ref,n]of Object.entries(raw)){if(!reference(ref)||!ref.startsWith('start:')||!Number.isInteger(n)||n<1||n>9999)throw fault('Une quantité consommée est invalide.');out[ref]=n;}return out;
}
export function validateLastUse(raw){
  if(!raw||typeof raw.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.id)||typeof raw.name!=='string'||raw.name.length>120||!['manual','physical','app'].includes(raw.mode)||!Array.isArray(raw.dice)||raw.dice.length>10||raw.dice.some(n=>!Number.isInteger(n)||n<1||n>4)||!Number.isInteger(raw.healing)||raw.healing<0||raw.healing>60||typeof raw.at!=='string'||!Number.isFinite(Date.parse(raw.at)))throw fault('Le dernier objet utilisé est invalide.');
  return {id:raw.id,name:raw.name,mode:raw.mode,dice:[...raw.dice],healing:raw.healing,at:raw.at};
}
export function equipmentItems(state,starting,c){
  const rows=starting.map(i=>({...i,ref:'start:'+key(i.nom),quantity:Math.max(0,i.quantity-(state.inventorySpent?.['start:'+key(i.nom)]||0))}));
  for(const item of state.inventoryItems||[]){
    const [kind,id]=(item.catalogueRef||'').split(':');
    const canonical=kind==='weapon'?c.weapons.find(w=>itemCatalogueId(w)===id):kind==='armor'?c.armors.find(a=>a.id===id):kind==='potion'?POTIONS.find(p=>p.id===id):null;
    rows.push({ref:'item:'+item.id,nom:item.name,quantity:item.quantity,source:'Ajouté en partie',canonical,kind,description:item.description,consumable:item.consumable===true||kind==='potion'});
  }
  return rows.filter(i=>i.quantity>0).map(i=>{
    const weapon=i.canonical&&i.kind==='weapon'?i.canonical:!i.ref.startsWith('item:')?c.weapons.find(w=>key(w.nom)===key(i.nom)):null;
    const armor=i.canonical&&i.kind==='armor'?i.canonical:!i.ref.startsWith('item:')?c.armors.find(a=>key(a.nom)===key(i.nom)):null;
    const potion=i.kind==='potion'?i.canonical:!i.ref.startsWith('item:')?POTIONS.find(p=>key(p.nom)===key(i.nom)):null;
    return {...i,weapon,armor,potion,consumable:i.consumable||Boolean(potion)};
  });
}
export function wornEquipment(state,possessions){
  if(state.equipmentState===undefined)return null;
  const worn=validateEquipmentState(state.equipmentState),find=ref=>possessions.find(i=>i.ref===ref);
  if(worn.armor&&!find(worn.armor)?.armor?.classe_armure?.base||worn.shield&&find(worn.shield)?.armor?.categorie!=='bouclier'||worn.weapons.some(ref=>!find(ref)?.weapon))throw fault('Un objet porté n’est plus disponible ou son type a changé. Vérifiez l’équipement.');
  return possessions.filter(i=>i.ref===worn.armor||i.ref===worn.shield||worn.weapons.includes(i.ref));
}
export function reconcileEquipment(state,possessions){
  if(state.equipmentState===undefined)return;
  const e=state.equipmentState,find=ref=>possessions.find(i=>i.ref===ref);
  state.equipmentState={version:1,armor:find(e.armor)?.armor?.classe_armure?.base?e.armor:'',shield:find(e.shield)?.armor?.categorie==='bouclier'?e.shield:'',weapons:e.weapons.filter(ref=>find(ref)?.weapon)};
}
export function potionResult(potion,mode,dice,randomFace){
  if(!potion||!['physical','app'].includes(mode))throw fault('Choisissez vos dés physiques ou ceux de l’application.');
  let faces=dice;
  if(mode==='app'){
    if(dice!==undefined)throw fault('Le lancer de l’application ne reçoit pas de valeurs de dés.');
    faces=Array.from({length:potion.count},()=>randomFace(potion.sides));
  }
  if(!Array.isArray(faces)||faces.length!==potion.count||faces.some(n=>!Number.isInteger(n)||n<1||n>potion.sides))throw fault('Saisissez chacun des '+potion.count+' dés à '+potion.sides+' faces.');
  return {mode,dice:[...faces],healing:faces.reduce((a,b)=>a+b,0)+potion.bonus};
}
// Caller supplies the existing play-state healing action; quantity and HP are
// then saved in a single revision of the character, never in two API requests.
export function consumeItem(state,possessions,ref,result,{id,at,heal}){
  const item=possessions.find(i=>i.ref===ref);
  if(!item?.consumable)throw fault('Choisissez un consommable disponible.');
  const use=validateLastUse({id,at,name:item.nom,...(item.potion?result:{mode:'manual',dice:[],healing:0})});
  if(item.potion){const expected=potionResult(item.potion,'physical',use.dice);if(expected.healing!==use.healing||!['app','physical'].includes(use.mode))throw fault('Résultat de potion invalide.');}
  const next=structuredClone(state);
  if(item.potion)next.playState=heal(state,use.healing);
  if(ref.startsWith('item:'))next.inventoryItems=next.inventoryItems.flatMap(i=>i.id!==ref.slice(5)?[i]:i.quantity>1?[{...i,quantity:i.quantity-1}]:[]);
  else next.inventorySpent={...next.inventorySpent,[ref]:(next.inventorySpent?.[ref]||0)+1};
  next.inventoryLastUse=use;
  return next;
}
