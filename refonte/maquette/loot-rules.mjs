import {validateInventory} from './inventory-state.mjs';
import {validateCoins,validateWallet,walletCoins,copperTotal,cataloguePurchase} from './wallet-state.mjs';
const fault=message=>Object.assign(new Error(message),{status:400});
const emptyCoins=()=>({pc:0,pa:0,pe:0,po:0,pp:0});
export function validateLoot(raw,catalogue){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw fault('Le butin est invalide.');
  const coins=validateCoins(raw.coins??emptyCoins());let item=null;
  if(raw.item!==undefined&&raw.item!==null){
    const row=validateInventory([{...raw.item,id:'00000000-0000-0000-0000-000000000001'}])[0];
    if(row.catalogueRef&&!cataloguePurchase(catalogue,row.catalogueRef))throw fault('Cet objet ne figure pas dans le catalogue.');
    const {id,...value}=row;item=value;
  }
  if(!item&&!copperTotal(coins))throw fault('Indiquez un objet ou des pièces à attribuer.');
  return {coins,item};
}
export function grantLoot(state,model,payload,{receiptId,itemId,at,label}){
  const next=structuredClone(state);
  if(payload.item)next.inventoryItems=validateInventory([...(next.inventoryItems||[]),{...payload.item,id:itemId}]);
  if(copperTotal(payload.coins)){
    const before=walletCoins(state,model.money),after=validateCoins(Object.fromEntries(Object.keys(before).map(c=>[c,before[c]+payload.coins[c]])));
    next.wallet=validateWallet({version:1,coins:after,history:[...(state.wallet?.history||[]),{id:receiptId,kind:'receive',label:'Butin du groupe : '+label,at,before,after}].slice(-20)});
  }
  return next;
}
