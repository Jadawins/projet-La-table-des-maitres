import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(base),baselineCommit='1db70eb5c';
const unchanged=spawnSync('git',['diff','--exit-code',baselineCommit,'--','refonte/data','refonte/catalogue.mjs','refonte/rules-revision.mjs','refonte/editorial-revision.mjs','refonte/access/rules-release.json','refonte/access/character-store.mjs','refonte/access/admin-store.mjs','refonte/access/auth-accounts.mjs','refonte/access/group-store.mjs','refonte/maquette',':(exclude)refonte/data/current-release.txt',':(exclude)refonte/maquette/combat-view.mjs',':(exclude)refonte/maquette/combat.css',':(exclude)refonte/maquette/attack-view.mjs'],{cwd:root,encoding:'utf8'});
assert.equal(unchanged.status,0,'Character rules, strict character saves, existing groups and unrelated views must remain unchanged');
const old=spawnSync('git',['show',baselineCommit+':refonte/access/server.mjs'],{cwd:root,encoding:'utf8'});assert.equal(old.status,0);
const auth=s=>s.slice(s.indexOf('  async function authFetch'),s.indexOf('  function rateAllowed'));
assert.equal(auth(fs.readFileSync(path.join(base,'access/server.mjs'),'utf8')),auth(old.stdout));
const log=fs.readFileSync(path.join(base,'.local/attacks-tests.txt'),'utf8'),count=key=>Number(log.match(new RegExp('(?:ℹ|#) '+key+' (\\d+)'))?.[1]??-1);
assert.deepEqual(['tests','pass','fail','skipped'].map(count),[85,85,0,0]);
const browser=JSON.parse(fs.readFileSync(path.join(base,'e2e/test-results/results.json'),'utf8'));
assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[21,0,0,0]);
const proof={status:'passed',scope:'attacks-with-explicit-dice-and-mj-confirmation',sourceHash:await sourceFingerprint(),completedAt:new Date().toISOString(),baselineCommit,failed:0,skipped:0,unitPassed:85,browserJourneys:21,
  qualification:'Explicit physical or secure server dice for weapon and NPC attacks; separate remembered preferences; MJ-only damage confirmation; concurrent/repeated confirmation and lost acknowledgement protection. No automatic roll on reading. Pending proposals expire after five minutes or restart. Frozen catalogue, character saves, auth and unrelated views unchanged. Spells, conditional exceptions and mixed damage adjudication remain manual.'};
fs.writeFileSync(path.join(base,'.local/attacks-verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
