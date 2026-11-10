import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';

const base=new URL('../',import.meta.url),baselineCommit='7ce79c416';
execFileSync('git',['diff','--exit-code',baselineCommit,'--','refonte/data',':(exclude)refonte/data/current-release.txt','refonte/catalogue.mjs','refonte/access/rules-release.json','refonte/maquette/character-storage.mjs','refonte/maquette/character-rules.mjs','refonte/maquette/sheet-model.mjs','refonte/access/group-loot.mjs','refonte/access/combat-potions.mjs'],{stdio:'inherit'});
const log=await readFile(new URL('.local/gifts-tests.txt',base),'utf8');
const count=label=>Number(log.match(new RegExp('(?:ℹ|#) '+label+' (\\d+)'))?.[1] ?? -1);
assert.deepEqual(['tests','pass','fail','skipped','cancelled','todo'].map(count),[146,146,0,0,0,0]);
const {stats}=JSON.parse(await readFile(new URL('e2e/test-results/results.json',base),'utf8'));
assert.deepEqual([stats.expected,stats.unexpected,stats.skipped,stats.flaky],[27,0,0,0]);
const proof={status:'passed',scope:'group-gifts-with-durable-debit-and-credit',sourceHash:await sourceFingerprint(),baselineCommit,unitPassed:146,browserJourneys:27,failed:0,skipped:0,completedAt:new Date().toISOString()};
await writeFile(new URL('.local/gifts-verification.json',base),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
