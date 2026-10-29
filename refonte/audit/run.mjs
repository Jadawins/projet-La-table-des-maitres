import {readFile,writeFile} from 'node:fs/promises';
import {buildAudit} from './build-audit.mjs';
const snapshot=JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url),'utf8'));
const report=buildAudit(snapshot);
await writeFile(new URL('./report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const summary=report.summary;
const lines=['# Suivi de vérification des règles 2024','',`Extrait MongoDB : ${report.snapshotDate}. Empreinte : ${report.snapshotHash}.`,'',
  `Périmètre : ${summary.classes} classes, ${summary.subclasses} sous-classes, ${summary.combinations} combinaisons sous-classe/niveau ; ${summary.totalRows} lignes avec les progressions des classes.`,'',
  `Statuts : ${summary.aVerifier} à vérifier, ${summary.anomalies} avec anomalie, ${summary.valides} entièrement validées, ${summary.sansObjet} sans objet (avant le choix de sous-classe).`,'',
  report.validationPolicy,'','## État de l’intégration : clerc','',
  'La BDD actuelle est la référence du développement. Le suivi sert à vérifier que ses choix et calculs sont correctement intégrés. Les comparaisons avec des sources externes sont désactivées par défaut.','',
  '| Élément | À vérifier | Anomalies | Progression chiffrée conforme |','| --- | ---: | ---: | ---: |',
  ...report.groups.filter(g=>g.className==='Clerc').map(g=>`| ${g.name} | ${g.rows.filter(r=>r.status==='a_verifier').length} | ${g.rows.filter(r=>r.status==='anomalie').length} | ${g.rows.filter(r=>r.progression?.status==='valide').length} |`),'',
  '## Comparaisons externes différées','','Les constats précédents sont conservés dans [COMPARAISON-EXTERNE-DIFFEREE.md](COMPARAISON-EXTERNE-DIFFEREE.md). Ils ne déclenchent pas de correction et ne servent pas à bloquer les choix du créateur.','',
  '## Suite du contrôle','',
  '1. Vérifier que chaque choix prévu par la BDD apparaît dans le parcours au bon niveau.','2. Tester les calculs, quotas et changements de niveau à partir des valeurs de la BDD.','3. Résoudre les liaisons de données manquantes sans remplacer les règles par une autre version.','4. Valider les cases après vérification des choix et de leur fonctionnement dans l’application.','5. Examiner ultérieurement les changements et errata dans une démarche séparée.','',
  'Aucune écriture dans MongoDB. Les substitutions de contenu issues des comparaisons externes ont été retirées du catalogue local. Les normalisations de formats ne modifient pas le texte des règles.','',
  '## Reproduire','', '`node refonte/audit/run.mjs` régénère le rapport à partir de l’extrait local. L’interface se consulte à `/audit.html` avec le serveur local.',''];
await writeFile(new URL('./SUIVI.md',import.meta.url),lines.join('\n'));
console.log(JSON.stringify(summary,null,2));
