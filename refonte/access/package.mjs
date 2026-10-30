import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertRulesReady} from '../rules-release.mjs';
import {sourceFingerprint} from '../e2e/fingerprint.mjs';
const refonte=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target=process.argv[2];if(!target||!path.isAbsolute(target))throw new Error('Absolute staging directory required');
const rulesStatus=JSON.parse(await readFile(path.join(refonte,'audit/rules-2024-status.json'),'utf8'));
const rulesLedger=JSON.parse(await readFile(path.join(refonte,'audit/rules-2024-ledger.json'),'utf8'));
const rulesRevision=JSON.parse(await readFile(path.join(refonte,'data/rules-2024-corrections.json'),'utf8'));
assertRulesReady(rulesStatus,rulesLedger,rulesRevision);
// Reuse a current, explicit verification proof; otherwise run the full suite.
const proofPath=process.argv[3];
if(proofPath){
  const proof=JSON.parse(await readFile(proofPath,'utf8'));
  if(proof.status!=='passed'||proof.sourceHash!==await sourceFingerprint()||!['full','mongodb-runtime-with-unchanged-rules-baseline','character-removal-with-unchanged-rules-baseline','portal-with-unchanged-rules-baseline','pdf-weapons-with-unchanged-rules-baseline','signup-with-unchanged-rules-baseline','library-background-with-unchanged-runtime-baseline','grimoire-reading-with-unchanged-rules-baseline'].includes(proof.scope)||proof.failed!==0||proof.skipped!==0)throw Error('Preuve de vérification absente, périmée ou incomplète.');
}else{
const {spawn}=await import('node:child_process');
const verifier=spawn(process.execPath,[path.join(refonte,'e2e/verify.mjs')],{stdio:'inherit'});
const verification=await new Promise((resolve,reject)=>{verifier.once('error',reject);verifier.once('exit',resolve);});
if(verification!==0)throw new Error('Tests failed: deployment package was not created.');
}

await mkdir(path.join(target,'public/assets'),{recursive:true});await mkdir(path.join(target,'atelier/assets'),{recursive:true});
for(const file of ['index.html','refonte.css','refonte.js','service-worker.js','connexion.html','connexion.js','inscription.html','inscription.js','nginx.conf'])await copyFile(path.join(refonte,'accueil',file),path.join(target,'public',file));
for(const file of ['index.html','app.js','style.css','character-rules.mjs','origin-rules.mjs','character-storage.mjs','character-version.mjs','cleric-progression.mjs','progression.mjs','class-profiles.mjs','beast-companion.mjs','species-rules.mjs','wild-shape.mjs','class-magic.mjs','extra-classes.mjs','warlock-options.mjs','feat-effects.mjs','sheet-model.mjs','sheet-view.mjs','portal-view.mjs','admin-view.mjs','character-pdf.mjs','portal.css','assets/fiche-personnage-2024.pdf','assets/pdf-lib-1.17.1.mjs','assets/pdf-lib-LICENSE.md'])await copyFile(path.join(refonte,'maquette',file),path.join(target,'atelier',file));
await copyFile(path.join(refonte,'../assets/img/fond-bibliotheque-sombre.png'),path.join(target,'atelier/assets/fond-bibliotheque-sombre.png'));
await copyFile(path.join(refonte,'../assets/img/fond-bibliotheque-sombre.png'),path.join(target,'public/assets/fond-bibliotheque-sombre.png'));
await copyFile(path.join(refonte,'../assets/icone/favicon-192.png'),path.join(target,'public/favicon.png'));
await copyFile(path.join(refonte,'access/server.mjs'),path.join(target,'server.mjs'));
await copyFile(path.join(refonte,'access/start.mjs'),path.join(target,'start.mjs'));
for(const file of ['rules-store.mjs','rules-release.json','import-rules.mjs','admin-store.mjs'])await copyFile(path.join(refonte,'access',file),path.join(target,file));
await copyFile(path.join(refonte,'access/character-store.mjs'),path.join(target,'character-store.mjs'));
await copyFile(path.join(refonte,'access/backup-db.mjs'),path.join(target,'backup-db.mjs'));
await writeFile(path.join(target,'background-fixture.mjs'),(await readFile(path.join(refonte,'audit/background-fixture.mjs'),'utf8')).replaceAll('../maquette/','./atelier/'));
await writeFile(path.join(target,'check-class-fixture.mjs'),(await readFile(path.join(refonte,'audit/class-fixtures.mjs'),'utf8')).replaceAll('../maquette/','./atelier/'));
await writeFile(path.join(target,'check-origin-fixture.mjs'),(await readFile(path.join(refonte,'audit/origin-fixtures.mjs'),'utf8')).replaceAll('../maquette/','./atelier/').replace('./class-fixtures.mjs','./check-class-fixture.mjs'));
console.log('Public landing and authenticated workshop packaged.');
