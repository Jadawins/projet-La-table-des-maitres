import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildCatalogue} from '../catalogue.mjs';
import {catalogueHash,validateCatalogue} from '../access/rules-store.mjs';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(base);
const read=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const git=(...args)=>spawnSync('git',args,{cwd:root,encoding:'utf8'});
const baselineCommit=git('rev-parse','dded859e531d5791445a57d2c75ea1591a1d788b').stdout.trim();
const core=['character-rules','origin-rules','cleric-progression','progression','class-profiles','beast-companion','species-rules','wild-shape','class-magic','extra-classes','warlock-options','feat-effects','sheet-model','character-pdf'];
assert.equal(git('diff','--exit-code',baselineCommit,'--','refonte/data',':(exclude)refonte/data/current-release.txt','refonte/catalogue.mjs','refonte/rules-revision.mjs','refonte/editorial-revision.mjs','refonte/tests/fixtures/rules-2024.json','refonte/access/rules-release.json',...core.map(name=>'refonte/maquette/'+name+'.mjs')).status,0,'Frozen catalogue, calculations and PDF must stay unchanged');
const release=read('access/rules-release.json'),catalogue=buildCatalogue(read('tests/fixtures/rules-2024.json'));
validateCatalogue(catalogue,release);
assert.equal(catalogueHash(catalogue),JSON.parse(git('show',baselineCommit+':refonte/access/rules-release.json').stdout).sha256);
const log=fs.readFileSync(path.join(base,'.local/conditions-all-unit-tests.txt'),'utf8');
const count=key=>Number(log.match(new RegExp('(?:ℹ|#) '+key+' (\\d+)'))?.[1]??-1);
assert.deepEqual(['tests','pass','fail','skipped','cancelled'].map(count),[4053,4053,0,0,0]);
const browser=read('.local/conditions-fifteen-browser-report.json');
assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[15,0,0,0]);
const proof={
  status:'passed',scope:'conditions-with-unchanged-rules-baseline',sourceHash:await sourceFingerprint(),completedAt:new Date().toISOString(),baselineCommit,failed:0,skipped:0,
  rulesVersion:release.id,catalogueId:release.catalogueId,catalogueSha256:release.sha256,
  unitPassed:4053,browserJourneys:15,visualChecks:2,
  qualification:'Optional manual conditions and their induced states; contextual Speed and Exhaustion penalty displayed without rewriting base sheet statistics. Physical death-save dice and other modifiers are entered explicitly; natural 1/20, stabilization, remaining Prone, confirmed death/revival and Exhaustion 6 are covered. Damage at zero HP uses a player-declared failure count; instant death, special survival abilities, effect durations and other contextual combat effects remain table decisions. Long rests reduce tracked Exhaustion by one, as do short rests for Ranger level 10+. Old clients preserve optional fields and cannot silently heal a declared dead character. No catalogue revision, automatic rolls or existing-character migration.'
};
fs.writeFileSync(path.join(base,'.local/conditions-verification.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
