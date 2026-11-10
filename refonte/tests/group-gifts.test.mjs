import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {a,b,mj,unselected,outsider,c,lootFixture} from './loot-fixture.mjs';
import {createGroupGifts} from '../access/group-gifts.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {validateSavedCharacter} from '../maquette/character-storage.mjs';
import {walletCoins} from '../maquette/wallet-state.mjs';
import {messageMemory} from './message-memory.mjs';

const coins = po => ({pc:0,pa:0,pe:0,po,pp:0});
const model = state => sheetModel(state,c);
const balance = state => walletCoins(state,model(state).money);

async function fixture() {
  const f = await lootFixture();
  const item = {id:randomUUID(),name:'Dague gravée',quantity:2,description:'Un symbole gravé',catalogueRef:'weapon:dague'};
  const source = await f.record(a);
  await f.characters.save(a.userId,source.id,{...source.character,inventoryItems:[item],wallet:{version:1,coins:coins(5),history:[]}},source.revision);
  const rows = messageMemory();
  let clock = Date.parse('2026-11-10T08:00:00Z');
  let gifts;
  const restart = overrides => gifts = createGroupGifts({
    collection:rows, groups:f.groups, characters:f.characters, catalogue:c, sheetModel:model,
    validate:state=>validateSavedCharacter(state,c), now:()=>new Date(clock), ...overrides,
  });
  restart();
  const input = changes => ({id:randomUUID(),sourceId:f.ids.a,targetId:f.ids.b,recipientId:b.userId,item:{ref:'item:'+item.id,quantity:1},coins:coins(3),...changes});
  const offer = async data => (await gifts.propose(a,f.groupId,data ?? input())).gift;
  const decide = async (gift,decision='accept',actor=b) => (await gifts.decide(actor,f.groupId,gift.id,decision,{revision:gift.revision})).gift;
  const resume = async (gift,actor=a) => (await gifts.resume(actor,gift.id,{revision:gift.revision})).gift;
  return {...f,item,rows,restart,input,offer,decide,resume,get gifts(){return gifts;},advance:ms=>{clock+=ms;}};
}

test('Don accepté : une unité, les pièces exactes et les descriptions changent de fiche ensemble dans le suivi',async()=>{
  const f=await fixture(), source=await f.record(a), target=await f.record(b);
  const gift=await f.offer();
  assert.equal(gift.status,'offered');
  assert.deepEqual(await f.record(a),source);
  assert.deepEqual(await f.record(b),target);
  const result=await f.decide(gift);
  assert.equal(result.status,'done');
  const from=await f.record(a),to=await f.record(b);
  assert.equal(from.revision,source.revision+1);
  assert.equal(to.revision,target.revision+1);
  assert.equal(from.character.inventoryItems[0].quantity,1);
  const {id,...received}=to.character.inventoryItems[0];
  assert.notEqual(id,f.item.id);
  const {id:originalId,...original}=f.item;
  assert.deepEqual(received,{...original,quantity:1});
  assert.equal(balance(from.character).po,2);
  assert.equal(balance(to.character).po,balance(target.character).po+3);
  assert.equal(to.character.details.story,target.character.details.story);
  assert.equal(from.character.wallet.history.at(-1).kind,'spend');
  assert.equal(to.character.wallet.history.at(-1).kind,'receive');
});

test('Dernière unité du matériel de départ : déséquipée côté donneur et ajoutée côté destinataire',async()=>{
  const f=await fixture(),source=await f.record(a);
  const weapon=model(source.character).possessions.find(row=>row.ref.startsWith('start:')&&row.weapon);
  assert.ok(weapon);
  source.character.equipmentState={version:1,armor:'',shield:'',weapons:[weapon.ref]};
  await f.characters.save(a.userId,source.id,source.character,source.revision);
  const gift=await f.offer(f.input({item:{ref:weapon.ref,quantity:weapon.quantity},coins:coins(0)}));
  assert.equal((await f.decide(gift)).status,'done');
  const from=(await f.record(a)).character,to=(await f.record(b)).character;
  assert.deepEqual(from.equipmentState.weapons,[]);
  assert.equal(from.inventorySpent[weapon.ref],weapon.quantity);
  assert.equal(to.inventoryItems[0].catalogueRef,gift.item.catalogueRef);
  assert.equal(to.equipmentState,undefined);
});

test('Les offres restent privées et la décision appartient aux deux joueurs concernés',async()=>{
  const f=await fixture(),gift=await f.offer();
  for(const actor of [mj,unselected]) {
    assert.deepEqual((await f.gifts.history(actor,f.groupId)).gifts,[]);
    await assert.rejects(f.decide(gift,'accept',actor),error=>error.status===404);
  }
  await assert.rejects(f.gifts.history(outsider,f.groupId),error=>error.status===404);
  await assert.rejects(f.decide(gift,'accept',a),error=>error.status===403);
  await assert.rejects(f.decide(gift,'cancelled',b),error=>error.status===403);
  await assert.rejects(f.resume(gift),error=>error.status===409);
  const {gifts:[visible]}=await f.gifts.history(b,f.groupId);
  assert.equal(visible.incoming,true);
  for(const key of ['stamp','debitId','creditId','leaseToken','payload','recipientId']) assert.equal(visible[key],undefined);
  assert.deepEqual((await f.gifts.pending(a)).gifts,[]);
});

test('Refus ou retrait avant acceptation : aucune écriture sur les deux fiches',async()=>{
  const f=await fixture(),source=await f.record(a),target=await f.record(b);
  const refused=await f.decide(await f.offer(),'declined');
  const removed=await f.decide(await f.offer(),'cancelled',a);
  assert.equal(refused.status,'declined');
  assert.equal(removed.status,'cancelled');
  await assert.rejects(f.decide(removed),error=>error.status===409);
  assert.deepEqual(await f.record(a),source);
  assert.deepEqual(await f.record(b),target);
});

test('Les pièces sont données par monnaie et les objets proviennent de la fiche',async()=>{
  const f=await fixture();
  await assert.rejects(f.offer(f.input({item:null,coins:{...coins(0),pa:1}})),error=>error.status===409);
  await assert.rejects(f.offer(f.input({item:{ref:'item:'+randomUUID(),quantity:1}})),error=>error.status===409);
  await assert.rejects(f.offer(f.input({item:{ref:'item:'+f.item.id,quantity:1.5}})),error=>error.status===400);
  await assert.rejects(f.offer(f.input({item:null,coins:coins(0)})),error=>error.status===400);
  await assert.rejects(f.offer(f.input({sourceId:f.ids.c})),error=>error.status===409);
  const gift=await f.offer(f.input({item:{ref:'item:'+f.item.id,quantity:1,name:'Objet injecté'}}));
  assert.equal(gift.item.name,f.item.name);
});

test('Référence réutilisée et deux acceptations simultanées : un seul mouvement',async()=>{
  const f=await fixture(),input=f.input(),gift=await f.offer(input);
  assert.equal((await f.offer(input)).id,gift.id);
  await assert.rejects(f.offer({...input,coins:coins(2)}),error=>error.status===409);
  const results=await Promise.allSettled([f.decide(gift),f.decide(gift)]);
  assert.ok(results.some(result=>result.status==='fulfilled'&&result.value.status==='done'));
  assert.equal((await f.record(a)).character.inventoryItems[0].quantity,1);
  assert.equal((await f.record(b)).character.inventoryItems.length,1);
  assert.equal((await f.decide(gift)).status,'done');
  assert.equal((await f.resume(gift)).status,'done');
});

test('Deux offres portant sur les mêmes pièces : la deuxième reste à revoir après la première',async()=>{
  const f=await fixture(),first=await f.offer(f.input({item:null})),second=await f.offer(f.input({item:null}));
  assert.equal((await f.decide(first)).status,'done');
  await assert.rejects(f.decide(second),error=>error.status===409);
  assert.equal(balance((await f.record(a)).character).po,2);
  assert.equal((await f.gifts.history(a,f.groupId)).gifts.find(row=>row.id===second.id).status,'offered');
});

test('Un objet retouché ou une fiche détachée invalide la proposition avant le débit',async()=>{
  const f=await fixture(),gift=await f.offer(),source=await f.record(a);
  source.character.inventoryItems[0].description='Description corrigée';
  await f.characters.save(a.userId,source.id,source.character,source.revision);
  await assert.rejects(f.decide(gift),error=>error.status===409);
  assert.equal((await f.record(a)).character.inventoryItems[0].quantity,2);
  const next=await f.offer();
  await f.groups.attach(b,f.groupId,{characterId:null});
  await assert.rejects(f.decide(next),error=>error.status===409);
  assert.equal(balance((await f.record(a)).character).po,5);
});

test('Accusé du débit perdu : reprise privée même après la suppression du groupe',async()=>{
  const f=await fixture(),gift=await f.offer();
  let lost=true;
  f.restart({characters:{...f.characters,async applyLoot(owner,...args){
    const saved=await f.characters.applyLoot(owner,...args);
    if(owner===a.userId&&lost){lost=false;throw Error('lost debit response');}
    return saved;
  }}});
  const pending=await f.decide(gift);
  assert.equal(pending.status,'pending');
  assert.equal(pending.debited,true);
  const before=await f.record(a);
  const group=await f.groups.get(mj,f.groupId);
  await f.groups.remove(mj,f.groupId,{confirmed:true,revision:group.revision});
  f.restart();
  assert.equal((await f.gifts.pending(b)).gifts[0].id,gift.id);
  await assert.rejects(f.resume(pending,outsider),error=>error.status===404);
  assert.equal((await f.resume(pending,b)).status,'done');
  assert.deepEqual(await f.record(a),before);
  assert.equal((await f.record(b)).character.inventoryItems.length,1);
  assert.deepEqual((await f.gifts.pending(b)).gifts,[]);
});

test('Accusé de la remise perdu : la reprise conserve les deux révisions',async()=>{
  const f=await fixture(),gift=await f.offer();
  f.restart({characters:{...f.characters,async applyLoot(owner,...args){
    const value=await f.characters.applyLoot(owner,...args);
    if(owner===b.userId)throw Error('lost credit response');
    return value;
  }}});
  const pending=await f.decide(gift),from=await f.record(a),to=await f.record(b);
  assert.equal(pending.status,'pending');
  f.restart();
  assert.equal((await f.resume(pending)).status,'done');
  assert.deepEqual(await f.record(a),from);
  assert.deepEqual(await f.record(b),to);
});

test('Interruption entre les deux sauvegardes : reprise après le délai, avec les reçus déjà écrits',async()=>{
  const f=await fixture(),gift=await f.offer(),update=f.rows.updateOne;
  f.rows.updateOne=async(filter,change)=>{
    if(change.$set.debited!==undefined)throw Error('process stopped');
    return update(filter,change);
  };
  await assert.rejects(f.decide(gift));
  const {gifts:[pending]}=await f.gifts.pending(a);
  assert.equal(pending.status,'processing');
  const source=await f.record(a);
  f.rows.updateOne=update;
  f.restart();
  await assert.rejects(f.resume(pending),error=>error.status===409);
  f.advance(61000);
  assert.equal((await f.resume(pending)).status,'done');
  assert.deepEqual(await f.record(a),source);
  assert.equal((await f.record(b)).character.inventoryItems.length,1);
});

test('Fiche transférée après le débit : le don ne change pas de destinataire',async()=>{
  const f=await fixture(),gift=await f.offer();
  f.restart({characters:{...f.characters,async applyLoot(owner,...args){
    const value=await f.characters.applyLoot(owner,...args);
    if(owner===a.userId){
      const target=f.docs.rows.find(row=>row.user_id===b.userId);
      target.user_id='new-owner';
      target.revision++;
    }
    return value;
  }}});
  const pending=await f.decide(gift);
  assert.equal(pending.status,'pending');
  assert.equal(pending.debited,true);
  assert.equal((await f.characters.get('new-owner',f.ids.b)).character.inventoryItems,undefined);
  f.restart();
  assert.equal((await f.resume(pending)).status,'pending');
});

test('Une fiche disparue avant la reprise ne déclenche aucun nouveau débit',async()=>{
  const f=await fixture(),gift=await f.offer(),before=await f.record(a);
  f.restart({characters:{...f.characters,async applyLoot(){throw Error('process stopped before debit');}}});
  const pending=await f.decide(gift),target=await f.record(b);
  assert.equal(pending.status,'pending');
  assert.equal(pending.debited,false);
  await f.characters.remove(b.userId,target.id,target.revision);
  f.restart();
  const after=await f.resume(pending);
  assert.equal(after.status,'pending');
  assert.equal(after.debited,false);
  assert.deepEqual(await f.record(a),before);
});
