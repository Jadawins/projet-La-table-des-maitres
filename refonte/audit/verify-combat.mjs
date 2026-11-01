import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(base),baselineCommit='4c7f950ff';
const unchanged=spawnSync('git',['diff','--exit-code',baselineCommit,'--','refonte/data','refonte/catalogue.mjs','refonte/rules-revision.mjs','refonte/editorial-revision.mjs','refonte/access/rules-release.json','refonte/access/admin-store.mjs','refonte/access/auth-accounts.mjs','refonte/access/group-store.mjs','refonte/maquette',':(exclude)refonte/data/current-release.txt',':(exclude)refonte/maquette/app.js',':(exclude)refonte/maquette/index.html',':(exclude)refonte/maquette/group-view.mjs',':(exclude)refonte/maquette/combat-view.mjs',':(exclude)refonte/maquette/combat.css'],{cwd:root,encoding:'utf8'});
assert.equal(unchanged.status,0,'Existing character rules, saved-character handling and group permissions remain unchanged');
const characterBaseline=spawnSync('git',['show',baselineCommit+':refonte/access/character-store.mjs'],{cwd:root,encoding:'utf8'});assert.equal(characterBaseline.status,0);
const characterSource=fs.readFileSync(path.join(base,'access/character-store.mjs'),'utf8').replace('async save(userId,id,input,revision,{strictRevision=false}={}){','async save(userId,id,input,revision){').replace("\n      if(strictRevision&&previous?.revision!==revision)throw fault(409,'Ce personnage a été modifié ailleurs. Actualisez avant de recommencer.');",'');
assert.equal(characterSource.replaceAll('\r\n','\n'),characterBaseline.stdout.replaceAll('\r\n','\n'),'Only optional strict revision checking may extend character storage');
const serverBaseline=spawnSync('git',['show',baselineCommit+':refonte/access/server.mjs'],{cwd:root,encoding:'utf8'});assert.equal(serverBaseline.status,0);
const auth=s=>s.slice(s.indexOf('  async function authFetch'),s.indexOf('  function rateAllowed'));
assert.equal(auth(fs.readFileSync(path.join(base,'access/server.mjs'),'utf8')),auth(serverBaseline.stdout));
const log=fs.readFileSync(path.join(base,'.local/combat-tests.txt'),'utf8'),count=key=>Number(log.match(new RegExp('(?:ℹ|#) '+key+' (\\d+)'))?.[1]??-1);
assert.deepEqual(['tests','pass','fail','skipped'].map(count),[101,101,0,0]);
const report=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
function specs(s){return [...(s.specs||[]),...(s.suites||[]).flatMap(specs)];}
function passed(s){return s.ok&&s.tests.length===1&&s.tests[0].expectedStatus==='passed'&&s.tests[0].results.length===1&&s.tests[0].results[0].status==='passed';}
const initial=report('.local/combat-browser-baseline.json'),final=report('e2e/test-results/results.json');
const regression=specs(initial).filter(s=>s.file!=='combat.spec.mjs'),combat=specs(final);
assert.equal(regression.length,12);assert(regression.every(passed));
assert.equal(combat.length,3);assert(combat.every(s=>s.file==='combat.spec.mjs'&&passed(s)));
assert.deepEqual([final.stats.unexpected,final.stats.skipped,final.stats.flaky],[0,0,0]);
const proof={status:'passed',scope:'combat-with-frozen-character-rules-baseline',sourceHash:await sourceFingerprint(),completedAt:new Date().toISOString(),baselineCommit,failed:0,skipped:0,unitPassed:101,browserJourneys:15,
  browserEvidence:'Twelve unaffected group/portal/admin/PDF journeys passed in the initial campaign; three combat journeys passed after correcting a test-only fixed HP assumption and preserving expanded participant controls, then enabling strict character revision checks. No ignored or flaky journeys.',
  qualification:'Group-scoped, role-checked combat with manual initiative, explicit turns/rounds, hidden NPCs, authoritative saved-character health and existing condition rules. Concentration is a manual marker. Frozen catalogue and character validators unchanged. Strict character revision checks prevent coalescing concurrent identical damage. Requires isolated Mongo combat checks, real-group/character fingerprints and rollback backup before publication.'};
fs.writeFileSync(path.join(base,'.local/combat-verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
