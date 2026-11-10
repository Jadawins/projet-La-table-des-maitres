import {changeInventory} from './inventory-state.mjs';
import {itemCatalogueId} from './equipment-state.mjs';
import {COINS, copperTotal, removeInventoryQuantity, validateCoins, validateWallet, walletCoins} from './wallet-state.mjs';

const fault = (status, message) => Object.assign(new Error(message), {status});

export function giftCoins(raw) {
  if (raw === undefined) return Object.fromEntries(Object.keys(COINS).map(coin => [coin, 0]));
  return validateCoins(raw);
}

export function giftItem(state, model, ref, quantity) {
  const item = model.possessions.find(row => row.ref === ref);
  if (!item || item.quantity < quantity) throw fault(409, 'Cette quantité n’est plus disponible dans l’inventaire du donneur.');
  const stored = state.inventoryItems?.find(row => 'item:' + row.id === ref);
  let catalogueRef = stored?.catalogueRef;
  if (ref.startsWith('start:')) {
    for (const [kind, entry] of [['weapon', item.weapon], ['armor', item.armor], ['potion', item.potion]]) {
      if (entry) { catalogueRef = kind + ':' + itemCatalogueId(entry); break; }
    }
  }
  return {
    name: item.nom,
    quantity,
    description: item.description ?? '',
    ...(catalogueRef ? {catalogueRef} : {}),
    ...(item.consumable ? {consumable:true} : {}),
  };
}

function moveCoins(next, state, model, coins, direction, {receiptId, at, otherName}) {
  if (!copperTotal(coins)) return;
  const before = walletCoins(state, model.money);
  const after = Object.fromEntries(Object.keys(COINS).map(coin => [coin, before[coin] + direction * coins[coin]]));
  if (Object.values(after).some(amount => amount < 0)) {
    throw fault(409, 'Le donneur n’a plus assez de pièces dans les monnaies proposées.');
  }
  const entry = {
    id:receiptId, kind:direction < 0 ? 'spend' : 'receive',
    label:direction < 0 ? 'Don à ' + otherName : 'Don de ' + otherName,
    at, before, after,
  };
  next.wallet = validateWallet({version:1, coins:after, history:[...(state.wallet?.history ?? []), entry].slice(-20)});
}

export function debitGift(state, model, catalogue, gift, options) {
  const next = structuredClone(state);
  const {item, itemRef, coins} = gift;
  if (item) {
    if (JSON.stringify(giftItem(state, model, itemRef, item.quantity)) !== JSON.stringify(item)) {
      throw fault(409, 'L’objet a changé depuis la proposition du don.');
    }
    removeInventoryQuantity(next, model, catalogue, itemRef, item.quantity);
  }
  moveCoins(next, state, model, coins, -1, options);
  return next;
}

export function creditGift(state, model, gift, options) {
  const next = structuredClone(state);
  if (gift.item) next.inventoryItems = changeInventory(state.inventoryItems, {
    type:'add', item:{...gift.item, id:options.itemId},
  });
  moveCoins(next, state, model, gift.coins, 1, options);
  return next;
}
