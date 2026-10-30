// Run only against an explicitly supplied, packaged release. Real characters are read, never written.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const release=process.argv[2],output=process.argv[3],baselineFile=process.argv[4];
assert.match(release??'',/^\/var\/www\/myrpgtable\/refonte-access\/\d{8}T\d{6}Z$/);
assert.match(output??'',/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/persistence-(?:before|after)\.json$/);
const fromRelease=relative=>import(pathToFileURL(path.join(release,relative)).href);
const {createCharacterStore}=await fromRelease('character-store.mjs');
const {validateSavedCharacter}=await fromRelease('atelier/character-storage.mjs');
const {classFixture}=await fromRelease('check-class-fixture.mjs');
const {MongoClient,BSON}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const rulesRelease=JSON.parse(await readFile(path.join(release,'rules-release.json'),'utf8'));
const {loadRulesCatalogue}=await fromRelease('rules-store.mjs');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
const db=client.db('myrpgtable'),real=db.collection('personnages_refonte'),controls=db.collection('refonte_controles');
const {catalogue:c,text:catalogueText}=await loadRulesCatalogue(db,rulesRelease);
const {createAdminStore}=await fromRelease('admin-store.mjs');
const adminUsers=db.collection('refonte_comptes_controles');
const owner='deployment-control-'+randomUUID();
async function fingerprint(){
  const hash=createHash('sha256');let count=0;const youpi=[];
  for await(const row of real.find({}).sort({_id:1})){hash.update(JSON.stringify(BSON.EJSON.serialize(row,{relaxed:false})));count++;if(row.character?.name==='Youpi matin')youpi.push({level:row.character.level,revision:row.revision});}
  return {count,sha256:hash.digest('hex'),youpi};
}
try{
  const before=await fingerprint();
  if(baselineFile){assert.match(baselineFile,/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/persistence-before\.json$/);const baseline=JSON.parse(await readFile(baselineFile,'utf8'));assert.deepEqual(before,baseline.realCharactersAfter,'Real character documents changed since pre-deployment baseline');}
  await controls.createIndex({user_id:1,client_id:1},{unique:true});
  const store=createCharacterStore({collection:controls,validate:s=>validateSavedCharacter(s,c),catalogueFingerprint:createHash('sha256').update(catalogueText).digest('hex')});
  const journeys=[];
  for(const classId of ['barbare','rodeur','barde','druide'])for(const level of [3,20]){
    const sub=c.subclasses.find(s=>s.classe_parente===classId),id=randomUUID();
    const state=classFixture(c,classId,level,sub.id);state.name=`Contrôle déploiement ${classId} ${level}`;
    const created=await store.save(owner,id,state,0);assert.equal(created.status,'ready',created.issues?.join('; '));assert.equal(created.revision,1);
    assert.equal((await store.save(owner,id,state,0)).revision,1);
    const reopened=await store.get(owner,id);assert.equal(reopened.character.classId,classId);assert.equal(reopened.character.level,level);assert.equal(reopened.character.rulesVersion,'phb2024-2026-10-28');
    assert.deepEqual(reopened.character.classChoices,state.classChoices);
    state.details.story='Modification temporaire de contrôle';
    const updated=await store.save(owner,id,state,1);assert.equal(updated.revision,2);assert.equal((await store.get(owner,id)).character.details.story,state.details.story);
    await assert.rejects(store.get('another-'+owner,id),e=>e.status===404);
    await store.remove(owner,id,2);
    await assert.rejects(store.get(owner,id),e=>e.status===404);
    assert.equal((await store.list(owner)).some(p=>p.id===id),false);
    await assert.rejects(store.save(owner,id,state,2),e=>e.status===409);
    await store.remove(owner,id,2);
    journeys.push({classId,subclassId:sub.id,level,status:'passed'});
  }
  const target=owner+'-target';
  await adminUsers.insertMany([{supabase_id:owner,email:'source@example.test'},{supabase_id:target,email:'target@example.test'}]);
  const admin=createAdminStore({db:{collection:name=>name==='users'?adminUsers:controls},rulesVersion:rulesRelease.id});
  const actor={userId:owner,isAdmin:true},id=randomUUID(),copyId=randomUUID();
  const state=classFixture(c,'barbare',3,c.subclasses.find(s=>s.classe_parente==='barbare').id);
  await store.save(owner,id,state,0);
  const original=await store.get(owner,id),input={ownerId:owner,id,targetId:target,revision:1,mode:'copy',requestId:copyId};
  await admin.assign(actor,input);await admin.assign(actor,input);
  assert.deepEqual((await store.get(target,copyId)).character,original.character);
  assert.equal((await store.get(owner,id)).revision,1);
  await assert.rejects(admin.assign({...actor,isAdmin:false},input),e=>e.status===403);
  await assert.rejects(admin.assign(actor,{...input,revision:2}),e=>e.status===409);
  await admin.assign(actor,{...input,mode:'move',requestId:randomUUID()});
  await assert.rejects(store.get(owner,id),e=>e.status===404);
  assert.deepEqual((await store.get(target,id)).character,original.character);
  assert.equal((await store.get(target,id)).revision,2);
  assert.equal((await controls.findOne({user_id:target,client_id:id})).assignments[0].mode,'move');
  assert((await admin.directory(actor)).characters.some(row=>row.id===id&&row.ownerId===target));
  assert((await admin.overview(actor)).characters>=2);
  await controls.deleteMany({user_id:target});await adminUsers.deleteMany({supabase_id:{$in:[owner,target]}});
  const after=await fingerprint();assert.deepEqual(after,before,'Real character documents changed during synthetic checks');
  const report={status:'passed',release,completedAt:new Date().toISOString(),collection:'refonte_controles',adminAssignments:'copy, retry, permissions, stale revision, move, audit, directory, metrics passed',journeys,realCharactersBefore:before,realCharactersAfter:after};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'passed',journeys:journeys.length,realCharactersUnchanged:true,youpi:after.youpi}));
}finally{try{await controls.deleteMany({user_id:{$in:[owner,owner+'-target']}});await adminUsers.deleteMany({supabase_id:{$in:[owner,owner+'-target']}});}finally{await client.close();}}
