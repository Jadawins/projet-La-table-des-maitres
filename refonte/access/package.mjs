import {publicHome} from '../accueil/home-template.mjs';
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
  if(proof.status!=='passed'||proof.sourceHash!==await sourceFingerprint()||!['full','mongodb-runtime-with-unchanged-rules-baseline','character-removal-with-unchanged-rules-baseline','portal-with-unchanged-rules-baseline','pdf-weapons-with-unchanged-rules-baseline','signup-with-unchanged-rules-baseline','library-background-with-unchanged-runtime-baseline','grimoire-reading-with-unchanged-rules-baseline','source-attribution-with-unchanged-rules-baseline','books-notice-with-unchanged-rules-baseline','editorial-texts-with-unchanged-mechanics-baseline','non-srd-rewrite-with-unchanged-mechanics-baseline','feat-rewrite-with-unchanged-mechanics-baseline','final-editorial-review-with-unchanged-mechanics-baseline','play-state-with-unchanged-rules-baseline','spell-rest-with-unchanged-rules-baseline','conditions-with-unchanged-rules-baseline','advancement-and-multiclass-with-frozen-catalogue','admin-accounts-with-unchanged-characters-baseline','groups-with-frozen-characters-baseline','combat-with-frozen-character-rules-baseline','bestiary-with-frozen-character-rules-baseline','attacks-with-explicit-dice-and-mj-confirmation','groups-removal-and-role-choice','home-news-and-roadmap-with-unchanged-gameplay','spell-combat-with-durable-confirmed-effects','admin-character-consultation-and-owner-preserving-edits','inventory-and-private-mj-message-popups','equipment-and-confirmed-consumables-with-frozen-catalogue','wallet-purchases-and-sales-with-frozen-catalogue','mj-loot-with-durable-per-character-receipts','combat-potions-with-durable-consumption-and-healing','starting-languages-with-frozen-catalogue','group-gifts-with-durable-debit-and-credit'].includes(proof.scope)||proof.failed!==0||proof.skipped!==0)throw Error('Preuve de vérification absente, périmée ou incomplète.');
}else{
const {spawn}=await import('node:child_process');
const verifier=spawn(process.execPath,[path.join(refonte,'e2e/verify.mjs')],{stdio:'inherit'});
const verification=await new Promise((resolve,reject)=>{verifier.once('error',reject);verifier.once('exit',resolve);});
if(verification!==0)throw new Error('Tests failed: deployment package was not created.');
}

await mkdir(path.join(target,'public/assets'),{recursive:true});await mkdir(path.join(target,'atelier/assets'),{recursive:true});
for(const file of ['refonte.css','refonte.js','service-worker.js','connexion.html','connexion.js','inscription.html','inscription.js','sources.html','nginx.conf'])await copyFile(path.join(refonte,'accueil',file),path.join(target,'public',file));
await writeFile(path.join(target,'public/index.html'),publicHome());
await copyFile(path.join(refonte,'maquette/home.css'),path.join(target,'public/home.css'));
for(const file of ['home-content.mjs','home.css','index.html','app.js','style.css','character-rules.mjs','origin-rules.mjs','group-messages.mjs','inventory-state.mjs','inventory-view.mjs','equipment-state.mjs','equipment-view.mjs','wallet-state.mjs','wallet-view.mjs','loot-rules.mjs','loot-view.mjs','gift-rules.mjs','gift-view.mjs','language-rules.mjs','character-storage.mjs','character-version.mjs','cleric-progression.mjs','progression.mjs','class-profiles.mjs','beast-companion.mjs','species-rules.mjs','wild-shape.mjs','class-magic.mjs','extra-classes.mjs','warlock-options.mjs','feat-effects.mjs','multiclass-rules.mjs','character-advancement.mjs','condition-rules.mjs','condition-view.mjs','play-state.mjs','play-view.mjs','sheet-model.mjs','sheet-view.mjs','portal-view.mjs','group-view.mjs','groups.css','combat-view.mjs','spell-combat-view.mjs','potion-combat-view.mjs','attack-view.mjs','bestiary-view.mjs','combat.css','admin-view.mjs','character-pdf.mjs','portal.css','assets/fiche-personnage-2024.pdf','assets/pdf-lib-1.17.1.mjs','assets/pdf-lib-LICENSE.md'])await copyFile(path.join(refonte,'maquette',file),path.join(target,'atelier',file));
await copyFile(path.join(refonte,'../assets/img/fond-bibliotheque-sombre.png'),path.join(target,'atelier/assets/fond-bibliotheque-sombre.png'));
await copyFile(path.join(refonte,'../assets/img/fond-bibliotheque-sombre.png'),path.join(target,'public/assets/fond-bibliotheque-sombre.png'));
await copyFile(path.join(refonte,'../assets/icone/favicon-192.png'),path.join(target,'public/favicon.png'));
await copyFile(path.join(refonte,'access/server.mjs'),path.join(target,'server.mjs'));
await copyFile(path.join(refonte,'access/start.mjs'),path.join(target,'start.mjs'));
for(const file of ['group-messages.mjs','rules-store.mjs','rules-release.json','import-rules.mjs','admin-store.mjs','auth-accounts.mjs','group-store.mjs','combat-store.mjs','spell-rules.mjs','combat-spells.mjs','combat-attacks.mjs','attack-rules.mjs','bestiary-store.mjs'])await copyFile(path.join(refonte,'access',file),path.join(target,file));
await copyFile(path.join(refonte,'access/character-store.mjs'),path.join(target,'character-store.mjs'));
await copyFile(path.join(refonte,'access/backup-db.mjs'),path.join(target,'backup-db.mjs'));
await writeFile(path.join(target,'background-fixture.mjs'),(await readFile(path.join(refonte,'audit/background-fixture.mjs'),'utf8')).replaceAll('../maquette/','./atelier/'));
await writeFile(path.join(target,'check-class-fixture.mjs'),(await readFile(path.join(refonte,'audit/class-fixtures.mjs'),'utf8')).replaceAll('../maquette/','./atelier/'));
await writeFile(path.join(target,'check-origin-fixture.mjs'),(await readFile(path.join(refonte,'audit/origin-fixtures.mjs'),'utf8')).replaceAll('../maquette/','./atelier/').replace('./class-fixtures.mjs','./check-class-fixture.mjs'));
console.log('Public landing and authenticated workshop packaged.');

await writeFile(path.join(target,'check-advancement-fixture.mjs'),(await readFile(path.join(refonte,'audit/advancement-fixture.mjs'),'utf8')).replaceAll('../maquette/','./atelier/'));

await writeFile(path.join(target,'combat-spells.mjs'),(await readFile(path.join(refonte,'access/combat-spells.mjs'),'utf8')).replaceAll('../maquette/','./atelier/'));

await writeFile(path.join(target,'group-loot.mjs'),(await readFile(path.join(refonte,'access/group-loot.mjs'),'utf8')).replaceAll('../maquette/','./atelier/'));

await writeFile(path.join(target,'combat-potions.mjs'),(await readFile(path.join(refonte,'access/combat-potions.mjs'),'utf8')).replaceAll('../maquette/','./atelier/'));

await writeFile(path.join(target,'group-gifts.mjs'),(await readFile(path.join(refonte,'access/group-gifts.mjs'),'utf8')).replaceAll('../maquette/','./atelier/'));
