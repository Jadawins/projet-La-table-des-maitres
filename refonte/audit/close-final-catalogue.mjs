import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=file=>JSON.parse(fs.readFileSync(path.join(here,file),'utf8'));
const write=(file,value)=>fs.writeFileSync(path.join(here,file),JSON.stringify(value,null,2)+'\n');
const log=fs.readFileSync(path.join(here,'final-catalogue-tests.txt'),'utf8');
for(const line of ['# tests 1106','# pass 1106','# fail 0','# cancelled 0','# skipped 0','# todo 0'])assert(log.split(/\r?\n/).includes(line),line);
const browser=read('final-browser-verification.json');assert.equal(browser.remainingFailed,0);assert.equal(browser.distinctJourneys,1298);
const evidence=new Map();
function add(collection,id,file,title){assert(log.includes(` - ${title}\n`)||log.includes(` - ${title}\r\n`),title);evidence.set(collection+'/'+id,{documentaryEvidence:'refonte/audit/'+file,test:title});}
for(const r of read('spell-comparisons-2024.json').entries)add('sorts',r.id,'spell-comparisons-2024.json',`Référence complète du sort ${r.id}`);
const presence=read('final-presence-reference-2024.json');add('sorts',presence.id,'final-presence-reference-2024.json',`Référence complète du sort ${presence.id}`);
for(const r of read('feat-reference-2024.json').entries)add('dons',r.id,'feat-reference-2024.json',`Référence du don ${r.id}`);
for(const r of read('equipment-reference-2024.json').entries)add(r.collection,r.id,'equipment-reference-2024.json',`Référence équipement ${r.collection}/${r.id}`);
for(const [name,collection]of [['animal','formes_animales'],['dragon','formes_draconiques'],['familiar','familiers']])for(const r of read(`${name}-reference-2024.json`).entries)add(collection,r.id,`${name}-reference-2024.json`,`Profil officiel ${collection}/${r.id}`);
for(const r of read('complementary-spells-2024-preparation.json').after)add('sorts_complements',r.id,'complementary-spells-2024-preparation.json',`Sort complémentaire ${r.id} : référence et archivage`);
for(const r of read('invocations-2024-preparation.json').after.options)add('invocations',r.id,'invocations-2024-preparation.json',`Manifestation ${r.id} : référence`);
for(const r of read('../data/rules-2024-corrections.json').additions){
  const title=`Absence complétée ${r.collection}/${r.id} : contenu de référence`;
  assert(log.includes(` - ${title}\n`)||log.includes(` - ${title}\r\n`));
  evidence.set(r.collection+'/'+r.id,{documentaryEvidence:'refonte/data/rules-2024-corrections.json',test:title});
}
const ledger=read('rules-2024-ledger.json'),status=read('rules-2024-status.json');
const completedAt=new Date().toISOString(),rows=[];
for(const e of ledger.entries){
  if(e.status==='verified')continue;
  if(e.status==='reference-unavailable'){assert(e.excludedFromCreation&&e.exclusionEvidence&&e.source&&e.note);continue;}
  assert.equal(e.status,'data-compared-tests-pending',e.id);assert(e.source&&e.fieldsCompared?.length,e.id);
  const proof=evidence.get(e.collection+'/'+e.id);assert(proof,`Preuve documentaire absente ${e.collection}/${e.id}`);
  if(e.id===presence.id){e.scope=presence.scope;e.fieldsCompared=Object.keys(presence.fields);}
  if(['sorts','sorts_complements'].includes(e.collection)&&e.id!=='couronne_de_folie')assert(log.includes(`Fiche de sort ${e.id} : texte, paramètres et valeurs d'incantation`),e.id);
  e.previousComparisonNote??=e.note;e.status='verified';e.verifiedAt=completedAt;
  e.verification={...proof,unitEvidence:'refonte/audit/final-unit-verification.json',catalogueEvidence:'refonte/audit/final-catalogue-tests.txt',browserEvidence:'refonte/audit/final-browser-verification.json',scope:'Comparaison documentaire enregistrée + contrôle des champs effectivement intégrés ; rendu des sorts et contrôles fonctionnels concernés. Ne certifie pas une gestion automatique du combat.'};
  e.note='Comparaison et intégration contrôlées. Le texte complet reste consultable ; les effets conditionnels et les dépenses en partie sont appliqués explicitement par le joueur.';
  rows.push({collection:e.collection,id:e.id,...proof});
}
assert.equal(rows.length,713);
const summary={completedAt,status:'passed',catalogueTests:{passed:1106,failed:0,skipped:0,cancelled:0,log:'refonte/audit/final-catalogue-tests.txt'},distinctUnitTests:3948,previousDistinctUnitTests:2842,newUnitTests:1106,newlyClosed:rows.length,verified:ledger.entries.filter(e=>e.status==='verified').length,excluded:ledger.entries.filter(e=>e.status==='reference-unavailable').map(e=>({collection:e.collection,id:e.id,note:e.note})),entries:rows};
assert.equal(summary.verified,809);assert.equal(summary.excluded.length,5);
write('final-catalogue-verification.json',summary);write('rules-2024-ledger.json',ledger);
for(const m of status.modules){m.verified=ledger.entries.filter(e=>e.collection===m.id&&e.status==='verified').length;m.status=m.verified===m.total?'verified':'verified-with-documented-exclusions';}
status.updatedAt=completedAt;status.phase='809 entrées clôturées ;5 variantes animales sans référence exclues des nouveaux choix.3948 contrôles unitaires distincts et1298 parcours navigateur couverts. Bilan et archive finale avant gel local.';
status.verification.catalogueFinal=summary.catalogueTests;
status.blockers=['Finaliser le bilan et vérifier la sauvegarde de la version gelée avant le gel local.'];
write('rules-2024-status.json',status);
console.log(JSON.stringify({newlyClosed:713,verified:809,excluded:5,frozen:false}));
