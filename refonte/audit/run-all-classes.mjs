import {readFile,writeFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from './class-fixtures.mjs';
import {clericFixture} from './cleric-1-10.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {classProfile} from '../maquette/character-rules.mjs';
import {classChoiceSpecs} from '../maquette/class-profiles.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../data/rules-mongodb.json',import.meta.url))));
const rows=[];
for(const cls of c.classes)for(const sub of c.subclasses.filter(x=>x.classe_parente===cls.id))for(let level=1;level<=20;level++)for(const vocation of cls.id==='clerc'?['Protecteur','Thaumaturge']:['']){
  const s=cls.id==='clerc'?clericFixture(c,level,sub.id,vocation):classFixture(c,cls.id,level,sub.id),m=sheetModel(s,c),p=classProfile(s,c);
  rows.push({classId:cls.id,subclassId:sub.id,level,vocation,status:m.errors.length?'a_corriger':'integration_verifiee',issues:m.errors,notices:m.ruleNotices,hp:m.hp,ac:m.ac,dc:m.magic.dc,attacks:m.attacksPerAction,unresolved:m.spells.filter(x=>x.unresolved).map(x=>x.nom),manualChoices:classChoiceSpecs(s,c).filter(x=>x.kind).map(x=>x.nom)});
}
const pending=[...new Set(rows.flatMap(r=>r.unresolved))],report={policy:'bdd-actuelle',classes:c.classes.length,subclasses:c.subclasses.length,scenarios:rows.length,errors:rows.filter(r=>r.issues.length).length,pending,rows};
await writeFile(new URL('./toutes-classes.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const summary=c.classes.map(cls=>{const set=rows.filter(r=>r.classId===cls.id);return `| ${cls.nom} | ${c.subclasses.filter(s=>s.classe_parente===cls.id).length} | ${set.length} | ${set.filter(r=>r.issues.length).length} |`;});
await writeFile(new URL('./TOUTES-CLASSES.md',import.meta.url),`# Intégration des douze classes\n\n${report.scenarios} scénarios de création, ${report.errors} scénario en erreur. La BDD reste la référence ; ce résultat ne valide pas la conformité documentaire de toutes ses règles au Manuel 2024.\n\n| Classe | Sous-classes | Scénarios 1–20 | Erreurs |\n|---|---:|---:|---:|\n${summary.join('\n')}\n\n## Données à préciser\n\nLes entrées suivantes n’ont pas de correspondance certaine : ${pending.join(', ')}. La création exige leur confirmation explicite et la fiche garde un avertissement, sans niveau, DD ni effet inventé.\n\nLe DD psionique de l’Âme acérée, les disciplines élémentaires du moine et certains paramètres du compagnon restent à renseigner avec le MJ, car leur détail manque dans la BDD. Les sorts classés sous un rang contradictoire conservent le rang réel de leur fiche et un avertissement si aucun emplacement n’est disponible.\n\nLes compléments sont tracés dans COMPLEMENTS-CLASSES.md et les fichiers data/*supplements.json, missing-spells.json et invocations.json. Aucun personnage existant n’est modifié automatiquement. Voir E2E-PC.md pour la dernière exécution navigateur et le contrôle MongoDB réel.\n`);
console.log(JSON.stringify({classes:report.classes,subclasses:report.subclasses,scenarios:report.scenarios,errors:report.errors,pending}));if(report.errors)process.exitCode=1;
