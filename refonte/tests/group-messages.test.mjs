import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createGroupStore} from '../access/group-store.mjs';import {createGroupMessages} from '../access/group-messages.mjs';import {groupMemory} from './group-memory.mjs';import {messageMemory} from './message-memory.mjs';
const mj={userId:'mj'},a={userId:'a'},b={userId:'b'},c={userId:'c'},otherMJ={userId:'other-mj'},outsider={userId:'outsider',isAdmin:true};
async function fixture(){const groups=createGroupStore({collection:groupMemory(),characters:{get:async()=>{throw Object.assign(Error('not found'),{status:404});}}});const created=await groups.create(mj,{name:'Les secrets de la table',alias:'MJ'}),id=created.group.id;
  for(const [actor,alias]of [[a,'Léa'],[b,'Boris'],[c,'Camille']])await groups.join(actor,{code:created.invitationCode,alias});await groups.join(otherMJ,{code:created.mjInvitationCode,role:'mj',alias:'Second MJ'});
  const rows=messageMemory(),messages=createGroupMessages({collection:rows,groups});return {groups,id,rows,messages,send:(body='Un secret',recipientIds=['a','b'],id=randomUUID())=>messages.send(mj,created.group.id,{id,body,recipientIds})};}
test('Envoi multiple privé : seuls expéditeur et destinataires voient le message ; lecture individuelle explicite',async()=>{
  const s=await fixture(),{message}=await s.send();assert.equal(message.recipients.length,2);assert.equal((await s.messages.pending(a)).unread,1);assert.equal((await s.messages.pending(b)).unread,1);assert.equal((await s.messages.pending(c)).unread,0);
  const received=await s.messages.get(a,message.id);assert.equal(received.message.body,'Un secret');assert.equal(received.message.recipients,undefined);assert.equal(received.message.senderId,undefined);assert.equal(received.message.readAt,null);
  assert.equal((await s.messages.history(otherMJ,s.id)).messages.length,0);await assert.rejects(s.messages.get(c,message.id),e=>e.status===404);await assert.rejects(s.messages.get(outsider,message.id),e=>e.status===404);
  await s.messages.read(a,message.id);await s.messages.read(a,message.id);assert.equal((await s.messages.pending(a)).unread,0);assert.equal((await s.messages.pending(b)).unread,1);assert.equal(s.rows.rows[0].revision,2);
});
test('Seuls les MJ peuvent envoyer, même si un joueur est créateur ou administrateur du site',async()=>{
  const s=await fixture();for(const actor of [a,{...a,isAdmin:true}])await assert.rejects(s.messages.send(actor,s.id,{id:randomUUID(),recipientIds:['b'],body:'Interdit'}),e=>e.status===403);
  const created=await s.groups.create(a,{name:'Table du joueur',alias:'Joueuse',role:'player'});await assert.rejects(s.messages.send(a,created.group.id,{id:randomUUID(),recipientIds:['b'],body:'Interdit'}),e=>e.status===403);
  await assert.rejects(s.messages.send(outsider,s.id,{id:randomUUID(),recipientIds:['a'],body:'Interdit'}),e=>e.status===404);assert.equal(s.rows.rows.length,0);
});
test('Validation des destinataires et du contenu avant toute écriture',async()=>{
  const s=await fixture();for(const change of [{id:'bad'},{recipientIds:[]},{recipientIds:['a','a']},{recipientIds:['mj']},{recipientIds:['foreign']},{recipientIds:[{$ne:null}]},{body:' '},{body:'a'.repeat(6001)},{body:{$ne:null}}])await assert.rejects(s.messages.send(mj,s.id,{id:randomUUID(),recipientIds:['a'],body:'Secret',...change}),e=>e.status===400);
  assert.equal(s.rows.rows.length,0);await assert.rejects(s.messages.get(a,{$ne:null}),e=>e.status===404);await assert.rejects(s.messages.get(null,randomUUID()),e=>e.status===401);
});
test('Envoi répété ou concurrent après perte d’accusé : une seule copie persistante',async()=>{
  const s=await fixture(),id=randomUUID();const results=await Promise.all([s.send('Secret',['a','b'],id),s.send('Secret',['b','a'],id)]);assert.equal(results[0].message.id,results[1].message.id);assert.equal(s.rows.rows.length,1);
  const reloaded=createGroupMessages({collection:s.rows,groups:s.groups});await reloaded.send(mj,s.id,{id,recipientIds:['a','b'],body:'Secret'});assert.equal(s.rows.rows.length,1);
  await assert.rejects(s.send('Autre contenu',['a','b'],id),e=>e.status===409);
});
test('Deux confirmations de lecture simultanées conservent les deux destinataires',async()=>{
  const s=await fixture(),{message}=await s.send();await Promise.all([s.messages.read(a,message.id),s.messages.read(b,message.id)]);assert.equal(s.rows.rows[0].unreadIds.length,0);assert(s.rows.rows[0].recipients.every(p=>p.readAt instanceof Date));await assert.rejects(s.messages.read(mj,message.id),e=>e.status===403);
});
test('Exclusion, départ et suppression du groupe révoquent la lecture et les notifications',async()=>{
  const s=await fixture(),{message}=await s.send();await s.groups.removeMember(mj,s.id,{userId:'a'});await assert.rejects(s.messages.get(a,message.id),e=>e.status===404);assert.equal((await s.messages.pending(a)).unread,0);
  await s.groups.leave(b,s.id);assert.equal((await s.messages.pending(b)).unread,0);
  const group=await s.groups.get(mj,s.id);await s.groups.remove(mj,s.id,{confirmed:true,revision:group.revision});await assert.rejects(s.messages.get(mj,message.id),e=>e.status===404);
});
test('Historique et notifications paginés : aucun destinataire absent de la sélection n’y accède',async()=>{
  const s=await fixture();for(let n=0;n<52;n++)await s.send('Secret '+n,['a']);
  const first=await s.messages.history(a,s.id);assert.equal(first.messages.length,50);assert.equal(first.hasMore,true);const rest=await s.messages.history(a,s.id,first.nextOffset);assert.equal(rest.messages.length,2);assert.equal(new Set([...first.messages,...rest.messages].map(m=>m.id)).size,52);
  const pending=await s.messages.pending(a);assert.equal(pending.messages.length,20);assert.equal(pending.unread,52);assert.equal((await s.messages.pending(a,pending.nextOffset)).messages.length,20);assert.equal((await s.messages.history(b,s.id)).messages.length,0);
  for(const offset of [-1,0.5,1000001,NaN])await assert.rejects(s.messages.history(a,s.id,offset),e=>e.status===400);
});
