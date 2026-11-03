import {validateInventory,changeInventory} from './inventory-state.mjs';
import {POTIONS,itemCatalogueId,equipmentItems,reconcileEquipment} from './equipment-state.mjs';

// SRD 5.2.1 FR p.95. Integer copper units avoid floating-point money errors.
export const COINS=Object.freeze({pc:1,pa:10,pe:50,po:100,pp:1000});
const MAX=1_000_000_000;
const fault=message=>Object.assign(new Error(message),{status:400});
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validateCoins(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw fault('La bourse est invalide.');
  const coins={};
  for(const coin of Object.keys(COINS)){
    if(!Number.isInteger(raw[coin])||raw[coin]<0||raw[coin]>MAX)throw fault('Chaque monnaie doit contenir un nombre entier de pièces, entre zéro et un milliard.');
    coins[coin]=raw[coin];
  }
  return coins;
}
export const copperTotal=coins=>Object.entries(COINS).reduce((sum,[coin,value])=>sum+coins[coin]*value,0);
export function validateWallet(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.history)||raw.history.length>20)throw fault('L’historique de la bourse est invalide.');
  const coins=validateCoins(raw.coins);
  const history=raw.history.map(row=>{
    if(!row||!uuid(row.id)||!['receive','spend','buy','sell','adjust'].includes(row.kind)||typeof row.label!=='string'||!row.label.trim()||row.label.length>160||typeof row.at!=='string'||!Number.isFinite(Date.parse(row.at))||new Date(row.at).toISOString()!==row.at)throw fault('Un mouvement de bourse est invalide.');
    const before=validateCoins(row.before),after=validateCoins(row.after),delta=copperTotal(after)-copperTotal(before);
    if(['receive','sell'].includes(row.kind)&&delta<=0||['spend','buy'].includes(row.kind)&&delta>=0)throw fault('Le montant d’un mouvement de bourse est invalide.');
    return {id:row.id,kind:row.kind,label:row.label.trim(),at:row.at,before,after};
  });
  if(new Set(history.map(r=>r.id)).size!==history.length)throw fault('Un mouvement figure deux fois dans la bourse.');
  for(let index=1;index<history.length;index++)if(JSON.stringify(history[index-1].after)!==JSON.stringify(history[index].before))throw fault('Les mouvements de bourse ne se suivent pas.');
  if(history.length&&JSON.stringify(history.at(-1).after)!==JSON.stringify(coins))throw fault('Le solde ne correspond pas au dernier mouvement de bourse.');
  return {version:1,coins,history};
}
export function walletCoins(state,initial){return state.wallet===undefined?validateCoins(initial):validateWallet(state.wallet).coins;}
export function priceInCopper(amount,coin){
  const text=typeof amount==='number'?String(amount):amount;
  if(typeof text!=='string'||!/^\d{1,10}(?:[.,]\d{1,2})?$/.test(text)||!Object.hasOwn(COINS,coin))throw fault('Indiquez un prix positif et une monnaie valide, avec deux décimales maximum.');
  const [whole,fraction='']=text.replace(',','.').split('.'),hundredths=Number(whole)*100+Number(fraction.padEnd(2,'0')),numerator=hundredths*COINS[coin];
  if(!Number.isSafeInteger(numerator)||numerator%100!==0||numerator/100<1||numerator/100>MAX)throw fault('Le montant doit représenter au moins une pièce de cuivre, sans fraction de pièce de cuivre.');
  return numerator/100;
}
function changeCoins(copper,maxValue=1000){
  const coins={pc:0,pa:0,pe:0,po:0,pp:0};
  // Do not introduce electrum while making change unless explicitly received.
  for(const coin of ['pp','po','pa','pc'])if(COINS[coin]<=maxValue){coins[coin]=Math.floor(copper/COINS[coin]);copper%=COINS[coin];}
  return coins;
}
function receive(coins,amount,coin){
  const next={...coins},whole=Math.floor(amount/COINS[coin]);next[coin]+=whole;
  const remainder=changeCoins(amount%COINS[coin],COINS[coin]);for(const c of Object.keys(COINS))next[c]+=remainder[c];return validateCoins(next);
}
function spend(coins,amount,coin,allowChange){
  if(copperTotal(coins)<amount)throw fault('Votre bourse ne contient pas assez d’argent.');
  const next={...coins},count=amount/COINS[coin];
  if(Number.isInteger(count)&&next[coin]>=count){next[coin]-=count;return next;}
  if(allowChange!==true)throw fault('Vous n’avez pas l’appoint dans cette monnaie. Cochez « Faire la monnaie si nécessaire » pour utiliser les autres pièces.');
  let remaining=amount;
  for(const c of ['pp','po','pe','pa','pc']){const taken=Math.min(next[c],Math.floor(remaining/COINS[c]));next[c]-=taken;remaining-=taken*COINS[c];}
  if(remaining){
    const larger=['pa','pe','po','pp'].find(c=>next[c]>0&&COINS[c]>remaining);
    if(!larger)throw fault('Impossible de préparer la monnaie.');
    next[larger]--;const returned=changeCoins(COINS[larger]-remaining);for(const c of Object.keys(COINS))next[c]+=returned[c];
  }
  if(copperTotal(next)!==copperTotal(coins)-amount)throw fault('La conversion de monnaie est invalide.');
  return validateCoins(next);
}
export function cataloguePurchase(c,ref){
  if(typeof ref!=='string')return null;
  const [kind,id]=ref.split(':'),rows=kind==='weapon'?c.weapons:kind==='armor'?c.armors:kind==='potion'?POTIONS:[];
  return rows.find(i=>itemCatalogueId(i)===id)||null;
}
export function suggestedPrice(item,c,selling=false){
  const source=item.canonical||item.weapon||item.armor||cataloguePurchase(c,item.catalogueRef),price=source?.prix;
  if(!price)return null;
  let copper;try{copper=priceInCopper(price.quantite,price.monnaie);}catch{return null;}
  if(selling){if(copper%2!==0)return null;copper/=2;}
  return {copper,amount:String(copper/100),coin:'po'};
}
export function walletAction(state,model,c,action,{id,at}){
  if(!action||!uuid(id)||typeof at!=='string')throw fault('La référence de mouvement est invalide.');
  const before=walletCoins(state,model.money),next=structuredClone(state),history=state.wallet?.history||[];
  if(history.some(row=>row.id===id))throw fault('Ce mouvement est déjà préparé. Enregistrez ou rouvrez la fiche.');
  if(action.label!==undefined&&typeof action.label!=='string')throw fault('Le libellé du mouvement est invalide.');
  let after,label=action.label?.trim();
  if(action.kind==='adjust'){
    after=validateCoins(action.coins);if(!label)throw fault('Indiquez la raison de la correction du solde.');
  }else{
    const unit=priceInCopper(action.amount,action.coin);
    const quantity=['buy','sell'].includes(action.kind)?action.quantity:1;
    if(!Number.isInteger(quantity)||quantity<1||quantity>9999||!Number.isSafeInteger(unit*quantity)||unit*quantity>MAX)throw fault('La quantité ou le prix total est trop élevé.');
    const total=unit*quantity;
    if(action.kind==='receive')after=receive(before,total,action.coin);
    else if(action.kind==='spend')after=spend(before,total,action.coin,action.allowChange);
    else if(action.kind==='buy'){
      const source=action.item?.catalogueRef?cataloguePurchase(c,action.item.catalogueRef):null;
      if(action.item?.catalogueRef&&!source)throw fault('Cet objet ne figure pas dans le catalogue.');
      const item={...action.item,quantity};
      next.inventoryItems=changeInventory(state.inventoryItems,{type:'add',item});
      after=spend(before,total,action.coin,action.allowChange);label='Achat : '+quantity+' × '+next.inventoryItems.at(-1).name;
    }else if(action.kind==='sell'){
      const item=model.possessions.find(i=>i.ref===action.ref);
      if(!item||item.quantity<quantity)throw fault('Vous ne possédez pas cette quantité de cet objet.');
      if(action.ref.startsWith('item:'))next.inventoryItems=validateInventory((next.inventoryItems||[]).flatMap(i=>i.id!==action.ref.slice(5)?[i]:i.quantity>quantity?[{...i,quantity:i.quantity-quantity}]:[]));
      else next.inventorySpent={...next.inventorySpent,[action.ref]:(next.inventorySpent?.[action.ref]||0)+quantity};
      after=receive(before,total,action.coin);label='Vente : '+quantity+' × '+item.nom;
      reconcileEquipment(next,equipmentItems(next,model.inventory,c));
    }else throw fault('Choisissez un mouvement de bourse valide.');
    label||=action.kind==='receive'?'Argent reçu':'Dépense';
  }
  const entry={id,kind:action.kind,label,at,before,after};
  next.wallet=validateWallet({version:1,coins:after,history:[...history,entry].slice(-20)});
  return next;
}
