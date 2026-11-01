// The live bestiary is read only. Only disposable groups and combats are written.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const [release,output,baseline]=process.argv.slice(2);
assert.match(release??'',/^\/var\/www\/myrpgtable\/refonte-access\/\d{8}T\d{6}Z$/);
assert.match(output??'',/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/bestiary-(before|after)\.json$/);
const from=relative=>import(pathToFileURL(release+'/'+relative));
const {MongoClient,BSON}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
const db=client.db('myrpgtable'),controls=db.collection('refonte_bestiary_combats_controles'),groupControls=db.collection('refonte_bestiary_groupes_controles');
const owner='bestiary-control-'+randomUUID(),mj={userId:owner},player={userId:owner+'-player'};let groupId;
async function fingerprint(){
  const result={};for(const name of ['personnages_refonte','groupes_refonte','combats_refonte','monstres']){
    let count=0;const hash=createHash('sha256');for await(const row of db.collection(name).find({}).sort({_id:1})){hash.update(JSON.stringify(BSON.EJSON.serialize(row,{relaxed:false})));count++;}
    result[name]={count,sha256:hash.digest('hex')};
  }return result;
}
try{
  const before=await fingerprint();
  if(baseline){assert.match(baseline,/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/bestiary-before\.json$/);assert.deepEqual(before,JSON.parse(await readFile(baseline,'utf8')).realAfter);}
  const {createBestiaryStore,normalizeBestiaryMonster}=await from('bestiary-store.mjs');
  const {createGroupStore}=await from('group-store.mjs'),{createCombatStore}=await from('combat-store.mjs');
  const {playView,applyPlayAction}=await from('atelier/play-state.mjs');
  const source=db.collection('monstres'),raw=await source.find({}).toArray(),profiles=raw.map(normalizeBestiaryMonster);
  assert(raw.length>0);assert(profiles.every(p=>p?.usable));
  const bestiary=createBestiaryStore({collection:source}),directory=await bestiary.search();assert.equal(directory.available,raw.length);
  const found=[];for(let offset=0;offset<directory.total;offset+=40)found.push(...(await bestiary.search({offset})).monsters);
  assert.equal(new Set(found.map(p=>p.id)).size,raw.length);
  const goblin=await bestiary.get('goblin',{fresh:true}),original=raw.find(r=>r.slug==='goblin');assert(original);assert.equal(goblin.maxHp,original.pv);assert.equal(goblin.ac,original.ca);
  assert((await bestiary.search({q:'goblin'})).monsters.some(p=>p.id==='goblin'));
  assert((await bestiary.search({q:'GOBELIN'})).monsters.some(p=>p.id==='goblin'));
  const characters={async get(){throw Object.assign(Error('not a test character'),{status:404});}};
  const groups=createGroupStore({collection:groupControls,characters});
  const combats=createCombatStore({collection:controls,groups,characters,bestiary,sheetModel:()=>({}),playView,applyPlayAction});
  await controls.createIndex({id:1},{unique:true});await controls.createIndex({groupId:1},{unique:true,partialFilterExpression:{active:true}});
  const created=await groups.create(mj,{name:'Contrôle bestiaire',alias:'MJ de contrôle'});groupId=created.group.id;
  await groups.join(player,{code:created.invitationCode,alias:'Joueur de contrôle'});
  let value=await combats.create(mj,groupId,{name:'Import bestiaire de contrôle'});
  const act=async(data,actor=mj)=>value=await combats.act(actor,groupId,{combatId:value.combat.id,revision:value.combat.revision,...data});
  await assert.rejects(act({type:'add-bestiary',monsterId:goblin.id,quantity:1},player),e=>e.status===403);
  await act({type:'add-bestiary',monsterId:goblin.id,quantity:2,maxHp:999,ac:99});
  let [a,b]=value.combat.participants;assert.equal(a.maxHp,original.pv);assert.equal(a.ac,original.ca);assert.equal(b.maxHp,original.pv);assert.notEqual(a.id,b.id);
  assert.equal(a.initiative,null);assert.equal(a.visible,false);assert.equal(a.bestiary.fingerprint,goblin.fingerprint);
  assert.equal((await combats.get(player,groupId)).combat.participants.length,0);
  await act({type:'health',participantId:a.id,action:{type:'damage',amount:1}});[a,b]=value.combat.participants;
  assert.equal(a.currentHp,original.pv-1);assert.equal(b.currentHp,original.pv);
  assert.equal((await combats.get(mj,groupId)).combat.participants[0].bestiary.fingerprint,goblin.fingerprint);
  await act({type:'visible',participantId:a.id,value:true});const exposed=(await combats.get(player,groupId)).combat.participants[0];assert.equal(exposed.bestiary,undefined);assert.equal(exposed.maxHp,undefined);
  await act({type:'initiative',participantId:a.id,value:15});await act({type:'initiative',participantId:b.id,value:10});await act({type:'start'});
  await assert.rejects(act({type:'add-bestiary',monsterId:goblin.id,quantity:1}),e=>e.status===400);
  const after=await fingerprint();assert.deepEqual(after,before);
  const report={status:'passed',completedAt:new Date().toISOString(),checks:9,availableMonsters:directory.available,usableProfiles:profiles.length,monstersWithAttacks:profiles.filter(p=>p.attacks.length).length,
    collection:'refonte_bestiary_combats_controles',realBefore:before,realAfter:after,realCharactersGroupsCombatsAndBestiaryUnchanged:true,
    coverage:['all-live-profiles-normalize','pagination-without-loss','french-and-english-search','server-side-stats-and-bulk-add','independent-hit-points','persisted-profile-snapshot','player-secrecy','group-role-and-pause-permissions','read-only-live-bestiary']};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify({status:'passed',checks:9,availableMonsters:directory.available,realDataUnchanged:true}));
}finally{if(groupId){await controls.deleteMany({groupId});await groupControls.deleteMany({id:groupId});}await client.close();}
