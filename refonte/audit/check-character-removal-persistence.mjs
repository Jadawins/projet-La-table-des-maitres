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
  const after=await fingerprint();assert.deepEqual(after,before,'Real character documents changed during synthetic checks');
  const report={status:'passed',release,completedAt:new Date().toISOString(),collection:'refonte_controles',journeys,realCharactersBefore:before,realCharactersAfter:after};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'passed',journeys:journeys.length,realCharactersUnchanged:true,youpi:after.youpi}));
}finally{try{await controls.deleteMany({user_id:owner});}finally{await client.close();}}
