# Source des règles

Depuis la livraison du 29 octobre 2026, MongoDB est la source du catalogue de production : base `myrpgtable`, collection `regles_catalogues`. Chaque document contient une version identifiable, son catalogue structuré et son empreinte SHA-256. Les anciennes collections et les personnages ne sont pas modifiés par l'import.

`rules-release.json` contient uniquement l'identifiant et l'empreinte attendus. Au démarrage, `start.mjs` charge cette version depuis MongoDB et vérifie son intégrité. Le catalogue reste en mémoire pour les requêtes et la validation des personnages. `/atelier/catalogue.json` est une réponse du serveur après authentification, pas un fichier sur disque. Une absence ou une altération bloque le démarrage ; aucun export local n'est utilisé en secours.

## Import

Sur le VPS, après sauvegarde complète de la BDD et de la livraison précédente :

```sh
node --env-file=/var/www/myrpgtable/shared/.env /chemin/nouvelle-livraison/import-rules.mjs /chemin/catalogue-valide.json /chemin/nouvelle-livraison/rules-release.json
```

L'entrée est un artefact de migration contrôlé, conservé avec les sauvegardes, hors Git. L'import exige une version figée et l'empreinte attendue, refuse d'écraser une version différente et vérifie la relecture complète. Le même import peut être répété sans doublon. Pour changer les règles : préparer une nouvelle version et son empreinte, l'importer et la vérifier, puis déployer le code pointant sur cette version. Le redémarrage charge la version choisie ; il n'y a pas de modification automatique des fiches.

## Livraison et vérifications

`package.mjs` n'embarque ni catalogue, ni export MongoDB, ni données de personnages. Il accepte en troisième argument une preuve de vérification dont l'empreinte correspond exactement aux sources actuelles ; sinon il lance la vérification complète. Une preuve ciblée pour la transition MongoDB conserve la campagne complète antérieure seulement après contrôle d'identité de tous les modules joueurs et de chaque octet du catalogue, et ajoute les contrôles du nouveau stockage et du nouvel accès HTTP.

Les contrôles réels de persistance écrivent uniquement dans `refonte_controles`, avec un propriétaire temporaire unique nettoyé à la fin. Les empreintes des personnages réels sont comparées avant/après. Le script de bascule conserve un retour arrière vers l'ancienne livraison ; l'import ajouté peut rester en BDD sans être utilisé après ce retour arrière.

## Git et tests

Git conserve le code, les migrations, le manifeste de version et les références nécessaires aux tests. `tests/fixtures/rules-2024.json` est la référence historique des règles pour la régression, sans comptes, personnages ou identifiants MongoDB ; elle n'alimente jamais la production et n'est pas déployée. Les comptes, personnages, identifiants de connexion, sauvegardes et rapports de données de production restent hors Git. Le relevé utilisé auparavant en production sous `data/rules-mongodb.json` a été retiré de ce rôle et de ce chemin.

## Éditions de textes sans migration des personnages

Le manifeste peut porter un `catalogueId` distinct de son `id` de règles. MongoDB conserve alors l’édition dans un nouveau document `_id=catalogueId` et garde le document précédent intact. Le chargement vérifie l’empreinte complète, la version de règles figée et la concordance de `provenance.editorialRevision`. Les personnages conservent `phb2024-2026-10-28` : un changement de rédaction seul ne demande pas de copie ni de remise à niveau de fiche. Une sauvegarde et une comparaison avec le catalogue réellement présent en base précèdent l’import.

L’édition `phb2024-2026-10-28-textes-20261030` contient six retouches de rédaction et 29 corrections d’espacement. Le journal dans `data/editorial-description-corrections-20261030.json` conserve chaque valeur avant/après. Le SRD, les références et les statuts de droits ne sont pas révisés par cette édition.

L’édition suivante `phb2024-2026-10-28-resumes-20261030` conserve le même identifiant de règles et ajoute 238 réécritures de textes aux 35 corrections précédentes. Le journal de ce second lot garde la métadonnée de l’édition précédente pour contrôler la chaîne et retrouver exactement le catalogue antérieur au retour arrière.
