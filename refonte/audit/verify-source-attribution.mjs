import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildCatalogue} from '../catalogue.mjs';
import {catalogueEntries,renderCatalogueDetail,renderGrimoire} from '../maquette/portal-view.mjs';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(base);
const git=(...args)=>spawnSync('git',args,{cwd:root,encoding:'utf8'});
const changed=git('diff','HEAD','--name-only','--','refonte/maquette','refonte/access','refonte/accueil').stdout.trim().split(/\r?\n/).filter(Boolean);
const allowed=['maquette/portal-view.mjs','maquette/portal.css','maquette/index.html','access/package.mjs','accueil/index.html','accueil/connexion.html','accueil/inscription.html','accueil/refonte.css','accueil/nginx.conf','accueil/sources.html'].map(f=>'refonte/'+f);
for(const file of changed)assert(allowed.includes(file),'Unexpected runtime change: '+file);
for(const file of ['catalogue.mjs','data','tests/fixtures/rules-2024.json'])assert.equal(git('diff','--exit-code','HEAD','--','refonte/'+file).status,0,'Unchanged rules baseline required');
const read=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const inventory=read('audit/description-provenance-2024.json');
assert.equal(inventory.summary.catalogueSha256,read('access/rules-release.json').sha256);
const entries=catalogueEntries(buildCatalogue(read('tests/fixtures/rules-2024.json')));
for(const html of [renderGrimoire(),...entries.map(e=>renderCatalogueDetail(entries,e.type,e.id))]){
  assert(html.includes('aria-label="Sources du grimoire"'));
  assert(html.includes('https://creativecommons.org/licenses/by/4.0/legalcode'));
  assert(!html.includes('[object Object]')&&!html.includes('undefined'));
}
const log=fs.readFileSync(path.join(base,'.local/attribution-unit-tests.txt'),'utf8');for(const line of ['tests 3','pass 3','fail 0','skipped 0'])assert(log.split(/\r?\n/).some(v=>v.endsWith(line)),line);
const browser=read('e2e/test-results/results.json');assert.deepEqual([browser.stats.expected,browser.stats.unexpected,browser.stats.skipped,browser.stats.flaky],[3,0,0,0]);
const review=read('.local/attribution-visual-review.json');assert.equal(review.status,'passed');assert.deepEqual(review.views,['liste','sort']);assert.equal(review.publicPages,4);assert.equal(review.pageErrors,0);
const proof={status:'passed',scope:'source-attribution-with-unchanged-rules-baseline',sourceHash:await sourceFingerprint(),completedAt:new Date().toISOString(),failed:0,skipped:0,baselineCommit:git('rev-parse','HEAD').stdout.trim(),unitPassed:3,browserPassed:3,renderedEntries:entries.length,publicPagesReviewed:4,attributionViews:2,qualification:'SRD attribution and public sources page only. All Grimoire renderers retain the credit; public links, list/detail visibility and account/admin isolation journeys pass. Rules, descriptions, PDF, character storage and authentication remain unchanged. Text provenance inventory is documentary, not copyright clearance.'};
fs.writeFileSync(path.join(base,'.local/source-attribution-verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
