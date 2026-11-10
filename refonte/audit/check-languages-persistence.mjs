import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const [release, output, baseline] = process.argv.slice(2);
assert.match(release ?? '', /^\/var\/www\/myrpgtable\/refonte-access\/\d{8}T\d{6}Z$/);
assert.match(output ?? '', /^\/root\/backups\/myrpgtable-persistence-\d{8}T\d{6}Z\/languages-(before|after)\.json$/);
const load = file => import(pathToFileURL(release + '/' + file));
const {MongoClient, BSON} = createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client = new MongoClient(process.env.MONGO_URI, {serverSelectionTimeoutMS:10000});
const db = client.db('myrpgtable');
const collection = db.collection('refonte_langues_fiches_controles');
const userId = 'languages-control-' + randomUUID();
const id = randomUUID();
const sha = value => createHash('sha256').update(value).digest('hex');

async function realFingerprints() {
  const result = {};
  for (const name of ['personnages_refonte','regles_catalogues']) {
    const hash = createHash('sha256');
    let count = 0;
    for await (const doc of db.collection(name).find().sort({_id:1})) {
      hash.update(BSON.EJSON.stringify(doc, {relaxed:false}));
      count++;
    }
    result[name] = {count, sha256:hash.digest('hex')};
  }
  return result;
}

try {
  await client.connect();
  const before = await realFingerprints();
  if (baseline) {
    assert.match(baseline, /^\/root\/backups\/myrpgtable-persistence-\d{8}T\d{6}Z\/languages-before\.json$/);
    assert.deepEqual(before, JSON.parse(await readFile(baseline, 'utf8')).realAfter);
  }
  const manifest = JSON.parse(await readFile(release + '/rules-release.json', 'utf8'));
  const {loadRulesCatalogue} = await load('rules-store.mjs');
  const {catalogue, text} = await loadRulesCatalogue(db, manifest);
  const {createCharacterStore} = await load('character-store.mjs');
  const {validateSavedCharacter, characterSnapshot} = await load('atelier/character-storage.mjs');
  const {pdfValues} = await load('atelier/character-pdf.mjs');
  const {classFixture} = await load('check-class-fixture.mjs');
  const store = createCharacterStore({collection, validate:state=>validateSavedCharacter(state,catalogue), catalogueFingerprint:sha(text)});
  await collection.createIndex({user_id:1,client_id:1},{unique:true});
  const state = classFixture(catalogue, 'clerc', 3, 'clerc_domaine_vie', {divineOrder:'Protecteur'});
  state.details = {languages:'Sylvestre', story:'Histoire conservée'};
  const first = await store.save(userId, id, state, 0);
  assert.equal(first.status, 'ready');
  assert.equal(first.character.startingLanguages, undefined);
  const change = characterSnapshot({...first.character, startingLanguages:['elfique','nain']});
  const saved = await store.save(userId, id, change, first.revision, {strictRevision:true, adminEdit:{by:'languages-control-admin'}});
  assert.deepEqual(saved.character, {...first.character, startingLanguages:['elfique','nain']});
  assert.equal(saved.status, 'ready');
  assert.deepEqual((await store.get(userId, id)).character.startingLanguages, ['elfique','nain']);
  assert.equal(pdfValues(saved.character,catalogue).text.languages, 'Commun, Elfique, Nain, Sylvestre');
  const previousClient = structuredClone(saved.character);
  delete previousClient.startingLanguages;
  previousClient.details.story = 'Histoire complétée';
  const updated = await store.save(userId, id, previousClient, saved.revision);
  assert.deepEqual(updated.character.startingLanguages, ['elfique','nain']);
  assert.equal(updated.character.details.languages, 'Sylvestre');
  await assert.rejects(store.save(userId,id,{...updated.character,startingLanguages:['nain','nain']},updated.revision), e=>e.status===400);
  await assert.rejects(store.save(userId,id,change,first.revision,{strictRevision:true}), e=>e.status===409);
  const after = await realFingerprints();
  assert.deepEqual(after, before);
  const coverage = ['existing-sheet-ready','admin-addition-in-owner-account','saved-round-trip-and-pdf','old-client-preservation','duplicate-rejection','revision-conflict','real-documents-unchanged'];
  const report = {status:'passed',checks:coverage.length,coverage,realBefore:before,realAfter:after};
  await writeFile(output, JSON.stringify(report,null,2)+'\n', {flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:report.status,checks:report.checks,realDataUnchanged:true}));
} finally {
  try { await collection.deleteOne({user_id:userId,client_id:id}); } finally { await client.close(); }
}
