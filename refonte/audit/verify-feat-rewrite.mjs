import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
import {buildCatalogue} from '../catalogue.mjs';
import {catalogueHash,validateCatalogue} from '../access/rules-store.mjs';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.dirname(base);
const read=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const git=(...args)=>spawnSync('git',args,{cwd:root,encoding:'utf8'});
const baselineCommit='82a7f76ba181aa2246e4786c1bb08cee7a27ca22';
const unchanged=['refonte/maquette','refonte/accueil','refonte/tests/fixtures/rules-2024.json','refonte/data/rules-2024-corrections.json','refonte/data/editorial-description-corrections-20261030.json','refonte/data/non-srd-description-rewrite-20261030.json'];
assert.equal(git('diff','--exit-code',baselineCommit,'--',...unchanged).status,0,'Player modules and previous mechanical/editorial data must remain unchanged');
const plan=read('data/non-srd-feat-rewrite-20261031.json');
const release=read('access/rules-release.json');
const previousRelease=JSON.parse(git('show',baselineCommit+':refonte/access/rules-release.json').stdout);
assert.equal(previousRelease.sha256,plan.baseCatalogueSha256);
assert.equal(release.id,previousRelease.id);
assert.equal(release.catalogueId,plan.id);
const snapshot=read('tests/fixtures/rules-2024.json');
const before=buildCatalogue(snapshot,{editorialUntil:plan.previousEditorialRevision.id});
const after=buildCatalogue(snapshot);
validateCatalogue(after,release);
assert.equal(catalogueHash(before),plan.baseCatalogueSha256);
assert.equal(catalogueHash(after),release.sha256);
const restored=structuredClone(after);
for(const correction of plan.corrections){
  let row=restored[correction.collection].find(entry=>entry.id===correction.id);
  for(const key of correction.path.slice(0,-1))row=row[key];
  assert.equal(row[correction.path.at(-1)],correction.after);
  row[correction.path.at(-1)]=correction.before;
}
restored.provenance.editorialRevision=plan.previousEditorialRevision;
assert.deepEqual(restored,before);
const membership=read('audit/feat-srd-membership-2024.json');
assert.deepEqual(membership.summary,{entries:77,active:75,srd:17,nonSrdActive:58,archived:2});
assert.equal(plan.corrections.length,169);
for(const entry of membership.entries.filter(entry=>entry.status!=='not-included-in-srd-5.2.1')){
  assert.deepEqual(after.feats.find(feat=>feat.id===entry.id),before.feats.find(feat=>feat.id===entry.id));
}
assert.equal(plan.retained.length,46);
const full=fs.readFileSync(path.join(base,'.local/feat-all-unit-tests.txt'),'utf8');
const repairs=fs.readFileSync(path.join(base,'.local/feat-unit-repairs.txt'),'utf8');
const count=(log,key)=>Number(log.match(new RegExp('(?:ℹ|#) '+key+' (\\d+)'))?.[1]??-1);
assert.deepEqual(['tests','pass','fail','skipped'].map(key=>count(full,key)),[4010,4008,2,0]);
assert.deepEqual(['tests','pass','fail','skipped'].map(key=>count(repairs,key)),[15,15,0,0]);
const repairedNames=[
  'Un effet conditionnel de parade ou de charge ne gonfle pas la CA ou la vitesse permanente',
  'Adepte élémentaire nécessite un type, applique la règle des 1 comptant comme 2 sans lancer de dés',
];
for(const name of repairedNames){assert(full.includes('✖ '+name));assert(repairs.includes('✔ '+name));}
assert.equal((repairs.match(/^✔ /gm)||[]).length,15);
for(const file of ['.local/feat-browser-journeys.json','.local/feat-catalogue-refresh.json']){
  const report=read(file);
  assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[file.includes('journeys')?8:2,0,0,0]);
}
const review=read('.local/feat-rewrite-browser-review.json');
assert.deepEqual([review.status,review.edition,review.routes,review.visibleTextFields,review.pageErrors,review.screenshots.length],['passed',plan.id,58,169,0,6]);
const inventory=read('audit/description-provenance-2024.json');
assert.equal(inventory.summary.catalogueSha256,release.sha256);
assert.equal(inventory.summary.editorialEdition.changedFields,169);
const proof={
  status:'passed',scope:'feat-rewrite-with-unchanged-mechanics-baseline',
  sourceHash:await sourceFingerprint(),completedAt:new Date().toISOString(),failed:0,skipped:0,baselineCommit,
  fullCampaign:{tests:4010,initiallyPassed:4008,initiallyFailed:2,resolvedByTargetedRun:true},
  targetedRepairRun:{tests:15,passed:15,repairedNames},
  browserJourneys:8,latestCatalogueChecks:2,grimoireRoutes:58,visibleRewrittenFields:169,comparativeFeatSheets:52,
  coverage:plan.coverage,rulesVersion:release.id,catalogueId:release.catalogueId,
  previousCatalogueSha256:plan.baseCatalogueSha256,catalogueSha256:release.sha256,
  qualification:'169 independently drafted technical text fields across 58 active non-SRD feats. Restoring these fields and the previous editorial metadata exactly recovers the actual baseline catalogue. SRD feats, archives, ability expressions, prerequisites and structured mechanics unchanged. Full campaign initially had two assertions tied to the previous wording; both repaired assertions and all 15 targeted tests pass on the final text. Eight broader browser journeys retained, two catalogue checks and all 58 changed Grimoire pages rechecked on the final edition. No redistribution-rights clearance or exhaustive original-book comparison claimed.',
};
fs.writeFileSync(path.join(base,'.local/feat-rewrite-verification.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
