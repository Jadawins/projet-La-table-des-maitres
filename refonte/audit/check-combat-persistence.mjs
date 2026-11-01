// Only disposable control groups, combatants and character documents are written.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const [release,output,baseline]=process.argv.slice(2);
assert.match(release??'',/^\/var\/www\/myrpgtable\/refonte-access\/\d{8}T\d{6}Z$/);
assert.match(output??'',/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/combat-(before|after)\.json$/);
const module=relative=>import(pathToFileURL(release+'/'+relative));
const {MongoClient,BSON}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
const db=client.db('myrpgtable'),controls=db.collection('refonte_combats_controles'),groupControls=db.collection('refonte_groupes_combat_controles'),charControls=db.collection('refonte_controles');
const owner='combat-control-'+randomUUID(),mj={userId:owner},player={userId:owner+'-player'},characterId=randomUUID();
let groupId;
async function fingerprint(){
  const result={};
  for(const name of ['personnages_refonte','groupes_refonte','combats_refonte']){
    const hash=createHash('sha256');let count=0;
    for await(const row of db.collection(name).find({}).sort({_id:1})){hash.update(JSON.stringify(BSON.EJSON.serialize(row,{relaxed:false})));count++;}
    result[name]={count,sha256:hash.digest('hex')};
  }
  return result;
}
try{
  const before=await fingerprint();
  if(baseline){assert.match(baseline,/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/combat-before\.json$/);assert.deepEqual(before,JSON.parse(await readFile(baseline,'utf8')).realAfter);}
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
  const created=await groups.create(mj,{name:'Contrôle combat',alias:'MJ de contrôle'});groupId=created.group.id;
  await groups.join(player,{code:created.invitationCode,alias:'Joueur de contrôle'});await groups.attach(player,groupId,{characterId});
  let value=await combats.create(mj,groupId,{name:'Affrontement de contrôle'});
  const act=async(data,actor=mj)=>value=await combats.act(actor,groupId,{combatId:value.combat.id,revision:value.combat.revision,...data});
  await assert.rejects(combats.create(mj,groupId,{name:'Doublon'}),e=>e.status===409);
  await act({type:'add-npc',name:'Adversaire secret de contrôle',maxHp:12,ac:13});
  assert(!JSON.stringify(await combats.get(player,groupId)).includes('Adversaire secret de contrôle'));
  const pc=value.combat.participants.find(p=>p.kind==='pc'),npc=value.combat.participants.find(p=>p.kind==='npc');
  await act({type:'initiative',participantId:pc.id,value:15},player);await act({type:'initiative',participantId:npc.id,value:10});
  await act({type:'health',participantId:pc.id,characterRevision:pc.characterRevision,action:{type:'start',currentHp:pc.maxHp}},player);
  const previous=(await characters.get(player.userId,characterId)).revision;
  await act({type:'health',participantId:pc.id,characterRevision:previous,action:{type:'damage',amount:3}});
  assert.equal((await characters.get(player.userId,characterId)).character.playState.hpLost,3);
  await assert.rejects(act({type:'health',participantId:pc.id,characterRevision:previous,action:{type:'damage',amount:3}}),e=>e.status===409);
  await assert.rejects(act({type:'finish',confirmed:true},player),e=>e.status===403);
  await act({type:'start'});await act({type:'next'});await act({type:'next'});assert.equal(value.combat.round,2);
  await act({type:'pause'});assert.equal((await combats.get(mj,groupId)).combat.status,'paused');await act({type:'resume'});
  await act({type:'health',participantId:npc.id,action:{type:'set-condition',condition:'poisoned',active:true}});
  await act({type:'visible',participantId:npc.id,value:true});
  const visible=(await combats.get(player,groupId)).combat.participants.find(p=>p.id===npc.id);assert(visible);assert.equal(visible.maxHp,undefined);
  const strictRevision=(await characters.get(player.userId,characterId)).revision;
  const raceInput={type:'health',participantId:pc.id,characterRevision:strictRevision,action:{type:'damage',amount:3},combatId:value.combat.id,revision:value.combat.revision};
  const races=await Promise.allSettled([combats.act(mj,groupId,raceInput),combats.act(player,groupId,raceInput)]);
  assert.equal(races.filter(r=>r.status==='fulfilled').length,1);assert.equal(races.find(r=>r.status==='rejected').reason.status,409);
  value=await combats.get(mj,groupId);
  await act({type:'finish',confirmed:true});assert.equal((await characters.get(player.userId,characterId)).character.playState.hpLost,6);
  const after=await fingerprint();assert.deepEqual(after,before);
  const report={status:'passed',completedAt:new Date().toISOString(),checks:11,collection:'refonte_combats_controles',realBefore:before,realAfter:after,realCharactersAndGroupsUnchanged:true,
    coverage:['group-roles','one-active-combat','hidden-participants','manual-initiative','character-health-persistence','stale-character-revision','identical-concurrent-damage','turns-and-rounds','pause-and-resume','conditions-and-visibility','finish-without-healing']};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify({status:'passed',checks:11,realCharactersAndGroupsUnchanged:true}));
}finally{
  if(groupId){await controls.deleteMany({groupId});await groupControls.deleteMany({id:groupId});}
  await charControls.deleteMany({user_id:player.userId});await client.close();
}
