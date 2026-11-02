// Only disposable control groups, combatants and character documents are written.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const [release,output,baseline]=process.argv.slice(2);
assert.match(release??'',/^\/var\/www\/myrpgtable\/refonte-access\/\d{8}T\d{6}Z$/);
assert.match(output??'',/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/group-options-(before|after)\.json$/);
const module=relative=>import(pathToFileURL(release+'/'+relative));
const {MongoClient,BSON}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
const db=client.db('myrpgtable'),controls=db.collection('refonte_group_options_combats_controles'),groupControls=db.collection('refonte_group_options_controles'),charControls=db.collection('refonte_controles');
const owner='group-options-control-'+randomUUID(),mj={userId:owner},player={userId:owner+'-player'},characterId=randomUUID();
let groupId;
async function fingerprint(){
  const result={};
  for(const name of ['personnages_refonte','groupes_refonte','combats_refonte','monstres']){
    const hash=createHash('sha256');let count=0;
    for await(const row of db.collection(name).find({}).sort({_id:1})){hash.update(JSON.stringify(BSON.EJSON.serialize(row,{relaxed:false})));count++;}
    result[name]={count,sha256:hash.digest('hex')};
  }
  return result;
}
try{
  const before=await fingerprint();
  if(baseline){assert.match(baseline,/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/group-options-before\.json$/);assert.deepEqual(before,JSON.parse(await readFile(baseline,'utf8')).realAfter);}
  const {loadRulesCatalogue}=await module('rules-store.mjs'),releaseRules=JSON.parse(await readFile(release+'/rules-release.json','utf8'));
  const {catalogue,text}=await loadRulesCatalogue(db,releaseRules);
  const {createCharacterStore}=await module('character-store.mjs'),{validateSavedCharacter}=await module('atelier/character-storage.mjs');
  const {createGroupStore}=await module('group-store.mjs'),{createCombatStore}=await module('combat-store.mjs');
  const {sheetModel}=await module('atelier/sheet-model.mjs'),{playView,applyPlayAction}=await module('atelier/play-state.mjs');
  const {classFixture}=await module('check-class-fixture.mjs');
  const characters=createCharacterStore({collection:charControls,validate:s=>validateSavedCharacter(s,catalogue),catalogueFingerprint:createHash('sha256').update(text).digest('hex')});
  const groups=createGroupStore({collection:groupControls,characters});
  const combats=createCombatStore({collection:controls,groups,characters,sheetModel:s=>sheetModel(s,catalogue),playView,applyPlayAction});
  await controls.createIndex({id:1},{unique:true});await controls.createIndex({groupId:1},{unique:true,partialFilterExpression:{active:true}});
  const state=classFixture(catalogue,'barbare',3,catalogue.subclasses.find(s=>s.classe_parente==='barbare').id);
  state.name='Personnage de contrôle combat';await characters.save(player.userId,characterId,state,0);
  const creator=player,gm=mj;
  const created=await groups.create(creator,{name:'Contrôle rôles et suppression',alias:'Joueur créateur',role:'player'});groupId=created.group.id;
  assert(created.group.isOwner);assert.equal(created.group.isMJ,false);
  await assert.rejects(groups.join(gm,{code:created.invitationCode,alias:'MJ invité',role:'mj'}),e=>e.status===404);
  const joined=await groups.join(gm,{code:created.mjInvitationCode,alias:'MJ invité',role:'mj'});assert(joined.isMJ);assert.equal(joined.isOwner,false);
  await groups.attach(creator,groupId,{characterId});
  await assert.rejects(combats.create(creator,groupId,{name:'Non autorisé'}),e=>e.status===403);
  let value=await combats.create(gm,groupId,{name:'Combat de contrôle'});
  const act=async data=>value=await combats.act(gm,groupId,{combatId:value.combat.id,revision:value.combat.revision,...data});
  await act({type:'add-npc',name:'Adversaire secret',maxHp:100,ac:12});
  assert(!JSON.stringify(await combats.get(creator,groupId)).includes('Adversaire secret'));
  const pc=value.combat.participants.find(p=>p.kind==='pc'),npc=value.combat.participants.find(p=>p.kind==='npc');
  for(const p of [pc,npc])await act({type:'initiative',participantId:p.id,value:15});await act({type:'start'});
  const o=await combats.attackOptions(gm,groupId,npc.id);
  const roll=await combats.rollAttack(gm,groupId,{combatId:o.combatId,revision:o.revision,attackerId:npc.id,targetId:pc.id,attackId:'custom',custom:{name:'Test',bonus:10,formula:'1d6+2'},mode:'physical',dice:[20]});
  await combats.rollDamage(gm,groupId,{ticketId:roll.ticket.id,mode:'physical',dice:[1,1]});
  const savedBefore=await characters.get(creator.userId,characterId),current=await groups.get(creator,groupId);
  await assert.rejects(groups.remove(gm,groupId,{confirmed:true,revision:current.revision}),e=>e.status===403);
  await assert.rejects(groups.remove(creator,groupId,{revision:current.revision}),e=>e.status===400);
  await assert.rejects(groups.remove(creator,groupId,{confirmed:true,revision:1}),e=>e.status===409);
  const results=await Promise.allSettled([groups.remove(creator,groupId,{confirmed:true,revision:current.revision}),groups.remove(creator,groupId,{confirmed:true,revision:current.revision})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  for(const actor of [creator,gm]){assert.deepEqual(await groups.list(actor),[]);await assert.rejects(combats.get(actor,groupId),e=>e.status===404);}
  await assert.rejects(groups.join({userId:owner+'-other'},{code:created.mjInvitationCode,alias:'Autre',role:'mj'}),e=>e.status===404);
  await assert.rejects(groups.join({userId:owner+'-other'},{code:created.invitationCode,alias:'Autre',role:'player'}),e=>e.status===404);
  await assert.rejects(combats.confirmAttack(gm,groupId,{ticketId:roll.ticket.id,confirmed:true}),e=>e.status===404);
  assert.deepEqual(await characters.get(creator.userId,characterId),savedBefore);
  const tombstone=await groupControls.findOne({id:groupId});assert(tombstone.deletedAt);assert.equal(tombstone.mjInviteHash,null);assert.equal(tombstone.inviteHash,null);
  const after=await fingerprint();assert.deepEqual(after,before);
  const report={status:'passed',completedAt:new Date().toISOString(),checks:12,collection:'refonte_group_options_combats_controles',realBefore:before,realAfter:after,realCharactersAndGroupsUnchanged:true,
    coverage:['creator-as-player','distinct-mj-invitation','mj-joined-role','creator-not-combat-mj','hidden-combat-for-player','creator-only-removal','explicit-confirmation','stale-revision','concurrent-removal','closed-invitations-and-combat','pending-damage-blocked','character-unchanged']};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify({status:'passed',checks:12,realCharactersAndGroupsUnchanged:true}));
}finally{
  if(groupId){await controls.deleteMany({groupId});await groupControls.deleteMany({id:groupId});}
  await charControls.deleteMany({user_id:player.userId});await client.close();
}
