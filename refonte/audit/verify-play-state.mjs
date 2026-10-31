import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildCatalogue} from '../catalogue.mjs';
import {catalogueHash,validateCatalogue} from '../access/rules-store.mjs';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(base);
const read=f=>JSON.parse(fs.readFileSync(path.join(base,f),'utf8'));
const git=(...args)=>spawnSync('git',args,{cwd:root,encoding:'utf8'});
const baselineCommit=git('rev-parse','d4902b98e').stdout.trim();
const core=['character-rules','origin-rules','cleric-progression','progression','class-profiles','beast-companion','species-rules','wild-shape','class-magic','extra-classes','warlock-options','feat-effects','sheet-model','character-pdf'];
assert.equal(git('diff','--exit-code',baselineCommit,'--','refonte/data',':(exclude)refonte/data/current-release.txt','refonte/catalogue.mjs','refonte/rules-revision.mjs','refonte/editorial-revision.mjs','refonte/tests/fixtures/rules-2024.json','refonte/access/rules-release.json',...core.map(name=>'refonte/maquette/'+name+'.mjs')).status,0,'Frozen catalogue, game calculations and PDF must stay unchanged');
const release=read('access/rules-release.json');
const catalogue=buildCatalogue(read('tests/fixtures/rules-2024.json'));validateCatalogue(catalogue,release);
assert.equal(catalogueHash(catalogue),JSON.parse(git('show',baselineCommit+':refonte/access/rules-release.json').stdout).sha256);
const counts=file=>{const log=fs.readFileSync(path.join(base,file),'utf8');return ['tests','pass','fail','skipped'].map(key=>Number(log.match(new RegExp('(?:ℹ|#) '+key+' (\\d+)'))?.[1]??-1));};
const broad=counts('.local/play-all-unit-tests.txt');assert.deepEqual(broad,[4026,4026,0,0]);
assert.deepEqual(counts('.local/play-targeted-final.txt'),[35,35,0,0]);
const targeted=fs.readFileSync(path.join(base,'.local/play-targeted-final.txt'),'utf8');assert(targeted.includes('✔ Un ancien client qui omet le suivi conserve les PV et ressources déjà enregistrés'));
const browser=fs.readFileSync(path.join(base,'.local/play-browser-final.txt'),'utf8');
assert.match(browser,/10 passed/);assert.doesNotMatch(browser,/\d+ failed/);assert.equal((browser.match(/^\s+ok\s+\d+\s/gm)||[]).length,10);
const layout=read('e2e/test-results/results.json');assert.deepEqual([layout.stats.expected,layout.stats.unexpected,layout.stats.skipped,layout.stats.flaky],[3,0,0,0]);
const proof={status:'passed',scope:'play-state-with-unchanged-rules-baseline',sourceHash:await sourceFingerprint(),completedAt:new Date().toISOString(),baselineCommit,failed:0,skipped:0,
 rulesVersion:release.id,catalogueId:release.catalogueId,catalogueSha256:release.sha256,
 unitCampaign:{passed:4026,failed:0,skipped:0},targetedAfterOldClientCompatibilityGuard:{passed:35,failed:0,skipped:0},distinctUnitTestsCovered:4027,browserJourneys:10,finalLayoutRefresh:3,
 qualification:'Optional HP/temporary HP and explicitly selected expendable class-reserve tracking. Nine new session tests plus one old-client preservation test. The broad unit campaign passed; after the final compatibility guard, all 35 storage/session/sheet tests were rerun, including the additional old-client test. Ten complete browser journeys passed with the final storage guard; three affected UI journeys refreshed after the desktop tab layout change. No rule catalogue, derived statistics, automatic dice, spell slots/rest/state automation or existing-character migration. Real MongoDB verification required before/after deployment.'};
fs.writeFileSync(path.join(base,'.local/play-state-verification.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
