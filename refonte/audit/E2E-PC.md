# Vérification automatique sur ordinateur

Exécution du 28 octobre 2026, terminée à **16 h 38 (Europe/Paris)**. Version déployée : **20261028T145508Z**.

- **2 360 tests de calcul, validation et stockage réussis.**
- **442 parcours Chromium réussis** : 160 clercs, 228 personnages des onze autres classes, 50 parcours d’origines et de dons, quatre régressions.
- **0 échec, 0 test ignoré, 0 résultat instable**, aucun nouvel essai automatique.
- Durée du navigateur : **37,2 minutes**, deux exécutants locaux.
- Empreinte des sources : `390f84e1ddcb95de7690b24319194a8a5c45a03c852fcab47c5614a575554943`.
- SHA-256 de l’archive vérifié sur le VPS : `49f0140eaf3187b020ae79774f61ee5801eb7bd43c28b6f94c66651a59ff2fde`.

## Ce qui est effectivement couvert

Les calculs de classe couvrent les **48 sous-classes à chaque niveau de 1 à 20**, avec deux vocations pour le clerc : 1 040 scénarios d’intégration. Le navigateur vérifie les quatre sous-classes de toutes les classes ; il couvre chaque niveau pour le clerc, les niveaux **1, 3, 6, 10 et 20** pour les onze autres classes, et aussi 7/14 pour le guerrier. La couverture navigateur des autres classes est donc moins exhaustive que celle du clerc : un défaut propre à un niveau intermédiaire peut encore échapper à ces parcours.

Les origines ajoutent **7 200 scénarios** : 12 classes × 30 origines/lignages/tailles × 16 historiques au niveau 5, puis chaque classe/origine aux niveaux 1, 3, 10 et 20 avec historiques répartis. Cette matrice emploie une sous-classe de référence par classe, et non toutes les sous-classes croisées avec chaque origine.

Les dons ajoutent **780 contrôles** d’admissibilité et de conservation, **332 combinaisons légales** de don humain/historique/taille, les 30 styles de combat/classe et les répartitions de bonus de chaque historique. Cela ne vérifie pas chaque choix de chaque don à chaque palier de chaque sous-classe.

Les 50 nouveaux parcours navigateur couvrent les 30 origines, les onze dons humains, cinq interactions de dons et quatre origines niveau 20. Les formulaires sont réellement remplis : aucune fiche prédéfinie n’est injectée. Sauvegarde, actualisation et reprise sans brouillon local sont vérifiées. Les calculs de PV/caractéristiques de la matrice sont comparés à des calculs attendus distincts du modèle. Les régressions vérifient choix vides, absence de jets automatiques, modifications sans doublon, coupure réseau et isolation entre comptes.

## Contrôles sur le VPS et activation

Le paquet a été créé après réussite des deux suites et vérification de l’empreinte des sources. Sauvegarde complète préalable : **3 270 documents**, `/root/backups/myrpgtable-persistence-20261028T145508Z/database.ejsonl.gz`.

MongoDB réel : quatre domaines du clerc, deux vocations et dons de niveau 20 ; les 44 autres sous-classes niveau 20 ; les 30 origines et les onze dons humains. Sauvegarde/relecture, mise à jour, révisions, idempotence et isolation passent. **Aucun document de contrôle ne reste dans la collection temporaire.**

**Youpi matin reste niveau 3, révision 1, avant et après déploiement.** Aucun personnage existant n’est migré ni modifié par les tests. Les HTTP attendus sont vérifiés : accueil et connexion accessibles, atelier protégé, anciennes routes bloquées.

## Référence et limites

La BDD actuelle reste la référence ; aucune collection de règles n’est réécrite par cette extension. Les ajouts officiels concernent uniquement les données manquantes ou liens autorisés. Deux sorts du gnome restent non identifiés, en plus des six noms de sorts de classes précédemment signalés. Les détails manquants du compagnon, du moine et des pouvoirs psioniques restent à préciser avec le MJ. Aucun effet n’est inventé.

Voir [ORIGINES-DONS.md](ORIGINES-DONS.md) et [COMPLEMENTS-CLASSES.md](COMPLEMENTS-CLASSES.md). Cette validation technique ne constitue pas une conformité documentaire globale au Manuel 2024 ni une simulation du combat. Les identités Supabase et l’adaptateur MongoDB des tests locaux sont simulés ; les modules d’accès/validation/stockage sont ceux du projet. Le contrôle MongoDB réel est séparé. OAuth externe et téléphone ne sont pas validés par cette suite.

Rapport interactif local : `refonte/e2e/playwright-report/index.html`. Preuve : `refonte/e2e/test-results/verification.json`. Les rapports sont locaux et exclus de Git. Le suivi temporaire sur le port 9334 affiche les fiches enregistrées ; ce compteur n’équivaut pas à un nombre de parcours réussis avant le rapport final. Les contrôles GitHub s’activeront après l’envoi des fichiers au dépôt.
