import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildCatalogue} from '../catalogue.mjs';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(path.join(here,name),'utf8'));
const write=(name,value)=>fs.writeFileSync(path.join(here,name),JSON.stringify(value,null,2)+'\n');
const full=read('final-browser-results.json'),corrective=read('final-browser-corrective-results.json');
assert.deepEqual([full.stats.expected,full.stats.unexpected,full.stats.skipped,full.stats.flaky],[1296,2,0,0]);
assert.deepEqual([corrective.stats.expected,corrective.stats.unexpected,corrective.stats.skipped,corrective.stats.flaky],[6,0,0,0]);
assert.equal(full.errors.length,0);assert.equal(corrective.errors.length,0);
function specs(report){const result=[];function walk(s){for(const x of s.specs??[])result.push(x);for(const x of s.suites??[])walk(x);}report.suites.forEach(walk);return result;}
const key=s=>s.file+'::'+s.title;
const merged=new Map(specs(full).map(s=>[key(s),s]));
const repaired=[];
for(const s of specs(corrective)){
  assert(merged.has(key(s)),'Un parcours correctif doit correspondre à la campagne initiale');
  if(merged.get(key(s)).tests.some(t=>t.status!=='expected'))repaired.push(key(s));
  merged.set(key(s),s);
}
assert.equal(repaired.length,2);assert.equal(merged.size,1298);
for(const s of merged.values())for(const t of s.tests){assert.equal(t.status,'expected');assert.equal(t.results.length,1);assert.equal(t.results[0].status,'passed');}
// Product files are unchanged; only test setup/assertions changed after the full run.
const manifest=read('final-candidate-manifest.json');
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const f of manifest.product)assert.equal(sha(path.join(here,'../maquette',f.file)),f.sha256,f.file);
const c=buildCatalogue(JSON.parse(fs.readFileSync(path.join(here,'../tests/fixtures/rules-2024.json'))));
assert.equal(createHash('sha256').update(JSON.stringify(c)).digest('hex'),manifest.catalogueSha256);
const coverage=[];
for(const sub of c.subclasses){
  const levels=[];
  for(let level=1;level<=20;level++){
    const matched=[...merged.values()].filter(s=>sub.classe_parente==='clerc'
      ? s.file==='cleric.spec.mjs'&&s.title.startsWith(`${sub.nom} niveau ${level} `)
      : s.file==='classes.spec.mjs'&&s.title.startsWith(`${sub.classe_parente} · ${sub.nom} · niveau ${level}`)&&new RegExp(`niveau ${level}(?: |$)`).test(s.title));
    assert.equal(matched.length,sub.classe_parente==='clerc'?2:1,`${sub.id} niveau ${level}`);
    levels.push({level,tests:matched.map(s=>({file:s.file,title:s.title}))});
  }
  coverage.push({id:sub.id,classId:sub.classe_parente,levels});
}
assert.equal(coverage.length,48);
const evidence={completedAt:new Date().toISOString(),status:'passed-after-targeted-test-corrections',
  full:{passed:1296,failed:2,skipped:0,flaky:0,report:'refonte/audit/final-browser-results.json'},
  corrective:{passed:6,failed:0,skipped:0,flaky:0,report:'refonte/audit/final-browser-corrective-results.json',repaired},
  distinctJourneys:1298,remainingFailed:0,productUnchanged:true,
  initialCandidateHash:manifest.sourceHash,currentSourceHash:await sourceFingerprint(),
  qualification:'Campagne complète suivie de six contrôles ciblés. Deux tests corrigés : formulation du texte officiel et choix obligatoires de Doué. Aucun fichier applicatif ni catalogue modifié. Ce résultat ne certifie pas à lui seul les règles documentaires.',coverage};
write('final-browser-verification.json',evidence);
const ledger=read('rules-2024-ledger.json');
let closed=0;
for(const e of ledger.entries.filter(e=>['classes','sous_classes'].includes(e.collection))){
  const matching=coverage.filter(s=>e.collection==='classes'?s.classId===e.id:s.id===e.id);
  assert.equal(matching.length,e.collection==='classes'?4:1,`Couverture absente : ${e.id}`);
  if(e.status==='verified')continue;
  assert(e.source&&e.fieldsCompared?.length&&e.scope,`Comparaison documentaire absente : ${e.id}`);
  if(e.status!=='verified')closed++;
  e.status='verified';e.verifiedAt=evidence.completedAt;
  e.verification={documentaryScope:e.scope,unitEvidence:'refonte/audit/final-unit-verification.json',browserEvidence:'refonte/audit/final-browser-verification.json',subclasses:matching.map(s=>s.id),levels:'1-20'};
  e.previousComparisonNote??=e.note;
  e.note='Comparaison documentaire conservée ; calculs, choix, création, sauvegarde et réouverture couverts aux niveaux 1 à 20. Sorts, dons et profils individuels restent suivis séparément.';
}
write('rules-2024-ledger.json',ledger);
const status=read('rules-2024-status.json');
for(const m of status.modules.filter(m=>['classes','sous_classes'].includes(m.id))){m.verified=ledger.entries.filter(e=>e.collection===m.id&&e.status==='verified').length;m.status='verified';}
status.updatedAt=evidence.completedAt;
status.phase='Campagne complète :1296 réussites et2 échecs de tests, résolus par6 contrôles ciblés tous réussis.1298 parcours distincts couverts ;12 classes et48 sous-classes clôturées. Rapprochement des autres entrées avant gel.';
status.verification.finalCampaign.status='passed-after-targeted-test-corrections';
status.verification.finalCampaign.corrective=evidence.corrective;
status.verification.finalCampaign.distinctJourneys=1298;
status.verification.finalCampaign.remainingFailed=0;
status.verification.finalCampaign.evidence='refonte/audit/final-browser-verification.json';
status.blockers=['Rapprocher les preuves documentaires et les tests du reste du catalogue avant clôture.','Finaliser le bilan, la sauvegarde de la version gelée et le gel local ; aucune publication.'];
write('rules-2024-status.json',status);
console.log(JSON.stringify({distinctJourneys:1298,newlyClosed:closed,closed:ledger.entries.filter(e=>e.status==='verified').length,frozen:false}));
