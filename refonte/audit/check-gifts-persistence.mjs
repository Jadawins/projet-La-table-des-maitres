import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const [release,output,baseline] = process.argv.slice(2);
assert.match(release ?? '',/^\/var\/www\/myrpgtable\/refonte-access\/\d{8}T\d{6}Z$/);
const reportPath = /^\/root\/backups\/myrpgtable-persistence-\d{8}T\d{6}Z\/gifts-(before|after)\.json$/;
assert.match(output ?? '',reportPath);
const load = file => import(pathToFileURL(release+'/'+file));
const {MongoClient,BSON}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
const db=client.db('myrpgtable');
const chars=db.collection('refonte_dons_fiches_controles');
const groupRows=db.collection('refonte_dons_groupes_controles');
const rows=db.collection('refonte_dons_resolutions_controles');
const prefix='gift-control-'+randomUUID();
const a={userId:prefix+'-a'},b={userId:prefix+'-b'},observer={userId:prefix+'-observer'};
const ids={a:randomUUID(),b:randomUUID()};
const itemId=randomUUID();
const coins=po=>({pc:0,pa:0,pe:0,po,pp:0});
let groupId;

async function realFingerprints() {
  const result={};
  for(const name of ['personnages_refonte','groupes_refonte','butins_groupes_refonte','dons_groupes_refonte','regles_catalogues']){
    const hash=createHash('sha256');
    let count=0;
    for await(const row of db.collection(name).find().sort({_id:1})){
      hash.update(JSON.stringify(BSON.EJSON.serialize(row,{relaxed:false})));
      count++;
    }
    result[name]={count,sha256:hash.digest('hex')};
  }
  return result;
}

try {
  await client.connect();
  const before=await realFingerprints();
  if(baseline){
    assert.match(baseline,reportPath);
    assert.deepEqual(before,JSON.parse(await readFile(baseline,'utf8')).realAfter);
  }
  const rules=JSON.parse(await readFile(release+'/rules-release.json','utf8'));
  const {loadRulesCatalogue}=await load('rules-store.mjs');
  const {catalogue,text}=await loadRulesCatalogue(db,rules);
  const {createCharacterStore}=await load('character-store.mjs');
  const {createGroupStore}=await load('group-store.mjs');
  const {createGroupGifts}=await load('group-gifts.mjs');
  const {validateSavedCharacter}=await load('atelier/character-storage.mjs');
  const {sheetModel}=await load('atelier/sheet-model.mjs');
  const {classFixture}=await load('check-class-fixture.mjs');
  const validate=state=>validateSavedCharacter(state,catalogue);
  await chars.createIndex({user_id:1,client_id:1},{unique:true});
  await groupRows.createIndex({id:1},{unique:true});
  await rows.createIndex({id:1},{unique:true});
  const characters=createCharacterStore({collection:chars,validate,catalogueFingerprint:createHash('sha256').update(text).digest('hex')});
  const groups=createGroupStore({collection:groupRows,characters});
  const created=await groups.create(a,{name:'Contrôle dons',alias:'Donneur',role:'player'});
  groupId=created.group.id;
  await groups.join(b,{code:created.invitationCode,alias:'Receveur'});
  await groups.join(observer,{code:created.invitationCode,alias:'Observateur'});
  for(const [actor,id,po] of [[a,ids.a,8],[b,ids.b,1]]){
    const state=classFixture(catalogue,'clerc',3,'clerc_domaine_vie',{divineOrder:'Protecteur'});
    state.name=actor===a?'Donneur de contrôle':'Receveur de contrôle';
    state.details={story:'Histoire conservée',languages:'Sylvestre'};
    state.startingLanguages=['elfique','nain'];
    state.wallet={version:1,coins:coins(po),history:[]};
    if(actor===a)state.inventoryItems=[{id:itemId,name:'Dague de contrôle',quantity:2,description:'Marque conservée',catalogueRef:'weapon:dague'}];
    const saved=await characters.save(actor.userId,id,state,0);
    assert.equal(saved.status,'ready');
    await groups.attach(actor,groupId,{characterId:id});
  }
  const make=(overrides={})=>createGroupGifts({collection:rows,groups,characters,catalogue,sheetModel:s=>sheetModel(s,catalogue),validate,...overrides});
  let gifts=make();
  const from=()=>characters.get(a.userId,ids.a);
  const to=()=>characters.get(b.userId,ids.b);
  const input=()=>({id:randomUUID(),sourceId:ids.a,targetId:ids.b,recipientId:b.userId,item:{ref:'item:'+itemId,quantity:1},coins:coins(3)});
  const propose=async body=>(await gifts.propose(a,groupId,body)).gift;
  const accept=async gift=>(await gifts.decide(b,groupId,gift.id,'accept',{revision:gift.revision})).gift;
  const first=input(),offer=await propose(first);
  assert.equal((await propose(first)).id,offer.id);
  assert.equal((await from()).revision,1);
  assert.equal((await to()).revision,1);
  assert.deepEqual((await gifts.history(observer,groupId)).gifts,[]);
  await assert.rejects(gifts.decide(a,groupId,offer.id,'accept',{revision:offer.revision}),e=>e.status===403);
  const refused=await propose(input());
  await gifts.decide(b,groupId,refused.id,'declined',{revision:refused.revision});
  assert.equal((await from()).revision,1);
  assert.equal((await accept(offer)).status,'done');
  assert.equal((await from()).character.wallet.coins.po,5);
  assert.equal((await to()).character.wallet.coins.po,4);
  assert.equal((await from()).character.inventoryItems[0].quantity,1);
  assert.equal((await to()).character.inventoryItems[0].description,'Marque conservée');
  assert.deepEqual((await to()).character.startingLanguages,['elfique','nain']);
  assert.equal((await accept(offer)).status,'done');
  assert.equal((await to()).revision,2);
  const second=await propose(input());
  gifts=make({characters:{...characters,async applyLoot(owner,...args){
    const result=await characters.applyLoot(owner,...args);
    if(owner===a.userId)throw Error('accusé du débit perdu');
    return result;
  }}});
  const pending=await accept(second);
  assert.equal(pending.status,'pending');
  assert.equal(pending.debited,true);
  const sourceAfterDebit=await from();
  assert.deepEqual(sourceAfterDebit.character.inventoryItems,[]);
  const currentGroup=await groups.get(a,groupId);
  await groups.remove(a,groupId,{confirmed:true,revision:currentGroup.revision});
  gifts=make();
  assert.equal((await gifts.pending(b)).gifts[0].id,pending.id);
  assert.equal((await gifts.resume(b,pending.id,{revision:pending.revision})).gift.status,'done');
  assert.deepEqual(await from(),sourceAfterDebit);
  assert.equal((await to()).character.wallet.coins.po,7);
  assert.equal((await to()).character.inventoryItems.length,2);
  assert.equal((await to()).character.details.story,'Histoire conservée');
  const after=await realFingerprints();
  assert.deepEqual(after,before);
  const coverage=[
    'offer-without-debit','idempotent-proposal','private-recipient-and-confirmation',
    'refusal-without-change','exact-items-and-coins','other-sheet-fields-preserved',
    'lost-debit-acknowledgement','resume-after-group-removal','real-data-unchanged',
  ];
  const report={status:'passed',checks:coverage.length,coverage,realBefore:before,realAfter:after};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({status:'passed',checks:coverage.length,realDataUnchanged:true}));
} finally {
  try {
    if(groupId){
      await rows.deleteMany({groupId});
      await groupRows.deleteMany({id:groupId});
    }
    await chars.deleteMany({client_id:{$in:Object.values(ids)}});
  } finally {await client.close();}
}
