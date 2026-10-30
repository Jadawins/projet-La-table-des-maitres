import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildCatalogue} from '../catalogue.mjs';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(base);
const read=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const baseline=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
// The catalogue, character calculations, storage contract and frozen rule data
// retain the previous full browser campaign as their baseline.
for(const file of ['catalogue.mjs','maquette/character-rules.mjs','maquette/sheet-model.mjs','maquette/character-storage.mjs','access/character-store.mjs','data','tests/fixtures/rules-2024.json']){
  const result=spawnSync('git',['diff','--exit-code','HEAD','--','refonte/'+file],{cwd:root});assert.equal(result.status,0,'Rules/storage baseline changed: '+file);
}
const release=read('access/rules-release.json'),catalogue=buildCatalogue(read('tests/fixtures/rules-2024.json'));
assert.equal(createHash('sha256').update(JSON.stringify(catalogue)).digest('hex'),release.sha256);
const log=fs.readFileSync(path.join(base,'.local/portal-unit-tests.txt'),'utf8');
for(const line of ['tests 3981','pass 3981','fail 0','skipped 0','cancelled 0'])assert(log.split(/\r?\n/).some(v=>v.endsWith(line)),'Unit result missing: '+line);
const browser=read('e2e/test-results/results.json');assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[24,0,0,0]);assert.equal(browser.errors.length,0);
const pdf=read('.local/pdf-inspection.json');assert.equal(pdf.status,'passed');assert.equal(pdf.files.length,2);
const proof={status:'passed',scope:'portal-with-unchanged-rules-baseline',sourceHash:await sourceFingerprint(),completedAt:new Date().toISOString(),failed:0,skipped:0,unitPassed:3981,browserPassed:24,baselineCommit:baseline,rulesSha256:release.sha256,pdfTemplateSha256:createHash('sha256').update(fs.readFileSync(path.join(base,'maquette/assets/fiche-personnage-2024.pdf'))).digest('hex'),qualification:'Home, catalogue search, admin identity/permissions, copy/transfer and actual supplied fillable PDF tested. Existing character storage/calculation/rules unchanged. Synthetic real MongoDB controls required before and after deployment.'};
fs.writeFileSync(path.join(base,'.local/portal-verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
