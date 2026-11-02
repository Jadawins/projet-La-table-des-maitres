// Only disposable control groups, combatants and character documents are written.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const [release,output,baseline]=process.argv.slice(2);
assert.match(release??'',/^\/var\/www\/myrpgtable\/refonte-access\/\d{8}T\d{6}Z$/);
assert.match(output??'',/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/attacks-(before|after)\.json$/);
const module=relative=>import(pathToFileURL(release+'/'+relative));
const {MongoClient,BSON}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
const db=client.db('myrpgtable'),controls=db.collection('refonte_attack_combats_controles'),groupControls=db.collection('refonte_attack_groupes_controles'),charControls=db.collection('refonte_controles');
const owner='attack-control-'+randomUUID(),mj={userId:owner},player={userId:owner+'-player'},characterId=randomUUID();
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
  if(baseline){assert.match(baseline,/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/attacks-before\.json$/);assert.deepEqual(before,JSON.parse(await readFile(baseline,'utf8')).realAfter);}
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
  let value=await combats.create(mj,groupId,{name:'Attaques de contrôle'});
  const act=async(data,actor=mj)=>value=await combats.act(actor,groupId,{combatId:value.combat.id,revision:value.combat.revision,...data});
  await act({type:'add-npc',name:'Adversaire de contrôle',maxHp:100,ac:12});
  const pc=value.combat.participants.find(p=>p.kind==='pc'),npc=value.combat.participants.find(p=>p.kind==='npc');
  await act({type:'visible',participantId:npc.id,value:true});
  await act({type:'health',participantId:pc.id,characterRevision:pc.characterRevision,action:{type:'start',currentHp:pc.maxHp}},player);
  for(const p of [pc,npc])await act({type:'initiative',participantId:p.id,value:15});
  await act({type:'start'});
  const options=await combats.attackOptions(player,groupId,pc.id),attack=options.attacks.find(a=>a.usable);
  assert(attack);assert.equal(options.customAllowed,false);
  const first=await combats.rollAttack(player,groupId,{combatId:options.combatId,revision:options.revision,attackerId:pc.id,targetId:npc.id,attackId:attack.id,mode:'physical',advantage:'advantage',dice:[1,20]});
  assert.equal(first.ticket.decision,'critical');assert.equal(first.ticket.targetAC,undefined);
  const physical=first.ticket.plan.dice.flatMap(d=>Array(d.count).fill(1));
  const ready=await combats.rollDamage(player,groupId,{ticketId:first.ticket.id,mode:'physical',dice:physical});
  assert.equal((await combats.get(mj,groupId)).combat.participants.find(p=>p.id===npc.id).currentHp,100);
  await assert.rejects(combats.confirmAttack(player,groupId,{ticketId:first.ticket.id,confirmed:true}),e=>e.status===403);
  const approvals=await Promise.all([combats.confirmAttack(mj,groupId,{ticketId:first.ticket.id,confirmed:true}),combats.confirmAttack(mj,groupId,{ticketId:first.ticket.id,confirmed:true})]);
  const amount=ready.ticket.damage.total;assert(approvals.every(r=>r.ticket.appliedDamage===amount));
  await combats.confirmAttack(mj,groupId,{ticketId:first.ticket.id,confirmed:true});
  assert.equal((await combats.get(mj,groupId)).combat.participants.find(p=>p.id===npc.id).currentHp,100-amount);
  const custom={name:'Attaque de contrôle',bonus:5,formula:'1d6+2',damageType:'perforants'};
  const roll=async(mode,dice,advantage='normal')=>{
    const o=await combats.attackOptions(mj,groupId,npc.id);
    return combats.rollAttack(mj,groupId,{combatId:o.combatId,revision:o.revision,attackerId:npc.id,targetId:pc.id,attackId:'custom',custom,mode,advantage,...(dice?{dice}:{})});
  };
  const second=await roll('physical',[18]);assert.equal(second.ticket.decision,'hit');
  const appDamage=await combats.rollDamage(mj,groupId,{ticketId:second.ticket.id,mode:'app'});
  assert(appDamage.ticket.damage.total>=3&&appDamage.ticket.damage.total<=8);
  assert.equal((await characters.get(player.userId,characterId)).character.playState.hpLost,0);
  await combats.confirmAttack(mj,groupId,{ticketId:second.ticket.id,confirmed:true});
  await combats.confirmAttack(mj,groupId,{ticketId:second.ticket.id,confirmed:true});
  assert.equal((await characters.get(player.userId,characterId)).character.playState.hpLost,appDamage.ticket.damage.total);
  const third=await roll('app',undefined,'advantage');assert.equal(third.ticket.roll.dice.length,2);
  await combats.rollDamage(mj,groupId,{ticketId:third.ticket.id,mode:'physical',outcome:'critical',reason:'Contrôle du chemin critique',dice:[1,1]});
  await combats.cancelAttack(mj,groupId,{ticketId:third.ticket.id});
  assert.equal((await characters.get(player.userId,characterId)).character.playState.hpLost,appDamage.ticket.damage.total);
  const after=await fingerprint();assert.deepEqual(after,before);
  const report={status:'passed',completedAt:new Date().toISOString(),checks:10,collection:'refonte_attack_combats_controles',realBefore:before,realAfter:after,realCharactersAndGroupsUnchanged:true,
    coverage:['physical-player-attack','critical-plan-and-detail','hidden-defense','mj-only-confirmation','no-health-before-confirmation','concurrent-and-repeated-confirmation','server-app-damage','strict-character-health-persistence','server-app-advantage','mixed-modes-and-cancellation']};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify({status:'passed',checks:10,realCharactersAndGroupsUnchanged:true}));
}finally{
  if(groupId){await controls.deleteMany({groupId});await groupControls.deleteMany({id:groupId});}
  await charControls.deleteMany({user_id:player.userId});await client.close();
}
