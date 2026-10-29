import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {sourceFingerprint} from './fingerprint.mjs';
import {buildCatalogue} from '../catalogue.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),require=createRequire(import.meta.url);
async function checkProduct(){
  const reference=JSON.parse(await readFile(path.join(root,'refonte/audit/e2e-product-baseline.json'),'utf8'));
  for(const [name,expected]of Object.entries(reference.manifest)){
    const data=name==='catalogue'?JSON.stringify(buildCatalogue(JSON.parse(await readFile(path.join(root,'refonte/tests/fixtures/rules-2024.json'),'utf8')))):await readFile(path.join(root,name));
    if(createHash('sha256').update(data).digest('hex')!==expected)throw Error('Application différente de la référence : '+name+'. Les résultats précédents ne sont pas réutilisables.');
  }
}
try{
  const startedAt=new Date().toISOString(),sourceHash=await sourceFingerprint();
  const baseline=JSON.parse(await readFile(path.join(root,'refonte/audit/e2e-baseline-20261028T145508Z.json'),'utf8'));
  if(baseline.status!=='passed'||baseline.browserTests!==442||baseline.stats.unexpected||baseline.stats.skipped||baseline.stats.flaky)throw Error('Preuve précédente invalide.');
  await checkProduct();
  console.log('442 parcours et 2 360 tests de règles déjà réussis : conservés, sans relance.');
  console.log('652 nouveaux parcours uniquement ; aucun clerc ni palier précédemment testé.');
  const child=spawn(process.execPath,[require.resolve('@playwright/test/cli'),'test','specs/classes.spec.mjs','--grep','@complement'],{cwd:here,stdio:'inherit'});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  if(code!==0)throw Error('Un nouveau parcours demande une correction.');
  const r=JSON.parse(await readFile(path.join(here,'test-results/results.json'),'utf8'));
  if(r.stats.expected!==652||r.stats.unexpected||r.stats.skipped||r.stats.flaky)throw Error('Parcours manquant, ignoré ou instable.');
  await checkProduct();if(await sourceFingerprint()!==sourceHash)throw Error('Les sources de test ont changé pendant cette exécution.');
  const proof={type:'additional-levels',status:'passed',startedAt,completedAt:new Date().toISOString(),sourceHash,baselineSourceHash:baseline.sourceHash,baselineRelease:baseline.release,previousBrowserTests:442,additionalBrowserTests:652,combinedCoverage:1094,unchangedProduct:true,unitTestsRerun:false,policy:'Deux exécutions sur la même application. Ce fichier ne remplace pas la preuve de vérification complète exigée par package.mjs.'};
  await writeFile(path.join(here,'test-results/complement-verification.json'),JSON.stringify(proof,null,2));
  await writeFile(path.join(root,'refonte/audit/e2e-complement-levels.json'),JSON.stringify(proof,null,2));
  console.log('652 nouveaux parcours réussis. Couverture cumulée : 1 094 parcours sur une application identique.');
}catch(error){console.error(error.message);process.exitCode=1;}
