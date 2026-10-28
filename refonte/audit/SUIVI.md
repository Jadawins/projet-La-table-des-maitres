# Suivi de vérification des règles 2024

Extrait MongoDB : 2026-10-28T06:12:59.824Z. Empreinte : 51e72bce0cc5bd3f5099e7d4f88824b991ecd9d80575eda0da9829265d578924.

Périmètre : 12 classes, 48 sous-classes, 960 combinaisons sous-classe/niveau ; 1200 lignes avec les progressions des classes.

Statuts : 1104 à vérifier, 0 avec anomalie, 0 entièrement validées, 96 sans objet (avant le choix de sous-classe).

La BDD actuelle fait référence. Le suivi porte sur son intégration dans l’application ; les comparaisons et errata externes sont remis à plus tard.

## État de l’intégration : clerc

La BDD actuelle est la référence du développement. Le suivi sert à vérifier que ses choix et calculs sont correctement intégrés. Les comparaisons avec des sources externes sont désactivées par défaut.

| Élément | À vérifier | Anomalies | Progression chiffrée conforme |
| --- | ---: | ---: | ---: |
| Clerc | 20 | 0 | 0 |
| Domaine de la Guerre | 18 | 0 | 0 |
| Domaine de la Lumière | 18 | 0 | 0 |
| Domaine de la Ruse | 18 | 0 | 0 |
| Domaine de la Vie | 18 | 0 | 0 |

## Comparaisons externes différées

Les constats précédents sont conservés dans [COMPARAISON-EXTERNE-DIFFEREE.md](COMPARAISON-EXTERNE-DIFFEREE.md). Ils ne déclenchent pas de correction et ne servent pas à bloquer les choix du créateur.

## Suite du contrôle

1. Vérifier que chaque choix prévu par la BDD apparaît dans le parcours au bon niveau.
2. Tester les calculs, quotas et changements de niveau à partir des valeurs de la BDD.
3. Résoudre les liaisons de données manquantes sans remplacer les règles par une autre version.
4. Valider les cases après vérification des choix et de leur fonctionnement dans l’application.
5. Examiner ultérieurement les changements et errata dans une démarche séparée.

Aucune écriture dans MongoDB. Les substitutions de contenu issues des comparaisons externes ont été retirées du catalogue local. Les normalisations de formats ne modifient pas le texte des règles.

## Reproduire

`node refonte/audit/run.mjs` régénère le rapport à partir de l’extrait local. L’interface se consulte à `/audit.html` avec le serveur local.
