import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(base);
const baselineCommit='9ca784ab1e0ec3c9d80203a04ddcb6eabada2c47';
const unchanged=spawnSync('git',['diff','--exit-code',baselineCommit,'--','refonte/data','refonte/catalogue.mjs','refonte/rules-revision.mjs','refonte/editorial-revision.mjs','refonte/tests/fixtures/rules-2024.json','refonte/access/rules-release.json','refonte/access/server.mjs','refonte/access/character-store.mjs','refonte/maquette',':(exclude)refonte/maquette/admin-view.mjs',':(exclude)refonte/data/current-release.txt'],{cwd:root,encoding:'utf8'});
assert.equal(unchanged.status,0,'Only administration is in scope; authentication, characters and frozen rules must stay unchanged');
const log=fs.readFileSync(path.join(base,'.local/admin-accounts-tests.txt'),'utf8');
const count=key=>Number(log.match(new RegExp('(?:ℹ|#) '+key+' (\\d+)'))?.[1]??-1);
assert.deepEqual(['tests','pass','fail','skipped'].map(count),[22,22,0,0]);
const report=JSON.parse(fs.readFileSync(path.join(base,'e2e/test-results/results.json'),'utf8'));
assert.deepEqual([report.stats.expected,report.stats.unexpected,report.stats.skipped,report.stats.flaky],[8,0,0,0]);
const proof={status:'passed',scope:'admin-accounts-with-unchanged-characters-baseline',sourceHash:await sourceFingerprint(),completedAt:new Date().toISOString(),baselineCommit,failed:0,skipped:0,unitPassed:22,browserJourneys:8,
qualification:'Server-only paginated Supabase Auth account directory replaces login-only Mongo profiles for account totals and assignment targets. Fresh reads, pending registrations, deletion, anonymous users, failure states and account permissions are covered. UI refreshes every 30 seconds, on focus and manually without losing assignment selections; leaving the page cancels refreshes. No production publication is allowed until the server key is configured and real read-only account checks succeed.'};
fs.writeFileSync(path.join(base,'.local/admin-accounts-verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
