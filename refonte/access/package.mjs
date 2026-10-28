import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCatalogue} from '../catalogue.mjs';
const refonte=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target=process.argv[2];if(!target||!path.isAbsolute(target))throw new Error('Absolute staging directory required');
// Run the complete test suite before creating any deployable directory.
const {spawn}=await import('node:child_process');
const verifier=spawn(process.execPath,[path.join(refonte,'e2e/verify.mjs')],{stdio:'inherit'});
const verification=await new Promise((resolve,reject)=>{verifier.once('error',reject);verifier.once('exit',resolve);});
if(verification!==0)throw new Error('Tests failed: deployment package was not created.');

await mkdir(path.join(target,'public'),{recursive:true});await mkdir(path.join(target,'atelier/assets'),{recursive:true});
for(const file of ['index.html','refonte.css','refonte.js','service-worker.js','connexion.html','connexion.js','nginx.conf'])await copyFile(path.join(refonte,'accueil',file),path.join(target,'public',file));
for(const file of ['index.html','app.js','style.css','character-rules.mjs','origin-rules.mjs','character-storage.mjs','cleric-progression.mjs','progression.mjs','class-profiles.mjs','class-magic.mjs','extra-classes.mjs','warlock-options.mjs','feat-effects.mjs','sheet-model.mjs','sheet-view.mjs'])await copyFile(path.join(refonte,'maquette',file),path.join(target,'atelier',file));
await copyFile(path.join(refonte,'../assets/img/fond-bibliotheque-sombre.png'),path.join(target,'atelier/assets/fond-bibliotheque-sombre.png'));
const snapshot=JSON.parse(await readFile(path.join(refonte,'data/rules-mongodb.json'),'utf8'));
await writeFile(path.join(target,'atelier/catalogue.json'),JSON.stringify(buildCatalogue(snapshot)));
await copyFile(path.join(refonte,'access/server.mjs'),path.join(target,'server.mjs'));
await copyFile(path.join(refonte,'access/start.mjs'),path.join(target,'start.mjs'));
await copyFile(path.join(refonte,'access/character-store.mjs'),path.join(target,'character-store.mjs'));
for(const file of ['backup-db.mjs','check-persistence.mjs'])await copyFile(path.join(refonte,'access',file),path.join(target,file));
await writeFile(path.join(target,'check-class-fixture.mjs'),(await readFile(path.join(refonte,'audit/class-fixtures.mjs'),'utf8')).replaceAll('../maquette/','./atelier/'));
await writeFile(path.join(target,'check-origin-fixture.mjs'),(await readFile(path.join(refonte,'audit/origin-fixtures.mjs'),'utf8')).replaceAll('../maquette/','./atelier/').replace('./class-fixtures.mjs','./check-class-fixture.mjs'));
console.log('Public landing and authenticated workshop packaged.');
