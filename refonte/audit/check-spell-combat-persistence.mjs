// Real MongoDB checks use disposable collections only. Never mutate live groups or characters.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const [release,output,baseline]=process.argv.slice(2);
assert.match(release??'',/^\/var\/www\/myrpgtable\/refonte-access\/\d{8}T\d{6}Z$/);
assert.match(output??'',/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/spell-combat-(before|after)\.json$/);
const module=relative=>import(pathToFileURL(release+'/'+relative));
const {MongoClient,BSON}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
const db=client.db('myrpgtable'),controls=db.collection('refonte_spell_combats_controles'),groupControls=db.collection('refonte_spell_groupes_controles'),spellControls=db.collection('refonte_spell_resolutions_controles'),charControls=db.collection('refonte_controles');
const owner='spell-control-'+randomUUID(),mj={userId:owner},player={userId:owner+'-player'},characterId=randomUUID();
let groupId;
async function fingerprint(){
  const result={};
  for(const name of ['personnages_refonte','groupes_refonte','combats_refonte','sorts_combats_refonte','monstres','regles_catalogues']){
    const hash=createHash('sha256');let count=0;
    for await(const row of db.collection(name).find({}).sort({_id:1})){hash.update(JSON.stringify(BSON.EJSON.serialize(row,{relaxed:false})));count++;}
    result[name]={count,sha256:hash.digest('hex')};
  }
  return result;
}
try{
  const before=await fingerprint();
  if(baseline){assert.match(baseline,/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/spell-combat-before\.json$/);assert.deepEqual(before,JSON.parse(await readFile(baseline,'utf8')).realAfter);}
  const {loadRulesCatalogue}=await module('rules-store.mjs'),rulesRelease=JSON.parse(await readFile(release+'/rules-release.json','utf8'));
  const {catalogue,text}=await loadRulesCatalogue(db,rulesRelease);
  const {createCharacterStore}=await module('character-store.mjs'),{validateSavedCharacter}=await module('atelier/character-storage.mjs');
  const {createGroupStore}=await module('group-store.mjs'),{createCombatStore}=await module('combat-store.mjs');
  const {sheetModel}=await module('atelier/sheet-model.mjs'),{playView,applyPlayAction}=await module('atelier/play-state.mjs'),{classFixture}=await module('check-class-fixture.mjs');
  const characters=createCharacterStore({collection:charControls,validate:s=>validateSavedCharacter(s,catalogue),catalogueFingerprint:createHash('sha256').update(text).digest('hex')});
  const groups=createGroupStore({collection:groupControls,characters});
  const make=()=>createCombatStore({collection:controls,spellCollection:spellControls,spellCatalogue:catalogue.spells,groups,characters,sheetModel:s=>sheetModel(s,catalogue),playView,applyPlayAction});
  let combats=make();
  await controls.createIndex({id:1},{unique:true});await controls.createIndex({groupId:1},{unique:true,partialFilterExpression:{active:true}});await spellControls.createIndex({id:1},{unique:true});
  const state=classFixture(catalogue,'clerc',5,'clerc_domaine_vie');state.divineOrder='Protecteur';state.name='Lanceur de contrôle';
  state.playState=applyPlayAction(state,sheetModel(state,catalogue),{type:'start',currentHp:sheetModel(state,catalogue).hp});
  await characters.save(player.userId,characterId,state,0);
  const created=await groups.create(mj,{name:'Contrôle sorts',alias:'MJ de contrôle'});groupId=created.group.id;
  await groups.join(player,{code:created.invitationCode,alias:'Joueur de contrôle'});await groups.attach(player,groupId,{characterId});
  let value=await combats.create(mj,groupId,{name:'Sorts de contrôle'});
  const act=async data=>{value=await combats.get(mj,groupId);return value=await combats.act(mj,groupId,{combatId:value.combat.id,revision:value.combat.revision,...data});};
  await act({type:'add-npc',name:'Cible de contrôle',maxHp:100,ac:12});
  const pc=value.combat.participants.find(p=>p.kind==='pc'),npc=value.combat.participants.find(p=>p.kind==='npc');
  await act({type:'visible',participantId:npc.id,value:true});for(const p of [pc,npc])await act({type:'initiative',participantId:p.id,value:15});await act({type:'start'});
  const saved=()=>characters.get(player.userId,characterId);
  const prepare=async id=>{
    const options=await combats.spellOptions(player,groupId,pc.id),spell=options.spells.find(s=>s.id===id);assert(spell);
    return (await combats.spellPrepare(player,groupId,{combatId:options.combatId,revision:options.revision,casterId:pc.id,spellKey:spell.key,payment:spell.level?spell.slots[0].id:'cantrip',targetIds:[npc.id]})).cast;
  };
  const first=await prepare('flamme_sacree');assert.deepEqual((await saved()).character.playState.slotUsed,{});
  await combats.spellApprove(mj,groupId,{castId:first.id,completed:true,plan:{...first.spell.suggestions[0],rounds:0,note:'Contrôle sauvegarde'}});
  await combats.spellRoll(mj,groupId,{castId:first.id,targetId:npc.id,mode:'physical',dice:[1],bonus:0,reason:'Profil de contrôle'});
  await combats.spellDamage(player,groupId,{castId:first.id,mode:'physical',dice:[1,1]});
  assert.equal((await combats.get(mj,groupId)).combat.participants.find(p=>p.id===npc.id).currentHp,100);
  await assert.rejects(combats.spellConfirm(player,groupId,{castId:first.id,targetId:npc.id,confirmed:true}),e=>e.status===403);
  await combats.spellConfirm(mj,groupId,{castId:first.id,targetId:npc.id,confirmed:true});await combats.spellConfirm(mj,groupId,{castId:first.id,targetId:npc.id,confirmed:true});
  assert.equal((await combats.get(mj,groupId)).combat.participants.find(p=>p.id===npc.id).currentHp,98);
  const cancelled=await prepare('soins');await combats.spellEnd(player,groupId,{castId:cancelled.id});assert.deepEqual((await saved()).character.playState.slotUsed,{});
  let fresh=await saved();await act({type:'health',participantId:pc.id,characterRevision:fresh.revision,action:{type:'damage',amount:10}});
  const heal=await prepare('soins');
  const write=characters.applyCombatPatch.bind(characters);let lose=true;
  characters.applyCombatPatch=async(...args)=>{const result=await write(...args);if(lose){lose=false;throw Error('Control: acknowledgement lost');}return result;};
  await assert.rejects(combats.spellApprove(mj,groupId,{castId:heal.id,completed:true,targetIds:[pc.id],plan:{...heal.spell.suggestions[1],rounds:0,note:'Soin de contrôle'}}));
  assert.equal((await saved()).character.playState.slotUsed['spell-1'],1);
  combats=make();await combats.spellRetry(mj,groupId,{castId:heal.id});assert.equal((await saved()).character.playState.slotUsed['spell-1'],1);
  const damage=(await combats.spellDamage(player,groupId,{castId:heal.id,mode:'app'})).cast.damage;
  const expected=Math.max(0,10-damage.total);lose=true;
  await assert.rejects(combats.spellConfirm(mj,groupId,{castId:heal.id,targetId:pc.id,confirmed:true}));
  combats=make();await combats.spellRetry(mj,groupId,{castId:heal.id});await combats.spellConfirm(mj,groupId,{castId:heal.id,targetId:pc.id,confirmed:true});
  assert.equal((await saved()).character.playState.hpLost,expected);assert.equal((await saved()).character.playState.slotUsed['spell-1'],1);
  const concentration=await prepare('assistance');await combats.spellApprove(mj,groupId,{castId:concentration.id,completed:true,reason:'Effet suivi à la table',plan:{...concentration.spell.suggestions[0],rounds:10,note:'Bonus choisi à la table'}});
  await combats.spellConfirm(mj,groupId,{castId:concentration.id,targetId:npc.id,confirmed:true});
  const event={castId:concentration.id,eventId:randomUUID(),targetIds:[pc.id],reason:'Autre bénéficiaire confirmé par MJ'};
  const child=(await combats.spellPulse(mj,groupId,event)).cast;assert.equal((await combats.spellPulse(mj,groupId,event)).cast.id,child.id);
  await combats.spellConfirm(mj,groupId,{castId:child.id,targetId:pc.id,confirmed:true});
  fresh=await saved();await act({type:'health',participantId:pc.id,characterRevision:fresh.revision,action:{type:'damage',amount:1}});
  const check=(await saved()).character.playState.concentration.checks[0];assert(check);assert.equal(check.dc,10);
  await combats.spellConcentration(player,groupId,{castId:concentration.id,checkId:check.id,mode:'physical',dice:[1]});
  fresh=await saved();assert.equal(fresh.character.playState.concentration,null);assert.equal(fresh.character.playState.magicEffects.length,0);
  assert.equal((await combats.get(mj,groupId)).combat.participants.find(p=>p.id===npc.id).magicEffects.length,0);
  const after=await fingerprint();assert.deepEqual(after,before);
  const report={status:'passed',completedAt:new Date().toISOString(),checks:12,realBefore:before,realAfter:after,realDataUnchanged:true,coverage:['canonical-prepared-spells','physical-save-and-damage','no-health-before-mj-confirmation','player-cannot-confirm','repeat-confirmation-idempotent','cancel-without-cost','lost-cost-ack-and-restart','server-dice-healing','lost-heal-ack-and-restart','persistent-trigger-idempotent','concentration-save','source-effects-cleanup']};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify({status:'passed',checks:12,realDataUnchanged:true}));
}finally{
  if(groupId){await controls.deleteMany({groupId});await groupControls.deleteMany({id:groupId});await spellControls.deleteMany({groupId});}
  await charControls.deleteMany({user_id:player.userId});await client.close();
}
