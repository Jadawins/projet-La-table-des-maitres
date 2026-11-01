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
const baselineCommit=git('rev-parse','3115022ee').stdout.trim();
const core=['character-rules','origin-rules','cleric-progression','progression','class-profiles','beast-companion','species-rules','wild-shape','class-magic','extra-classes','warlock-options','feat-effects','sheet-model','character-pdf','character-storage'];
assert.equal(git('diff','--exit-code',baselineCommit,'--','refonte/data',':(exclude)refonte/data/current-release.txt','refonte/catalogue.mjs','refonte/rules-revision.mjs','refonte/editorial-revision.mjs','refonte/tests/fixtures/rules-2024.json','refonte/access/rules-release.json',...core.map(name=>'refonte/maquette/'+name+'.mjs')).status,0,'Frozen rules, calculations and the existing character contract must stay unchanged except the already optional session validator');
const release=read('access/rules-release.json'),catalogue=buildCatalogue(read('tests/fixtures/rules-2024.json'));validateCatalogue(catalogue,release);
assert.equal(catalogueHash(catalogue),JSON.parse(git('show',baselineCommit+':refonte/access/rules-release.json').stdout).sha256);
const log=fs.readFileSync(path.join(base,'.local/rest-all-unit-tests.txt'),'utf8');
const count=key=>Number(log.match(new RegExp('(?:ℹ|#) '+key+' (\\d+)'))?.[1]??-1);
assert.deepEqual(['tests','pass','fail','skipped'].map(count),[4039,4039,0,0]);
const browser=read('.local/rest-thirteen-browser-report.json');assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[13,0,0,0]);
const visual=read('e2e/test-results/results.json');assert.deepEqual([visual.stats.expected,visual.stats.unexpected,visual.stats.skipped,visual.stats.flaky],[1,0,0,0]);
const proof={status:'passed',scope:'spell-rest-with-unchanged-rules-baseline',sourceHash:await sourceFingerprint(),completedAt:new Date().toISOString(),baselineCommit,failed:0,skipped:0,
 rulesVersion:release.id,catalogueId:release.catalogueId,catalogueSha256:release.sha256,
 unitPassed:4039,browserJourneys:13,dialogVisualCheck:1,
 qualification:'Ordinary and Pact Magic slot counters, explicit short/long rests with preview and confirmation, manually entered Hit Die healing, full long-rest Hit Dice recovery and temporary HP expiry. Resource recharge uses an explicit reviewed policy rather than parsing descriptions. Optional choice-based recovery, states/exhaustion, time eligibility and special untracked abilities remain table decisions. Existing version-1 session records remain valid without adding fields on read; older HP-only clients preserve newer slot/Hit Dice/rest fields. Astuce mystique correctly counts one ritual use rather than the number of slots recoverable by that ritual. No catalogue revision or existing-character migration.'};
fs.writeFileSync(path.join(base,'.local/spell-rest-verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
