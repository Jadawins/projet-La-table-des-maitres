import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
import {buildCatalogue} from '../catalogue.mjs';
import {catalogueHash,validateCatalogue} from '../access/rules-store.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(base);
const json=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const git=(...args)=>spawnSync('git',args,{cwd:root,encoding:'utf8'});
const baselineCommit='3f68e4d11f80b87e4d92871387a29f7ec02d80d3';
assert.equal(git('diff','--exit-code',baselineCommit,'--','refonte/data',':(exclude)refonte/data/current-release.txt','refonte/catalogue.mjs','refonte/rules-revision.mjs','refonte/editorial-revision.mjs','refonte/tests/fixtures/rules-2024.json','refonte/access/rules-release.json').status,0,'The frozen documentary catalogue must remain unchanged');
const release=json('access/rules-release.json'),catalogue=buildCatalogue(json('tests/fixtures/rules-2024.json'));
validateCatalogue(catalogue,release);assert.equal(catalogueHash(catalogue),release.sha256);
const results=[];
for(const [name,expected]of [['advancement-all-unit-tests.txt',4292],['advancement-high-level-tests-final.txt',12],['advancement-validation-tests.txt',4]]){
  const text=fs.readFileSync(path.join(base,'.local',name),'utf8');
  const count=key=>Number(text.match(new RegExp('(?:ℹ|#) '+key+' (\\d+)'))?.[1]??-1);
  assert.deepEqual(['tests','pass','fail','skipped','cancelled'].map(count),[expected,expected,0,0,0],name);results.push({name,passed:expected});
}
const browser=json('.local/advancement-final-browser-report.json'),recheck=json('e2e/test-results/results.json');
assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[227,2,0,0]);
assert.deepEqual([recheck.stats.expected,recheck.stats.unexpected,recheck.stats.skipped,recheck.stats.flaky],[20,0,0,0]);
function specifications(report){const result=[];const visit=suite=>{for(const spec of suite.specs||[])result.push(spec);for(const child of suite.suites||[])visit(child);};report.suites.forEach(visit);return result;}
const specs=specifications(browser),checked=specifications(recheck),failed=specs.filter(spec=>spec.tests.some(t=>t.results.some(r=>r.status!=='passed')));
assert.equal(failed.length,2);assert(failed.some(spec=>/Érudition sans maîtrise éligible/.test(spec.title)));assert(failed.some(spec=>/^Druide : emplacements/.test(spec.title)));
for(const old of failed)assert(checked.some(spec=>spec.id===old.id),'Every failed case must be rechecked');
for(const spec of checked){assert(specs.some(old=>old.id===spec.id),'Unexpected recheck');assert(spec.ok);}
const countFile=file=>specs.filter(spec=>spec.file.replaceAll('\\','/').endsWith('/'+file)||spec.file===file).length;
assert.equal(countFile('classes.spec.mjs'),132);assert.equal(countFile('cleric.spec.mjs'),24);assert.equal(countFile('advancement.spec.mjs'),17);
// The browser harness snapshots production modules on launch. Check that the
// final successful campaign exercised these exact current browser modules.
const runtimeRoot=path.join(base,'e2e/.runtime');
const latest=fs.readdirSync(runtimeRoot).map(name=>({name,at:fs.statSync(path.join(runtimeRoot,name)).mtimeMs})).sort((a,b)=>b.at-a.at)[0];
const tested=path.join(runtimeRoot,latest.name,'atelier');
for(const file of fs.readdirSync(tested).filter(name=>/\.(mjs|js|css|html)$/.test(name))){assert.equal(fs.readFileSync(path.join(tested,file),'utf8').replaceAll('\r\n','\n'),fs.readFileSync(path.join(base,'maquette',file),'utf8').replaceAll('\r\n','\n'),'Browser runtime changed since the successful campaign: '+file);}
const proof={status:'passed',scope:'advancement-and-multiclass-with-frozen-catalogue',completedAt:new Date().toISOString(),sourceHash:await sourceFingerprint(),baselineCommit,failed:0,skipped:0,
  rulesVersion:release.id,catalogueId:release.catalogueId,catalogueSha256:release.sha256,
  unitPassed:4308,unitCampaigns:results,browserJourneys:229,
  qualification:'A 4292-test complete calculation campaign passed. Sixteen additional checks then validate multiclass ladders through total level 20, the empty Scholar eligibility case and invalid class identifiers after isolated validation hardenings, including preservation of Scholar eligibility at its acquisition time and composition of Expertise/Jack of All Trades with separate class skill bonuses. Browser scope covers all 48 subclasses at levels 1, 3 and 20; 17 advancement journeys include all 12 added classes, physical HP dice, cancellation/reload, another device, shared/Pact slots, mixed Hit Dice, PDF and Scholar with no qualifying skill. Intermediate progression is covered by 912 successive single-class transitions, 228 multiclass transitions and the 132 ordered class pairs in unit tests. The main 229-journey campaign passed 227 cases. One assertion incorrectly required an explicit empty optional field; another screenshot step raced the final save rerender. Both test issues were corrected and all 17 advancement plus three rest journeys passed again on the final runtime after the Scholar history and skill-composition fixes. An earlier exploratory broad browser campaign was stopped deliberately and is not counted as a completed campaign. No catalogue revision, automatic rolls, combat module, mobile implementation or migration of real characters.'};
fs.writeFileSync(path.join(base,'.local/advancement-verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
