import {readFile,writeFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from './class-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {classProfile} from '../maquette/character-rules.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../data/rules-mongodb.json',import.meta.url))));
const rows=[];
for(const id of ['barbare','rodeur','barde','druide'])for(const sub of c.subclasses.filter(s=>s.classe_parente===id))for(let level=1;level<=20;level++){
  const s=classFixture(c,id,level,sub.id),m=sheetModel(s,c),p=classProfile(s,c);
  rows.push({classId:id,subclassId:sub.id,level,status:m.errors.length?'a_corriger':'integration_verifiee',issues:m.errors,hp:m.hp,ac:m.ac,dc:m.magic.dc,cantrips:p.cantripCount,prepared:p.preparedCount,missingSpells:p.missingSpells});
}
const report={policy:'bdd-actuelle',scope:'Ordinateur, création et fiche. 4 classes × 4 sous-classes × 20 niveaux.',rows,notes:['Intégration des données présentes ; ne constitue pas une validation documentaire globale des règles 2024.','Les terrains de la Terre restent ceux de la BDD, correspondant à une version antérieure. Listes manquantes complétées et tracées dans class-supplements.json.','Les valeurs permanentes sont calculées ; les conditions de combat restent consultables. Les PV ambigus du compagnon incluent un complément renseigné par le joueur avec le MJ.']};
await writeFile(new URL('./classes-prioritaires.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
await writeFile(new URL('./CLASSES-PRIORITAIRES.md',import.meta.url),`# Intégration des quatre classes prioritaires\n\n${rows.length} combinaisons classe/sous-classe/niveau ; ${rows.filter(r=>r.issues.length).length} combinaison en erreur.\n\n${report.notes.map(n=>'- '+n).join('\n')}\n\nLes parcours navigateur couvrent les seize sous-classes aux niveaux 1, 3, 6, 10 et 20, avec sauvegarde et réouverture. Les tests de calcul et de validation couvrent chaque niveau 1–20. Voir E2E-PC.md pour la dernière exécution complète.\n`);
if(rows.some(r=>r.issues.length))process.exitCode=1;
console.log(`${rows.length} combinaisons, ${rows.filter(r=>r.issues.length).length} erreur.`);
