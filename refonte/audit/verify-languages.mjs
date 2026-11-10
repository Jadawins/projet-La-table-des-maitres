import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';

const base = new URL('../', import.meta.url);
const baselineCommit = '01d0bd3eb';
execFileSync('git',['diff','--exit-code',baselineCommit,'--','refonte/data',':(exclude)refonte/data/current-release.txt','refonte/catalogue.mjs','refonte/access/rules-release.json','refonte/tests/fixtures/rules-2024.json'],{stdio:'inherit'});

const log = await readFile(new URL('.local/languages-tests.txt',base),'utf8');
const count = label => Number(log.match(new RegExp('(?:ℹ|#) '+label+' (\\d+)'))?.[1] ?? -1);
const unitPassed = count('pass');
assert.ok(unitPassed >= 30);
assert.equal(unitPassed, count('tests'));
assert.match(log,/✔ Langues de départ ajoutées à une fiche existante/);
for (const label of ['fail','skipped','cancelled','todo']) assert.equal(count(label),0);
const {stats} = JSON.parse(await readFile(new URL('e2e/test-results/results.json',base),'utf8'));
assert.deepEqual([stats.expected,stats.unexpected,stats.skipped,stats.flaky],[30,0,0,0]);

const proof = {
  status:'passed', scope:'starting-languages-with-frozen-catalogue',
  sourceHash:await sourceFingerprint(), baselineCommit,
  unitPassed, browserJourneys:stats.expected, failed:0, skipped:0,
  completedAt:new Date().toISOString(),
};
await writeFile(new URL('.local/languages-verification.json',base),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
