// Executed on the VPS before import: compare the proposed data with the real old catalogue.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const [previous,target,input,planFile]=process.argv.slice(2);
for(const dir of [previous,target])assert.match(dir??'',/^\/var\/www\/myrpgtable\/refonte-access\/\d{8}T\d{6}Z$/);
const read=async f=>JSON.parse(await readFile(f,'utf8'));
const plan=await read(planFile),catalogue=await read(input),release=await read(target+'/rules-release.json');
const oldRelease=await read(previous+'/rules-release.json');assert.equal(oldRelease.sha256,plan.baseCatalogueSha256);assert.equal(release.id,oldRelease.id);assert.equal(release.catalogueId,plan.id);
const {loadRulesCatalogue}=await import(pathToFileURL(previous+'/rules-store.mjs').href);
const {validateCatalogue}=await import(pathToFileURL(target+'/rules-store.mjs').href);validateCatalogue(catalogue,release);
const restored=structuredClone(catalogue);
for(const c of plan.corrections){let row=restored[c.collection].find(r=>r.id===c.id);assert(row);for(const key of c.path.slice(0,-1))row=row[key];const key=c.path.at(-1);assert.equal(row[key],c.after);assert.equal(createHash('sha256').update(c.before).digest('hex'),c.beforeSha256);row[key]=c.before;}
delete restored.provenance.editorialRevision;
const {MongoClient}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
try{const old=await loadRulesCatalogue(client.db('myrpgtable'),oldRelease);assert.deepEqual(restored,old.catalogue);console.log(JSON.stringify({status:'passed',changedFields:plan.corrections.length,rulesVersion:release.id,catalogueId:release.catalogueId,actualMongoBaselineIdentical:true}));}finally{await client.close();}
