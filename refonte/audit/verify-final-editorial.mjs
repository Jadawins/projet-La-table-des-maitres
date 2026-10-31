import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildCatalogue} from '../catalogue.mjs';
import {catalogueHash,validateCatalogue} from '../access/rules-store.mjs';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.dirname(base);
const read=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
const git=(...args)=>spawnSync('git',args,{cwd:root,encoding:'utf8'});
const baselineCommit=git('rev-parse','d696dab83').stdout.trim();
assert.equal(git('diff','--exit-code',baselineCommit,'--','refonte/maquette','refonte/accueil','refonte/tests/fixtures/rules-2024.json','refonte/data/rules-2024-corrections.json','refonte/data/non-srd-feat-rewrite-20261031.json','refonte/data/non-srd-description-rewrite-20261030.json','refonte/data/editorial-description-corrections-20261030.json').status,0,'Runtime, frozen mechanical data and previous editions must remain unchanged');
const plan=read('data/editorial-final-rewrite-20261031.json');
const release=read('access/rules-release.json');
const oldRelease=JSON.parse(git('show',baselineCommit+':refonte/access/rules-release.json').stdout);
assert.equal(plan.baseCatalogueSha256,oldRelease.sha256);
assert.equal(release.id,oldRelease.id);assert.equal(release.catalogueId,plan.id);
const source=read('tests/fixtures/rules-2024.json');
const before=buildCatalogue(source,{editorialUntil:plan.previousEditorialRevision.id});
const after=buildCatalogue(source);validateCatalogue(after,release);
assert.equal(catalogueHash(before),plan.baseCatalogueSha256);
const restored=structuredClone(after);
for(const c of plan.corrections){
 let row=c.id==='$root'?restored[c.collection]:restored[c.collection].find(r=>(r.id||r.slug)===c.id);
 for(const k of c.path.slice(0,-1))row=row[k];
 assert.equal(row[c.path.at(-1)],c.after);row[c.path.at(-1)]=c.before;
}
restored.provenance.editorialRevision=plan.previousEditorialRevision;assert.deepEqual(restored,before);
const dispositions=read('audit/editorial-final-dispositions-20261031.json');
assert.equal(dispositions.status,'editorial-review-complete');assert.equal(dispositions.catalogueSha256,release.sha256);
assert.equal(dispositions.unresolvedActiveDescriptionFields,0);
assert.equal(dispositions.fields.length,2021);assert.equal(dispositions.supplements.length,95);
for(const d of [...dispositions.fields,...dispositions.supplements]){
 const row=d.id===undefined?after[d.collection]:after[d.collection].find((r,i)=>String(r.id||r.slug||i)===d.id);
 const value=d.path.split('.').reduce((v,k)=>v[k],row);
 assert.equal(createHash('sha256').update(value).digest('hex'),d.sha256,d.collection+'/'+d.id+'/'+d.path);
 assert(d.decision&&d.evidence);
}
const inventory=read('audit/description-provenance-2024.json');assert.equal(inventory.summary.catalogueSha256,release.sha256);assert.equal(inventory.summary.editorialReview.status,'editorial-review-complete');
const log=fs.readFileSync(path.join(base,'.local/final-editorial-unit-clean.txt'),'utf8');
const count=key=>Number(log.match(new RegExp('(?:ℹ|#) '+key+' (\\d+)'))?.[1]??-1);
assert.deepEqual(['tests','pass','fail','skipped'].map(count),[4017,4017,0,0]);
const browser=read('.local/final-eight-browser-journeys.json');assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[8,0,0,0]);
const review=read('.local/final-text-browser-review.json');assert.deepEqual([review.status,review.routes,review.visibleTextFields,review.catalogueTextFields,review.pageErrors,review.screenshots.length],['passed',64,221,244,0,6]);assert.equal(review.edition,plan.id);
const proof={status:'passed',scope:'final-editorial-review-with-unchanged-mechanics-baseline',sourceHash:await sourceFingerprint(),completedAt:new Date().toISOString(),failed:0,skipped:0,baselineCommit,
 rulesVersion:release.id,catalogueId:release.catalogueId,catalogueSha256:release.sha256,previousCatalogueSha256:plan.baseCatalogueSha256,
 changedFields:244,unitPassed:4017,browserJourneys:8,grimoireRoutes:64,visibleRewrittenFields:221,catalogueRewrittenFields:244,comparativeSheets:423,reviewedMainTextFields:2021,reviewedSupplementTextFields:95,
 qualification:'Editorial review completed across the detected catalogue text and all supplemental text fields. All 16 background introductions and 128 optional prompts, all ten species introductions, Aasimar traits, the non-SRD familiar, Battle Master maneuvers and remaining short non-SRD spell text rewritten. Technical expressions/SRD-derived summaries retained with explicit decisions. Five unavailable animal variants and two legacy feats remain excluded/archived. Full final unit run passes after correcting wording-dependent parsing; no player runtime or structured mechanical data changed. No legal clearance for PDF/artwork/trademarks or non-SRD redistribution claimed.'};
fs.writeFileSync(path.join(base,'.local/final-editorial-verification.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
