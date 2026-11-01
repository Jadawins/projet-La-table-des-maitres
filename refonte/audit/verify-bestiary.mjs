import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(base),baselineCommit='2de9fd7e2';
const unchanged=spawnSync('git',['diff','--exit-code',baselineCommit,'--','refonte/data','refonte/catalogue.mjs','refonte/rules-revision.mjs','refonte/editorial-revision.mjs','refonte/access/rules-release.json','refonte/access/character-store.mjs','refonte/access/admin-store.mjs','refonte/access/auth-accounts.mjs','refonte/access/group-store.mjs','refonte/maquette',':(exclude)refonte/data/current-release.txt',':(exclude)refonte/maquette/combat-view.mjs',':(exclude)refonte/maquette/combat.css',':(exclude)refonte/maquette/bestiary-view.mjs'],{cwd:root,encoding:'utf8'});
assert.equal(unchanged.status,0,'Character rules, strict character saves, existing groups and unrelated views must remain unchanged');
const old=spawnSync('git',['show',baselineCommit+':refonte/access/server.mjs'],{cwd:root,encoding:'utf8'});assert.equal(old.status,0);
const auth=s=>s.slice(s.indexOf('  async function authFetch'),s.indexOf('  function rateAllowed'));
assert.equal(auth(fs.readFileSync(path.join(base,'access/server.mjs'),'utf8')),auth(old.stdout));
const log=fs.readFileSync(path.join(base,'.local/bestiary-tests.txt'),'utf8'),count=key=>Number(log.match(new RegExp('(?:ℹ|#) '+key+' (\\d+)'))?.[1]??-1);
assert.deepEqual(['tests','pass','fail','skipped'].map(count),[68,68,0,0]);
const browser=JSON.parse(fs.readFileSync(path.join(base,'e2e/test-results/results.json'),'utf8'));
assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[18,0,0,0]);
const proof={status:'passed',scope:'bestiary-with-frozen-character-rules-baseline',sourceHash:await sourceFingerprint(),completedAt:new Date().toISOString(),baselineCommit,failed:0,skipped:0,unitPassed:68,browserJourneys:18,
  qualification:'MongoDB bestiary read only; group MJ search and profile access, fresh server-side stats for bulk imports, bounded persisted snapshots, independent HP and player secrecy. Frozen character rules and strict saved-character revisions unchanged. Existing group, combat, admin, portal and PDF browser journeys pass. Production requires checks of all live monster profiles and unchanged real data before/after backup-protected publication.'};
fs.writeFileSync(path.join(base,'.local/bestiary-verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
