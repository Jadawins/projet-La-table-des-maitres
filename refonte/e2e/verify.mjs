import {spawn} from 'node:child_process';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import path from 'node:path';
import {sourceFingerprint} from './fingerprint.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const require=createRequire(import.meta.url);
async function run(args,cwd){
  const child=spawn(process.execPath,args,{cwd,stdio:'inherit'});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  if(code!==0)throw Error(`Vérification échouée (${code}). Aucun paquet déployable n’est créé.`);
}
try{
  const startedAt=new Date().toISOString(),fingerprint=await sourceFingerprint();
  const tests=(await readdir(path.join(root,'refonte/tests'))).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>path.join(root,'refonte/tests',f));
  console.log('1/2 — Calculs et validation');
  await run(['--test',...tests],root);
  console.log('2/2 — Parcours dans le navigateur');
  await run([require.resolve('@playwright/test/cli'),'test'],here);
  const results=JSON.parse(await readFile(path.join(here,'test-results/results.json'),'utf8'));
  if(!results.stats.expected||results.stats.unexpected||results.stats.skipped||results.stats.flaky)throw Error('Parcours manquants, ignorés ou en échec.');
  if(await sourceFingerprint()!==fingerprint)throw Error('Les sources ont changé pendant les tests. Relancer la vérification.');
  await writeFile(path.join(here,'test-results/verification.json'),JSON.stringify({startedAt,completedAt:new Date().toISOString(),sourceHash:fingerprint,browserTests:results.stats.expected,status:'passed'},null,2));
  console.log(`Vérification complète : ${results.stats.expected} parcours navigateur réussis.`);
}catch(error){console.error(error.message);process.exitCode=1;}
