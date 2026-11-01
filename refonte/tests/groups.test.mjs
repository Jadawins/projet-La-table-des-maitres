import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createGroupStore} from '../access/group-store.mjs';
import {groupMemory} from './group-memory.mjs';
const mj={userId:'mj'}, player={userId:'player'}, outsider={userId:'outsider'};
function setup() {
  const collection=groupMemory(),saved=new Map(); let clock=new Date('2026-11-01T12:00:00Z');
  const characters={async get(owner,id){const row=saved.get(owner+':'+id);if(!row)throw Object.assign(Error('missing'),{status:404});return structuredClone(row);}};
  const store=createGroupStore({collection,characters,now:()=>clock});
  const create=()=>store.create(mj,{name:'Les Dés libres',alias:'Wiwi',description:'Une table'});
  return {collection,saved,store,create,advance:()=>{clock=new Date(clock.getTime()+8*86400000);}};
}
test('Création : le créateur est MJ et aucun secret ne figure dans la fiche ou la liste',async()=>{
  const {create,store,collection}=setup(),result=await create();
  assert(result.group.isMJ);assert.match(result.invitationCode,/^[A-F0-9]{16}$/);
  assert.equal(result.group.members[0].alias,'Wiwi');
  assert(!JSON.stringify(collection.rows).includes(result.invitationCode));
  assert(!JSON.stringify(await store.get(mj,result.group.id)).includes('inviteHash'));
  assert.equal((await store.list(mj)).length,1);assert.deepEqual(await store.list(outsider),[]);
  await assert.rejects(store.get(outsider,result.group.id),e=>e.status===404);
});
test('Rejoindre : identité du serveur, code insensible à la casse et adhésion sans doublon',async()=>{
  const {create,store}=setup(),{group,invitationCode}=await create();
  const joined=await store.join(player,{code:' '+invitationCode.toLowerCase()+' ',alias:'Aline',userId:'mj',isMJ:true});
  assert.equal(joined.isMJ,false);assert.equal(joined.members.length,2);assert.equal(joined.members[1].userId,'player');
  assert.equal((await store.join(player,{code:invitationCode,alias:'Autre'})).members.length,2);
  assert.equal((await store.list(player))[0].id,group.id);
  assert.equal(joined.inviteExpiresAt,undefined);
});
test('Code invalide, expiré ou désactivé : aucun accès au groupe',async()=>{
  const {create,store,advance}=setup(),{group,invitationCode}=await create();
  for(const code of ['', 'bad', '0000000000000000'])await assert.rejects(store.join(player,{code,alias:'Aline'}),e=>e.status===404);
  advance();await assert.rejects(store.join(player,{code:invitationCode,alias:'Aline'}),e=>e.status===404);
  assert.equal((await store.get(mj,group.id)).invitationOpen,false);
});
test('Renouveler ou fermer un code est réservé au MJ et préserve les membres',async()=>{
  const {create,store}=setup(),{group,invitationCode}=await create();await store.join(player,{code:invitationCode,alias:'Aline'});
  await assert.rejects(store.rotate(player,group.id),e=>e.status===403);
  await assert.rejects(store.closeInvitation(player,group.id),e=>e.status===403);
  const fresh=await store.rotate(mj,group.id);assert.notEqual(fresh.invitationCode,invitationCode);
  await assert.rejects(store.join(outsider,{code:invitationCode,alias:'Autre'}),e=>e.status===404);
  await store.closeInvitation(mj,group.id);
  await assert.rejects(store.join(outsider,{code:fresh.invitationCode,alias:'Autre'}),e=>e.status===404);
  assert.equal((await store.get(player,group.id)).members.length,2);
});
test('Rattachement : fiche prête appartenant au joueur, jamais une copie ni un transfert',async()=>{
  const {create,store,saved}=setup(),{group,invitationCode}=await create();await store.join(player,{code:invitationCode,alias:'Aline'});
  const id=randomUUID();saved.set('player:'+id,{id,status:'ready',character:{name:'Héroïne',classId:'barde',level:3,details:{story:'Privé'},playState:{hpLost:5}}});
  const before=JSON.stringify([...saved]);const result=await store.attach(player,group.id,{characterId:id});
  assert.equal(result.members[1].character.name,'Héroïne');assert.equal(JSON.stringify([...saved]),before);
  assert(!JSON.stringify(result).includes('Privé'));assert(!JSON.stringify(result).includes('hpLost'));
  await assert.rejects(store.attach(mj,group.id,{characterId:id}),e=>e.status===404);
  await assert.rejects(store.attach(outsider,group.id,{characterId:id}),e=>e.status===404);
  await store.attach(player,group.id,{characterId:null});assert.equal((await store.get(mj,group.id)).members[1].character,null);
});
test('Fiche supprimée, transférée ou redevenue brouillon : pas de données périmées partagées',async()=>{
  const {create,store,saved}=setup(),{group}=await create();const id=randomUUID();
  saved.set('mj:'+id,{id,status:'draft',character:{name:'Brouillon'}});
  await assert.rejects(store.attach(mj,group.id,{characterId:id}),e=>e.status===400);
  saved.set('mj:'+id,{id,status:'ready',character:{name:'Personnage',classId:'barbare',level:1}});
  await store.attach(mj,group.id,{characterId:id});saved.delete('mj:'+id);
  assert((await store.get(mj,group.id)).members[0].characterUnavailable);
});
test('Quitter ou retirer un membre ne supprime pas sa fiche et ferme le code lors du retrait',async()=>{
  const {create,store}=setup(),{group,invitationCode}=await create();await store.join(player,{code:invitationCode,alias:'Aline'});
  await assert.rejects(store.leave(mj,group.id),e=>e.status===400);
  await assert.rejects(store.removeMember(player,group.id,{userId:'mj'}),e=>e.status===403);
  await assert.rejects(store.removeMember(mj,group.id,{userId:'mj'}),e=>e.status===400);
  await store.removeMember(mj,group.id,{userId:'player'});
  await assert.rejects(store.get(player,group.id),e=>e.status===404);
  await assert.rejects(store.join(player,{code:invitationCode,alias:'Aline'}),e=>e.status===404);
  const fresh=await store.rotate(mj,group.id);await store.join(player,{code:fresh.invitationCode,alias:'Aline'});
  await store.leave(player,group.id);assert.deepEqual(await store.list(player),[]);
});
test('Archivage réservé au MJ : groupe et invitation inaccessibles, document conservé',async()=>{
  const {create,store,collection}=setup(),{group,invitationCode}=await create();await store.join(player,{code:invitationCode,alias:'Aline'});
  await assert.rejects(store.archive(player,group.id),e=>e.status===403);await store.archive(mj,group.id);
  assert(collection.rows[0].archivedAt);assert.equal(collection.rows.length,1);
  await assert.rejects(store.get(mj,group.id),e=>e.status===404);
  await assert.rejects(store.join(outsider,{code:invitationCode,alias:'Autre'}),e=>e.status===404);
  assert.deepEqual(await store.list(mj),[]);
});
test('Deux inscriptions concurrentes ne perdent pas de membre : conflit explicite puis reprise',async()=>{
  const {create,store}=setup(),{group,invitationCode}=await create();
  const join=actor=>store.join(actor,{code:invitationCode,alias:actor.userId});
  const results=await Promise.allSettled([join(player),join(outsider)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  const failed=results.findIndex(x=>x.status==='rejected');assert.equal(results[failed].reason.status,409);
  await join([player,outsider][failed]);assert.equal((await store.get(mj,group.id)).members.length,3);
});
test('Validation des formulaires, limites et absence de session',async()=>{
  const {store,create,collection}=setup();
  for(const input of [{name:' ',alias:'Wiwi'},{name:'A',alias:'x'},{name:'A'.repeat(101),alias:'Wiwi'},{name:'A',alias:'Wiwi',description:'x'.repeat(2001)}])await assert.rejects(store.create(mj,input),e=>e.status===400);
  await assert.rejects(store.list(null),e=>e.status===401);
  const {group,invitationCode}=await create();collection.rows[0].members.push(...Array.from({length:49},(_,i)=>({userId:'member-'+i,alias:'Membre'})));
  await assert.rejects(store.join(player,{code:invitationCode,alias:'Aline'}),e=>e.status===409);
  await assert.rejects(store.get(mj,'bad'),e=>e.status===404);
  await assert.rejects(store.attach(mj,group.id,{characterId:'bad'}),e=>e.status===400);
});
