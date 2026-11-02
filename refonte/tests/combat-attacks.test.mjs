import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createCombatStore} from '../access/combat-store.mjs';
import {createCharacterStore} from '../access/character-store.mjs';
import {createGroupStore} from '../access/group-store.mjs';
import {createBestiaryStore} from '../access/bestiary-store.mjs';
import {buildCatalogue} from '../catalogue.mjs';
import {originFixture} from '../audit/origin-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {playView,applyPlayAction} from '../maquette/play-state.mjs';
import {validateSavedCharacter} from '../maquette/character-storage.mjs';
import {groupMemory} from './group-memory.mjs';
import {memoryCollection} from './admin-memory.mjs';
import {bestiaryMemory} from './bestiary-fixture.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('./fixtures/rules-2024.json',import.meta.url))));
const mj={userId:'mj'},player={userId:'player'},outsider={userId:'outsider'};
async function setup(){
  let clock=new Date('2026-11-02T12:00:00Z').getTime(),calls=0;const values=[];
  const collection=groupMemory(),characters=createCharacterStore({collection:memoryCollection(),validate:s=>validateSavedCharacter(s,c),catalogueFingerprint:'attacks-tests'});
  const groups=createGroupStore({collection:groupMemory(),characters}),created=await groups.create(mj,{name:'Attaques',alias:'Wiwi'}),groupId=created.group.id;
  await groups.join(player,{code:created.invitationCode,alias:'Aline'});
  const id=randomUUID(),state=originFixture(c,'barbare',1,{speciesId:'orc'},'marin');state.name='Héroïne';await characters.save('player',id,state,0);await groups.attach(player,groupId,{characterId:id});
  const combats=createCombatStore({collection,groups,characters,bestiary:createBestiaryStore({collection:bestiaryMemory()}),sheetModel:s=>sheetModel(s,c),playView,applyPlayAction,
    now:()=>new Date(clock),attackRandomFace:sides=>{calls++;return values.length?values.shift():Math.min(18,sides);}});
  let view=await combats.create(mj,groupId,{name:'Le pont'});
  const act=async(data,actor=mj)=>view=await combats.act(actor,groupId,{combatId:view.combat.id,revision:view.combat.revision,...data});
  await act({type:'add-bestiary',monsterId:'goblin',quantity:2});const [pc,npc,hidden]=view.combat.participants;
  await act({type:'visible',participantId:npc.id,value:true});
  for(const p of [pc,npc,hidden])await act({type:'initiative',participantId:p.id,value:p.kind==='pc'?15:10});await act({type:'start'});
  async function roll(actor=player,attacker=pc,target=npc,{mode='physical',dice=[18],...extra}={}){
    const options=await combats.attackOptions(actor,groupId,attacker.id);return combats.rollAttack(actor,groupId,{combatId:options.combatId,revision:options.revision,attackerId:attacker.id,targetId:target.id,attackId:options.attacks.find(a=>a.usable).id,mode,...(mode==='physical'?{dice}:{}),...extra});
  }
  const get=async(actor=mj)=>view=await combats.get(actor,groupId);
  return {combats,characters,groups,groupId,id,pc,npc,hidden,act,get,roll,collection,values,calls:()=>calls,advance:()=>{clock+=6*60000;}};
}
test('Attaque joueur : jets sans dégâts, validation MJ et confirmation répétée sans double application',async()=>{
  const s=await setup(),before=await s.characters.get('player',s.id);
  const rolled=await s.roll();assert.equal(rolled.ticket.roll.outcome,'hit');assert.equal(rolled.ticket.targetAC,undefined);assert.equal(rolled.ticket.targetHints,undefined);
  assert.equal((await s.get()).combat.participants.find(p=>p.id===s.npc.id).currentHp,7);
  const ready=await s.combats.rollDamage(player,s.groupId,{ticketId:rolled.ticket.id,mode:'physical',dice:[1],adjustment:0});assert.equal(ready.ticket.stage,'ready');
  assert.equal((await s.get()).combat.participants.find(p=>p.id===s.npc.id).currentHp,7);
  await assert.rejects(s.combats.confirmAttack(player,s.groupId,{ticketId:rolled.ticket.id,confirmed:true}),e=>e.status===403);
  const applied=await s.combats.confirmAttack(mj,s.groupId,{ticketId:rolled.ticket.id,confirmed:true});assert.equal(applied.ticket.appliedDamage,2);
  await s.combats.confirmAttack(mj,s.groupId,{ticketId:rolled.ticket.id,confirmed:true});assert.equal((await s.get()).combat.participants.find(p=>p.id===s.npc.id).currentHp,5);
  assert.deepEqual(await s.characters.get('player',s.id),before);
});
test('Dés de l’application : jamais lancés à la consultation, détail conservé et critique sans bonus doublé',async()=>{
  const s=await setup();await s.combats.attackOptions(player,s.groupId,s.pc.id);await s.get();assert.equal(s.calls(),0);
  s.values.push(20,4,5);const roll=await s.roll(player,s.pc,s.npc,{mode:'app'});assert.equal(s.calls(),1);assert.equal(roll.ticket.decision,'critical');
  const damage=await s.combats.rollDamage(player,s.groupId,{ticketId:roll.ticket.id,mode:'app',adjustment:0});assert.equal(s.calls(),3);assert.equal(damage.ticket.damage.total,10);
  await s.get();assert.equal(s.calls(),3);assert.equal((await s.get()).combat.participants.find(p=>p.id===s.npc.id).currentHp,7);
});
test('Droits : cible cachée, attaque d’un autre participant, accès extérieur et attaques personnalisées',async()=>{
  const s=await setup();await assert.rejects(s.combats.attackOptions(outsider,s.groupId,s.pc.id),e=>e.status===404);
  await assert.rejects(s.combats.attackOptions(player,s.groupId,s.npc.id),e=>e.status===403);
  await assert.rejects(s.roll(player,s.pc,s.hidden),e=>e.status===404);
  const options=await s.combats.attackOptions(player,s.groupId,s.pc.id);assert(!options.targets.some(p=>p.id===s.hidden.id));
  await assert.rejects(s.combats.rollAttack(player,s.groupId,{combatId:options.combatId,revision:options.revision,attackerId:s.pc.id,targetId:s.npc.id,attackId:'custom',custom:{name:'Faux',bonus:100,formula:'100'},mode:'physical',dice:[20]}),e=>e.status===403);
});
test('Correction MJ, résistance et échec : pas de dégâts avant confirmation et pas de dé automatique',async()=>{
  const s=await setup(),roll=await s.roll();
  await assert.rejects(s.combats.rollDamage(player,s.groupId,{ticketId:roll.ticket.id,outcome:'critical',mode:'physical',dice:[1,1],reason:'Je choisis'}),e=>e.status===403);
  await s.combats.rollDamage(mj,s.groupId,{ticketId:roll.ticket.id,outcome:'critical',mode:'physical',dice:[1,1],reason:'Condition vérifiée à la table'});
  const result=await s.combats.confirmAttack(mj,s.groupId,{ticketId:roll.ticket.id,confirmed:true,treatment:'resistance'});assert.equal(result.ticket.appliedDamage,1);
  const missed=await s.roll(player,s.pc,s.npc,{dice:[1]});await s.combats.rollDamage(player,s.groupId,{ticketId:missed.ticket.id,mode:'app'});assert.equal(s.calls(),0);
  const before=(await s.get()).combat.participants.find(p=>p.id===s.npc.id).currentHp;await s.combats.confirmAttack(mj,s.groupId,{ticketId:missed.ticket.id,confirmed:true});assert.equal((await s.get()).combat.participants.find(p=>p.id===s.npc.id).currentHp,before);
});
test('Deux confirmations concurrentes du même jet ne modifient les PV qu’une fois',async()=>{
  const s=await setup(),roll=await s.roll();await s.combats.rollDamage(player,s.groupId,{ticketId:roll.ticket.id,mode:'physical',dice:[1]});
  const results=await Promise.all([s.combats.confirmAttack(mj,s.groupId,{ticketId:roll.ticket.id,confirmed:true}),s.combats.confirmAttack(mj,s.groupId,{ticketId:roll.ticket.id,confirmed:true})]);
  assert(results.every(r=>r.ticket.appliedDamage===2));assert.equal((await s.get()).combat.participants.find(p=>p.id===s.npc.id).currentHp,5);
});
test('Dégâts vers un PJ : conflits entre deux jets distincts explicites et nouvelle confirmation sans relancer',async()=>{
  const s=await setup();await s.act({type:'health',participantId:s.pc.id,characterRevision:1,action:{type:'start',currentHp:s.pc.maxHp}});
  const a=await s.roll(mj,s.npc,s.pc),b=await s.roll(mj,s.npc,s.pc);
  for(const r of [a,b])await s.combats.rollDamage(mj,s.groupId,{ticketId:r.ticket.id,mode:'physical',dice:[1]});
  const results=await Promise.allSettled([s.combats.confirmAttack(mj,s.groupId,{ticketId:a.ticket.id,confirmed:true}),s.combats.confirmAttack(mj,s.groupId,{ticketId:b.ticket.id,confirmed:true})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const failed=results.findIndex(r=>r.status==='rejected');assert.equal(results[failed].reason.status,409);
  await s.combats.confirmAttack(mj,s.groupId,{ticketId:[a,b][failed].ticket.id,confirmed:true});assert.equal((await s.characters.get('player',s.id)).character.playState.hpLost,6);
});
test('Revérifier une défense modifiée conserve les dés ; aucun effet après pause ou exclusion',async()=>{
  const s=await setup();s.values.push(18);const rolled=await s.roll(player,s.pc,s.npc,{mode:'app'});
  await s.combats.rollDamage(player,s.groupId,{ticketId:rolled.ticket.id,mode:'physical',dice:[1]});
  await s.act({type:'health',participantId:s.npc.id,action:{type:'set-condition',condition:'prone',active:true}});
  await assert.rejects(s.combats.confirmAttack(mj,s.groupId,{ticketId:rolled.ticket.id,confirmed:true}),e=>e.status===409);
  const checked=await s.combats.recheckAttack(mj,s.groupId,{ticketId:rolled.ticket.id});assert.deepEqual(checked.ticket.roll.dice,rolled.ticket.roll.dice);assert.equal(checked.ticket.roll.mode,'app');assert.equal(s.calls(),1);
  await s.act({type:'pause'});await assert.rejects(s.combats.confirmAttack(mj,s.groupId,{ticketId:rolled.ticket.id,confirmed:true}),e=>e.status===400);
  await s.act({type:'resume'});await s.groups.removeMember(mj,s.groupId,{userId:'player'});await assert.rejects(s.combats.confirmAttack(mj,s.groupId,{ticketId:rolled.ticket.id,confirmed:true}),e=>e.status===409);
});
test('Annulation, expiration et quota des propositions : aucun dégât et aucun lancer déclenché en plus',async()=>{
  const s=await setup(),created=[];for(let i=0;i<20;i++)created.push(await s.roll());
  await assert.rejects(s.roll(),e=>e.status===429);await s.combats.cancelAttack(player,s.groupId,{ticketId:created[0].ticket.id});await s.roll();
  s.advance();assert.equal((await s.get(player)).combat.attackTickets.length,0);
  await assert.rejects(s.combats.rollDamage(player,s.groupId,{ticketId:created[1].ticket.id,mode:'app'}),e=>e.status===404);assert.equal(s.calls(),0);
});
test('Accusé de sauvegarde perdu : résultat signalé à vérifier, sans nouvelle application du même jet',async()=>{
  const s=await setup();await s.act({type:'health',participantId:s.pc.id,characterRevision:1,action:{type:'start',currentHp:s.pc.maxHp}});
  const rolled=await s.roll(mj,s.npc,s.pc);await s.combats.rollDamage(mj,s.groupId,{ticketId:rolled.ticket.id,mode:'physical',dice:[1]});
  const original=s.characters.save.bind(s.characters);let writes=0;
  s.characters.save=async(...args)=>{writes++;await original(...args);throw Error('Simulated acknowledgement lost');};
  await assert.rejects(s.combats.confirmAttack(mj,s.groupId,{ticketId:rolled.ticket.id,confirmed:true}),e=>e.status===503);
  const current=await s.get();assert.equal(current.combat.attackTickets[0].stage,'uncertain');assert.equal((await s.characters.get('player',s.id)).character.playState.hpLost,3);
  await assert.rejects(s.combats.confirmAttack(mj,s.groupId,{ticketId:rolled.ticket.id,confirmed:true}),e=>e.status===400);assert.equal(writes,1);
});

test('Groupe supprimé : combat et proposition en attente inaccessibles, aucune modification des PV',async()=>{
  const s=await setup(),before=await s.characters.get('player',s.id),roll=await s.roll();
  await s.combats.rollDamage(player,s.groupId,{ticketId:roll.ticket.id,mode:'physical',dice:[1]});
  const group=await s.groups.get(mj,s.groupId);await s.groups.remove(mj,s.groupId,{confirmed:true,revision:group.revision});
  for(const actor of [mj,player])await assert.rejects(s.combats.get(actor,s.groupId),e=>e.status===404);
  await assert.rejects(s.combats.confirmAttack(mj,s.groupId,{ticketId:roll.ticket.id,confirmed:true}),e=>e.status===404);
  assert.deepEqual(await s.characters.get('player',s.id),before);
});

test('Friendly fire : un PJ peut viser un allié ; seuls les dégâts confirmés par le MJ modifient sa fiche',async()=>{
  const s=await setup(),allyId=randomUUID(),state=originFixture(c,'barbare',1,{speciesId:'orc'},'marin');state.name='Allié';
  await s.characters.save(mj.userId,allyId,state,0);await s.groups.attach(mj,s.groupId,{characterId:allyId});
  await s.act({type:'pause'});await s.act({type:'sync'});
  const ally=(await s.get()).combat.participants.find(p=>p.characterId===allyId);assert(ally);
  await s.act({type:'health',participantId:ally.id,characterRevision:ally.characterRevision,action:{type:'start',currentHp:ally.maxHp}});
  await s.act({type:'initiative',participantId:ally.id,value:12});await s.act({type:'resume'});
  const attackerBefore=await s.characters.get(player.userId,s.id),allyBefore=await s.characters.get(mj.userId,allyId);
  const options=await s.combats.attackOptions(player,s.groupId,s.pc.id);assert(options.targets.some(p=>p.id===ally.id));
  const privateView=(await s.get(player)).combat.participants.find(p=>p.id===ally.id);assert.equal(privateView.currentHp,undefined);assert.equal(privateView.ac,undefined);
  const roll=await s.roll(player,s.pc,ally,{dice:[20]});assert.equal(roll.ticket.targetAC,undefined);
  const ready=await s.combats.rollDamage(player,s.groupId,{ticketId:roll.ticket.id,mode:'physical',dice:roll.ticket.plan.dice.flatMap(d=>Array(d.count).fill(1))});
  assert.deepEqual(await s.characters.get(mj.userId,allyId),allyBefore);
  await assert.rejects(s.combats.confirmAttack(player,s.groupId,{ticketId:roll.ticket.id,confirmed:true}),e=>e.status===403);
  await s.combats.confirmAttack(mj,s.groupId,{ticketId:roll.ticket.id,confirmed:true});
  await s.combats.confirmAttack(mj,s.groupId,{ticketId:roll.ticket.id,confirmed:true});
  const allyAfter=await s.characters.get(mj.userId,allyId);assert.equal(allyAfter.character.playState.hpLost,ready.ticket.damage.total);
  assert.equal(allyAfter.revision,allyBefore.revision+1);assert.deepEqual(await s.characters.get(player.userId,s.id),attackerBefore);
  const miss=await s.roll(player,s.pc,ally,{dice:[1]});await s.combats.rollDamage(player,s.groupId,{ticketId:miss.ticket.id,mode:'app'});
  await s.combats.confirmAttack(mj,s.groupId,{ticketId:miss.ticket.id,confirmed:true});assert.equal(s.calls(),0);
  assert.deepEqual(await s.characters.get(mj.userId,allyId),allyAfter);
});
