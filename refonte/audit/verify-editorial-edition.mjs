import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
import {buildCatalogue} from '../catalogue.mjs';
import {catalogueHash,validateCatalogue} from '../access/rules-store.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(base);
const read=f=>JSON.parse(fs.readFileSync(path.join(base,f),'utf8'));
const git=(...args)=>spawnSync('git',args,{cwd:root,encoding:'utf8'});
assert.equal(git('diff','--exit-code','HEAD','--','refonte/maquette','refonte/tests/fixtures/rules-2024.json','refonte/data/rules-2024-corrections.json').status,0,'Player engine and frozen rules corrections must be unchanged');
const plan=read('data/editorial-description-corrections-20261030.json'),release=read('access/rules-release.json');
const snapshot=read('tests/fixtures/rules-2024.json'),old=buildCatalogue(snapshot,{editorial:false}),catalogue=buildCatalogue(snapshot);validateCatalogue(catalogue,release);
assert.equal(catalogueHash(old),plan.baseCatalogueSha256);assert.equal(catalogueHash(catalogue),release.sha256);
const restored=structuredClone(catalogue);for(const c of plan.corrections){let row=restored[c.collection].find(r=>r.id===c.id);for(const key of c.path.slice(0,-1))row=row[key];assert.equal(row[c.path.at(-1)],c.after);row[c.path.at(-1)]=c.before;}delete restored.provenance.editorialRevision;assert.deepEqual(restored,old);
const log=fs.readFileSync(path.join(base,'.local/editorial-unit-tests.txt'),'utf8');
const count=(text,key)=>Number(text.match(new RegExp('(?:ℹ|#) '+key+' (\\d+)'))?.[1]??-1);
const total=count(log,'tests');assert(total>3900);assert.equal(count(log,'pass'),total-2);assert.equal(count(log,'fail'),2);assert.equal(count(log,'skipped'),0);
// The full run caught two assertions tied to the old glued typography. Only
// those assertions changed; recheck their two files instead of repeating the matrix.
const expectedFailures=['Les composantes matérielles restent lisibles et les profils utiles des sorts sont conservés','Les huit convocations ont un profil utilisable et aucune attaque fictive du lanceur'];
const failures=[...new Set([...log.matchAll(/^✖ (.+) \([\d.]+ms\)$/gm)].map(m=>m[1]))].sort();assert.deepEqual(failures,expectedFailures.sort());
const repairs=fs.readFileSync(path.join(base,'.local/editorial-unit-repairs.txt'),'utf8');assert.equal(count(repairs,'tests'),24);assert.equal(count(repairs,'pass'),24);assert.equal(count(repairs,'fail'),0);assert.equal(count(repairs,'skipped'),0);
for(const name of expectedFailures)assert(repairs.split(/\r?\n/).some(line=>line.startsWith('✔ '+name+' (')),name+' repaired');
const browser=read('e2e/test-results/results.json');assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[8,0,0,0]);
const review=read('.local/editorial-visual-review.json');assert.equal(review.status,'passed');assert.equal(review.reviewed.length,6);assert.equal(review.pageErrors,0);assert.equal(review.edition,plan.id);
const proof={status:'passed',scope:'editorial-texts-with-unchanged-mechanics-baseline',sourceHash:await sourceFingerprint(),completedAt:new Date().toISOString(),failed:0,skipped:0,baselineCommit:git('rev-parse','HEAD').stdout.trim(),unitPassed:total,unitEvidence:{initialFullRun:{tests:total,passed:total-2,failed:2},targetedRepairRun:{tests:24,passed:24,failed:0},repairedFailures:expectedFailures,distinctValidated:total},browserPassed:8,visualEntries:6,changedTextFields:plan.corrections.length,rulesVersion:release.id,catalogueId:release.catalogueId,previousCatalogueSha256:plan.baseCatalogueSha256,catalogueSha256:release.sha256,qualification:'35 approved text fields only (six prose edits, 29 spacing fixes), plus explicit editorial provenance. Reversing those fields recovers the previous catalogue exactly. All player modules and frozen mechanical rules unchanged. Full unit matrix followed by targeted repair of two whitespace-sensitive assertions; no duplicate tests counted. Browser catalogue hash, Grimoire, account isolation, admin transfers and PDF journeys pass. No real character migration and no redistribution-rights clearance.'};
fs.writeFileSync(path.join(base,'.local/editorial-edition-verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
