// Exercise edits only on synthetic characters, using isolated collections.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const [release,output,baseline]=process.argv.slice(2);
assert.match(release??'',/^\/var\/www\/myrpgtable\/refonte-access\/\d{8}T\d{6}Z$/);
assert.match(output??'',/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/admin-characters-(before|after)\.json$/);
const module=p=>import(pathToFileURL(release+'/'+p));
const {MongoClient,BSON}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
const db=client.db('myrpgtable'),rows=db.collection('refonte_admin_fiches_controles'),users=db.collection('refonte_admin_comptes_controles');
const owner='admin-character-control-'+randomUUID(),actor={userId:owner+'-admin',isAdmin:true},id=randomUUID();
async function fingerprint(){const result={};for(const name of ['personnages_refonte','groupes_refonte','combats_refonte','sorts_combats_refonte','monstres','regles_catalogues']){const hash=createHash('sha256');let count=0;for await(const row of db.collection(name).find({}).sort({_id:1})){hash.update(JSON.stringify(BSON.EJSON.serialize(row,{relaxed:false})));count++;}result[name]={count,sha256:hash.digest('hex')};}return result;}
try{
  const before=await fingerprint();if(baseline){assert.match(baseline,/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/admin-characters-before\.json$/);assert.deepEqual(before,JSON.parse(await readFile(baseline,'utf8')).realAfter);}
  const {loadRulesCatalogue}=await module('rules-store.mjs'),rules=JSON.parse(await readFile(release+'/rules-release.json','utf8')),{catalogue,text}=await loadRulesCatalogue(db,rules);
  const {createCharacterStore}=await module('character-store.mjs'),{createAdminStore}=await module('admin-store.mjs'),{validateSavedCharacter}=await module('atelier/character-storage.mjs'),{classFixture}=await module('check-class-fixture.mjs');
  await rows.createIndex({user_id:1,client_id:1},{unique:true});await users.insertOne({supabase_id:owner,email:'control@example.test'});
  const characters=createCharacterStore({collection:rows,validate:s=>validateSavedCharacter(s,catalogue),catalogueFingerprint:createHash('sha256').update(text).digest('hex')});
  const admin=createAdminStore({db:{collection:name=>name==='users'?users:rows},rulesVersion:rules.id,characterStore:characters});
  const state=classFixture(catalogue,'clerc',3,'clerc_domaine_vie');state.divineOrder='Protecteur';state.name='Fiche de contrôle administrateur';
  const first=await characters.save(owner,id,state,0);await rows.updateOne({user_id:owner,client_id:id},{$set:{combat_receipts:{control:true}}});
  const read=await admin.character(actor,owner,id);assert.deepEqual(read.character,first.character);assert.equal(read.owner.id,owner);assert.equal(read.combat_receipts,undefined);
  await assert.rejects(admin.character({userId:owner},owner,id),e=>e.status===403);await assert.rejects(admin.editCharacter({userId:owner},owner,id,{character:read.character,revision:1}),e=>e.status===403);
  await assert.rejects(characters.get(actor.userId,id),e=>e.status===404);
  const edited=await admin.editCharacter(actor,owner,id,{character:{...read.character,details:{story:'Ajout de contrôle par le MJ.'}},revision:1});assert.equal(edited.revision,2);
  const stored=await rows.findOne({user_id:owner,client_id:id});assert.equal(stored.character.details.story,'Ajout de contrôle par le MJ.');assert.equal(stored.admin_edits[0].by,actor.userId);assert.equal(stored.admin_edits[0].fromRevision,1);assert.equal(stored.combat_receipts.control,true);assert.equal(await rows.countDocuments({client_id:id}),1);
  await characters.save(owner,id,{...edited.character,name:'Correction du joueur de contrôle'},2);
  await assert.rejects(admin.editCharacter(actor,owner,id,{character:edited.character,revision:2}),e=>e.status===409);assert.equal((await characters.get(owner,id)).character.name,'Correction du joueur de contrôle');
  await assert.rejects(admin.editCharacter(actor,owner,id,{character:{...edited.character,level:99},revision:3}),e=>e.status===400);
  await assert.rejects(admin.editCharacter(actor,owner+'-missing',id,{character:edited.character,revision:3}),e=>e.status===409);
  await characters.remove(owner,id,3);await assert.rejects(admin.character(actor,owner,id),e=>e.status===404);await assert.rejects(admin.editCharacter(actor,owner,id,{character:edited.character,revision:4}),e=>e.status===409);
  const after=await fingerprint();assert.deepEqual(after,before);
  const report={status:'passed',completedAt:new Date().toISOString(),checks:10,realBefore:before,realAfter:after,realDataUnchanged:true,coverage:['admin-full-read-without-internal-metadata','non-admin-read-and-write-refused','no-character-moved-to-admin','validated-edit-in-owner-account','atomic-admin-edit-journal','combat-receipts-preserved','concurrent-player-edit-protected','invalid-state-refused','missing-owner-never-created','deleted-character-never-restored']};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify({status:'passed',checks:10,realDataUnchanged:true}));
}finally{await rows.deleteMany({user_id:owner});await users.deleteMany({supabase_id:owner});await client.close();}
