import {readFile,writeFile} from 'node:fs/promises';
import {buildClericAudit} from './cleric-1-10.mjs';
const snapshot=JSON.parse(await readFile(new URL('../data/rules-mongodb.json',import.meta.url),'utf8'));
const report=buildClericAudit(snapshot,{maxLevel:20});
await writeFile(new URL('./clerc-1-20.json',import.meta.url),JSON.stringify(report,null,2));
const lines=[
 '# Clerc 1–20 — intégration de la BDD actuelle','',
 'Quatre domaines, vingt niveaux et deux vocations : 80 lignes et 160 scénarios. Ce contrôle vérifie la création, les calculs et la fiche selon la BDD ; il ne constitue pas une certification documentaire des règles 2024.','',
 '| Domaine | Niveau | Mineurs Protecteur / Thaumaturge | Préparés | Maîtrise | Canal divin | Éclat sacré | Sorts à relier |',
 '|---|---:|---:|---:|---:|---:|---|---|',
 ...report.rows.map(r=>{const [p,t]=r.variations;return `| ${r.domain} | ${r.level} | ${p.cantrips} / ${t.cantrips} | ${p.prepared} | +${p.proficiency} | ${p.channel} | ${p.sparkDice||'—'} | ${r.unlinkedSpells.join(', ')||'—'} |`;}),
 '', '## Couverture', '',
 '- Paliers 4, 8, 12 et 16 ; don ou faveur épique au niveau 19. Prérequis évalués au palier d’acquisition. Plafond de 20, ou 30 lorsque le don l’indique.',
 '- Choix et effets des douze faveurs présentes : expertise, résistances, sort supplémentaire, PV, vitesse, vision lucide et effets conditionnels décrits.',
 '- Ressources et emplacements hérités jusqu’au niveau 20, sorts jusqu’au rang 9, aptitudes des domaines au niveau 17 et Grâce divine suprême au niveau 20.',
 '- Frappe consacrée améliorée au niveau 14 selon l’option choisie, dégâts des sorts mineurs aux seuils 5/11/17, Constitution finale appliquée à tous les niveaux de PV.',
 '- Sauvegarde et reprise des cinq paliers, des choix de dons et des dons d’origine tardifs, sans migration automatique des personnages existants.',
 '', '## Limites', '',
 'Les sorts de domaine de niveau 17 sont reliés à leur fiche réelle : Régénération et Résurrection apparaissent au rang 7 malgré la rubrique de rang 5 dans la liste brute du domaine Vie. Le palier d’acquisition BDD 17 est conservé. Aucune correction supplémentaire des règles sources n’est faite.',
 'Les effets dépendant d’une action, d’une cible, d’un état ou d’un environnement restent décrits avec leurs conditions ; la fiche ne pilote pas le combat. Le téléphone reste hors périmètre.',
 '', `Résultat : ${report.rows.filter(r=>r.status==='a_corriger').length} ligne en échec.`, ''
];
await writeFile(new URL('./CLERC-1-20.md',import.meta.url),lines.join('\n'));
console.log(`${report.rows.length} lignes / ${report.rows.flatMap(r=>r.variations).length} scénarios, ${report.rows.filter(r=>r.status==='a_corriger').length} échec.`);
