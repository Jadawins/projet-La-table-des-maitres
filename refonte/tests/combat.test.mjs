import {createBestiaryStore} from '../access/bestiary-store.mjs';
import {bestiaryMemory,bestiaryFixtures} from './bestiary-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createCombatStore} from '../access/combat-store.mjs';
import {createGroupStore} from '../access/group-store.mjs';
import {createCharacterStore} from '../access/character-store.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {playView,applyPlayAction} from '../maquette/play-state.mjs';
import {validateSavedCharacter} from '../maquette/character-storage.mjs';
import {buildCatalogue} from '../catalogue.mjs';
import {originFixture} from '../audit/origin-fixtures.mjs';
import {groupMemory} from './group-memory.mjs';
import {memoryCollection} from './admin-memory.mjs';
const catalogue=buildCatalogue(JSON.parse(await readFile(new URL('./fixtures/rules-2024.json',import.meta.url))));
const mj={userId:'mj'},player={userId:'player'},outsider={userId:'outsider'};
async function setup({attach=true,bestiaryRows=null}={}){
  const chars=memoryCollection(),characters=createCharacterStore({collection:chars,validate:s=>validateSavedCharacter(s,catalogue),catalogueFingerprint:'combat-tests'});
  const groups=createGroupStore({collection:groupMemory(),characters});
  const {group,invitationCode}=await groups.create(mj,{name:'Table',alias:'Wiwi'});await groups.join(player,{code:invitationCode,alias:'Aline'});
  const id=randomUUID(),state=originFixture(catalogue,'barbare',1,{speciesId:'orc'},'marin');state.name='Héroïne';
  await characters.save(player.userId,id,state,0);if(attach)await groups.attach(player,group.id,{characterId:id});
  const collection=groupMemory(),rawInsert=collection.insertOne;
  collection.insertOne=async row=>{if(collection.rows.some(p=>p.groupId===row.groupId&&p.active&&row.active))throw Object.assign(Error('duplicate'),{code:11000});return rawInsert(row);};
  const bestiary=bestiaryRows?createBestiaryStore({collection:bestiaryMemory(bestiaryRows)}):null;
  const combats=createCombatStore({collection,groups,characters,bestiary,sheetModel:s=>sheetModel(s,catalogue),playView,applyPlayAction});
  let result;
  const create=async()=>result=await combats.create(mj,group.id,{name:'Le pont'});
  const get=async(actor=mj)=>result=await combats.get(actor,group.id);
  const act=async(data,actor=mj)=>{const previous=result;result=await combats.act(actor,group.id,{combatId:previous.combat.id,revision:previous.combat.revision,...data});return result;};
  const npc=async(name='Gobelin')=>{await act({type:'add-npc',name,maxHp:12,ac:13});return result.combat.participants.find(p=>p.name===name);};
  const initiative=async(p,value)=>act({type:'initiative',participantId:p.id,value});
  return {combats,groups,characters,collection,group,id,create,get,act,npc,initiative,raw:()=>result};
}
test('Combat lié au groupe : accès membre, rôle MJ, un seul combat actif et aucune copie de fiche',async()=>{
  const s=await setup();await assert.rejects(s.combats.get(outsider,s.group.id),e=>e.status===404);
  await assert.rejects(s.combats.create(player,s.group.id,{name:'Non'}),e=>e.status===403);
  const before=await s.characters.get(player.userId,s.id);const result=await s.create();assert.equal(result.combat.participants[0].name,'Héroïne');
  assert.deepEqual(await s.characters.get(player.userId,s.id),before);
  await assert.rejects(s.combats.create(mj,s.group.id,{name:'Autre'}),e=>e.status===409);
});
test('Adversaires cachés et journal MJ absents de la réponse joueur ; CA et PV réservés',async()=>{
  const s=await setup();await s.create();const p=await s.npc('Secret des souterrains');
  const playerView=await s.combats.get(player,s.group.id);assert(!JSON.stringify(playerView).includes('Secret des souterrains'));assert.equal(playerView.combat.journal,undefined);
  await s.act({type:'visible',participantId:p.id,value:true});
  const visible=(await s.combats.get(player,s.group.id)).combat.participants.find(row=>row.id===p.id);
  assert(visible);assert.equal(visible.currentHp,undefined);assert.equal(visible.ac,undefined);assert.equal(visible.canEdit,false);
});
test('Préparation : initiatives obligatoires, égalités arbitrées, aucune initiative générée',async()=>{
  const s=await setup();const {combat}=await s.create(),pc=combat.participants[0],npc=await s.npc();
  await assert.rejects(s.act({type:'start'}),e=>e.status===400);
  await s.initiative(pc,12);await s.initiative(npc,12);assert.equal(s.raw().combat.participants[0].id,pc.id);
  await s.act({type:'tie',participantId:npc.id});assert.equal(s.raw().combat.participants[0].id,npc.id);
  await s.act({type:'start'});assert.equal(s.raw().combat.currentId,npc.id);assert.equal(s.raw().combat.round,1);
});
test('Tours, retour en arrière et rounds conservent les identités ; les participants à 0 PV ne sont pas sautés',async()=>{
  const s=await setup();await s.create();const pc=s.raw().combat.participants[0],npc=await s.npc();await s.initiative(pc,10);await s.initiative(npc,5);await s.act({type:'start'});
  await assert.rejects(s.act({type:'previous'}),e=>e.status===400);
  await s.act({type:'health',participantId:npc.id,action:{type:'damage',amount:12}});
  await s.act({type:'next'});assert.equal(s.raw().combat.currentId,npc.id);
  await s.act({type:'next'});assert.equal(s.raw().combat.round,2);assert.equal(s.raw().combat.currentId,pc.id);
  await s.act({type:'previous'});assert.equal(s.raw().combat.round,1);assert.equal(s.raw().combat.currentId,npc.id);
});
test('Pause, reprise et correction des initiatives ne changent pas silencieusement le participant actif',async()=>{
  const s=await setup();await s.create();const pc=s.raw().combat.participants[0],npc=await s.npc();await s.initiative(pc,10);await s.initiative(npc,5);await s.act({type:'start'});
  await assert.rejects(s.initiative(npc,20),e=>e.status===400);await assert.rejects(s.npc('Nouveau'),e=>e.status===400);
  await s.act({type:'pause'});await assert.rejects(s.act({type:'next'}),e=>e.status===400);await s.initiative(npc,20);await s.act({type:'resume'});
  assert.equal(s.raw().combat.currentId,pc.id);assert.equal(s.raw().combat.status,'running');
});
test('Révision du combat : double clic ou onglet ancien refusé sans double passage de tour',async()=>{
  const s=await setup();await s.create();const pc=s.raw().combat.participants[0];await s.initiative(pc,10);await s.act({type:'start'});
  const input={type:'next',combatId:s.raw().combat.id,revision:s.raw().combat.revision};await s.combats.act(mj,s.group.id,input);
  await assert.rejects(s.combats.act(mj,s.group.id,input),e=>e.status===409);assert.equal((await s.get()).combat.round,2);
});
test('PV des PJ : initialisation explicite, absorption temporaire, sauvegarde réelle et conflit de fiche',async()=>{
  const s=await setup();await s.create();let pc=s.raw().combat.participants[0];assert.equal(pc.started,false);
  await assert.rejects(s.act({type:'health',participantId:pc.id,characterRevision:pc.characterRevision,action:{type:'damage',amount:3}},player),e=>e.status===400);
  await s.act({type:'health',participantId:pc.id,characterRevision:pc.characterRevision,action:{type:'start',currentHp:pc.maxHp}},player);
  pc=s.raw().combat.participants[0];await s.act({type:'health',participantId:pc.id,characterRevision:pc.characterRevision,action:{type:'set-temp',amount:5}},player);
  pc=s.raw().combat.participants[0];const old=pc.characterRevision;
  await s.act({type:'health',participantId:pc.id,characterRevision:old,action:{type:'damage',amount:8}},player);
  pc=s.raw().combat.participants[0];assert.equal(pc.currentHp,pc.maxHp-3);assert.equal(pc.tempHp,0);
  assert.equal((await s.characters.get(player.userId,s.id)).character.playState.hpLost,3);
  await assert.rejects(s.act({type:'health',participantId:pc.id,characterRevision:old,action:{type:'damage',amount:8}},player),e=>e.status===409);
});
test('PV des adversaires : soins plafonnés, états induits et jets de mort manuels',async()=>{
  const s=await setup();await s.create();const npc=await s.npc();
  await s.act({type:'health',participantId:npc.id,action:{type:'damage',amount:12}});
  let row=s.raw().combat.participants.find(p=>p.id===npc.id);assert.equal(row.currentHp,0);assert(row.conditions.some(c=>c.id==='unconscious'));
  await s.act({type:'health',participantId:npc.id,action:{type:'death-roll',die:1,modifier:0}});
  row=s.raw().combat.participants.find(p=>p.id===npc.id);assert.equal(row.deathSaves.failures,2);
  await s.act({type:'health',participantId:npc.id,action:{type:'heal',amount:100}});
  row=s.raw().combat.participants.find(p=>p.id===npc.id);assert.equal(row.currentHp,12);assert.equal(row.deathSaves.failures,0);
});
test('Deux dégâts identiques simultanés : une seule écriture acceptée, la seconde doit être rejouée après actualisation',async()=>{
  const s=await setup();await s.create();let pc=s.raw().combat.participants[0];
  await s.act({type:'health',participantId:pc.id,characterRevision:pc.characterRevision,action:{type:'start',currentHp:pc.maxHp}});
  pc=s.raw().combat.participants[0];const input={type:'health',participantId:pc.id,characterRevision:pc.characterRevision,action:{type:'damage',amount:3},combatId:s.raw().combat.id,revision:s.raw().combat.revision};
  const results=await Promise.allSettled([s.combats.act(mj,s.group.id,input),s.combats.act(player,s.group.id,input)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  assert.equal((await s.characters.get(player.userId,s.id)).character.playState.hpLost,3);
});
test('Droits joueur : son initiative, ses PV et concentration uniquement ; pas les commandes du MJ',async()=>{
  const s=await setup();await s.create();const pc=s.raw().combat.participants[0],npc=await s.npc();
  await s.act({type:'initiative',participantId:pc.id,value:17},player);
  await s.act({type:'concentration',participantId:pc.id,value:'Bénédiction'},player);
  for(const data of [{type:'start'},{type:'finish',confirmed:true},{type:'visible',participantId:npc.id,value:true},{type:'health',participantId:npc.id,action:{type:'damage',amount:1}},{type:'initiative',participantId:npc.id,value:20}])await assert.rejects(s.act(data,player),e=>e.status===403);
  assert.equal((await s.combats.get(player,s.group.id)).combat.participants[0].concentration,'Bénédiction');
});
test('Fiche détachée et membre exclu : aucune nouvelle lecture privée ou modification possible',async()=>{
  const s=await setup();await s.create();const pc=s.raw().combat.participants[0];await s.groups.attach(player,s.group.id,{characterId:null});
  const view=await s.get();assert.equal(view.combat.participants[0].unavailable,true);assert.equal(view.combat.participants[0].maxHp,undefined);
  await assert.rejects(s.act({type:'health',participantId:pc.id,characterRevision:pc.characterRevision,action:{type:'start',currentHp:1}}),e=>e.status===409);
  await s.groups.removeMember(mj,s.group.id,{userId:player.userId});await assert.rejects(s.combats.get(player,s.group.id),e=>e.status===404);
});
test('Fin confirmée : aucune remise à zéro de fiche, ancien combat conservé et nouveau combat possible',async()=>{
  const s=await setup();await s.create();const before=await s.characters.get(player.userId,s.id),oldId=s.raw().combat.id;
  await assert.rejects(s.act({type:'finish'}),e=>e.status===400);await s.act({type:'finish',confirmed:true});
  assert.equal(s.raw().combat.status,'finished');assert.deepEqual(await s.characters.get(player.userId,s.id),before);
  await assert.rejects(s.act({type:'next'}),e=>e.status===404);await s.create();assert.notEqual(s.raw().combat.id,oldId);assert.equal(s.collection.rows.length,2);
});
test('Combat sans PJ, valeurs invalides et import de nouveaux personnages sans doublons',async()=>{
  const s=await setup({attach:false});await s.create();await assert.rejects(s.act({type:'start'}),e=>e.status===400);
  await assert.rejects(s.act({type:'add-npc',name:'Faux',maxHp:0,ac:10}),e=>e.status===400);
  await s.groups.attach(player,s.group.id,{characterId:s.id});await s.act({type:'sync'});await s.act({type:'sync'});assert.equal(s.raw().combat.participants.length,1);
  await assert.rejects(s.initiative(s.raw().combat.participants[0],1000),e=>e.status===400);
});
test('Bestiaire : ajout multiple depuis la source serveur, PV indépendants et profils conservés',async()=>{
  const rows=bestiaryFixtures(),s=await setup({bestiaryRows:rows});await s.create();
  await s.act({type:'add-bestiary',monsterId:'goblin',quantity:2,maxHp:999,ac:99,bestiary:{name:'Faux'}});
  let npcs=s.raw().combat.participants.filter(p=>p.kind==='npc');assert.equal(npcs.length,2);assert.equal(npcs[0].name,'Gobelin 1');assert.equal(npcs[1].name,'Gobelin 2');
  assert(npcs.every(p=>p.maxHp===7&&p.ac===15&&p.visible===false&&p.initiative===null));assert.notEqual(npcs[0].id,npcs[1].id);
  await s.act({type:'health',participantId:npcs[0].id,action:{type:'damage',amount:3}});
  npcs=s.raw().combat.participants.filter(p=>p.kind==='npc');assert.deepEqual(npcs.map(p=>p.currentHp),[4,7]);
  rows[0].pv=21;await s.act({type:'add-bestiary',monsterId:'goblin',quantity:1});npcs=s.raw().combat.participants.filter(p=>p.kind==='npc');
  assert.deepEqual(npcs.map(p=>p.maxHp),[7,7,21]);assert.equal(npcs[2].name,'Gobelin 3');assert.equal(npcs[0].bestiary.maxHp,7);
  await s.act({type:'visible',participantId:npcs[0].id,value:true});const visible=(await s.combats.get(player,s.group.id)).combat.participants.find(p=>p.id===npcs[0].id);
  assert.equal(visible.bestiary,undefined);assert.equal(visible.maxHp,undefined);assert(!JSON.stringify(visible).includes('Cimeterre'));
});
test('Bestiaire : validation des quantités, autorisations et refus des profils incomplets sans ajout partiel',async()=>{
  const rows=bestiaryFixtures(),s=await setup({bestiaryRows:rows});await s.create();
  const add={type:'add-bestiary',monsterId:'goblin',quantity:1};
  await assert.rejects(s.act(add,player),e=>e.status===403);
  for(const quantity of [0,21,'2',1.5])await assert.rejects(s.act({...add,quantity}),e=>e.status===400);
  await assert.rejects(s.act({...add,monsterId:'missing'}),e=>e.status===404);
  rows[0].pv=null;await assert.rejects(s.act(add),e=>e.status===400);assert.equal(s.raw().combat.participants.length,1);
  const absent=await setup();await absent.create();await assert.rejects(absent.act(add),e=>e.status===503);
});
test('Bestiaire : limite globale, pause obligatoire et révision périmée empêchent les doubles ajouts',async()=>{
  const s=await setup({attach:false,bestiaryRows:bestiaryFixtures()});await s.create();const old={combatId:s.raw().combat.id,revision:s.raw().combat.revision,type:'add-bestiary',monsterId:'goblin',quantity:20};
  await s.combats.act(mj,s.group.id,old);await assert.rejects(s.combats.act(mj,s.group.id,old),e=>e.status===409);await s.get();
  for(let i=0;i<4;i++)await s.act({type:'add-bestiary',monsterId:'goblin',quantity:20});
  assert.equal(s.raw().combat.participants.length,100);assert.equal(new Set(s.raw().combat.participants.map(p=>p.name)).size,100);
  await assert.rejects(s.act({type:'add-bestiary',monsterId:'goblin',quantity:1}),e=>e.status===400);
  const small=await setup({attach:false,bestiaryRows:bestiaryFixtures()});await small.create();await small.act({type:'add-bestiary',monsterId:'goblin',quantity:1});await small.initiative(small.raw().combat.participants[0],12);await small.act({type:'start'});
  await assert.rejects(small.act({type:'add-bestiary',monsterId:'goblin',quantity:1}),e=>e.status===400);
});
