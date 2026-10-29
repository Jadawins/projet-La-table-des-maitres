# Vérification automatique sur ordinateur

## Complément des vingt niveaux — terminé à 18 h 59

Le 28 octobre 2026, **652 nouveaux parcours Chromium ont réussi en 35,7 minutes**, avec deux navigateurs, sans échec, test ignoré ni résultat instable. Aucun parcours du clerc, ancien palier, test d’origine/régression ou test de règles déjà réussi n’a été relancé, conformément à la demande de l’utilisateur. La sélection des résultats confirme 652 marqueurs `@complement`, sans clerc.

L’application, l’accès et le catalogue sont restés identiques au paquet déjà déployé et testé : manifeste vérifié avant et après l’exécution. Aucun changement applicatif ni déploiement supplémentaire n’était nécessaire.

**Couverture cumulée : 1 094 parcours sur deux exécutions de la même application**, et non une unique exécution de 1 094 tests. Les résultats précédents restent conservés séparément. Le contrôle de déploiement complet n’est pas contourné : il continue à exiger sa propre exécution complète.

| Groupe | Déjà réussis | Nouveaux réussis | Total couvert |
|---|---:|---:|---:|
| Clerc, quatre domaines et deux vocations | 160 | 0 | 160 |
| Onze autres classes, quatre sous-classes chacune | 228 | 652 | 880 |
| Origines et interactions de dons | 50 | 0 | 50 |
| Régressions | 4 | 0 | 4 |
| **Total** | **442** | **652** | **1 094** |

Sources de cette exécution : `0860d899a3fc79dc73cda336dcab0cd920664d6630cbfdb5a255c0003492a2a1`. Preuves : `audit/e2e-complement-levels.json`, `audit/e2e-baseline-20261028T145508Z.json` et `audit/e2e-product-baseline.json`. Les 2 360 tests de règles précédemment réussis restent valables sur le produit inchangé ; ils ne sont pas comptés comme réexécutés.

## Exécution complète précédente et déploiement de référence

Exécution du 28 octobre 2026, terminée à **16 h 38 (Europe/Paris)**. Version déployée : **20261028T145508Z**.

- **2 360 tests de calcul, validation et stockage réussis.**
- **442 parcours Chromium réussis** : 160 clercs, 228 personnages des onze autres classes, 50 parcours d’origines et de dons, quatre régressions.
- **0 échec, 0 test ignoré, 0 résultat instable**, aucun nouvel essai automatique.
- Durée du navigateur : **37,2 minutes**, deux exécutants locaux.
- Empreinte des sources : `390f84e1ddcb95de7690b24319194a8a5c45a03c852fcab47c5614a575554943`.
- SHA-256 de l’archive vérifié sur le VPS : `49f0140eaf3187b020ae79774f61ee5801eb7bd43c28b6f94c66651a59ff2fde`.

## Ce qui est effectivement couvert

Les calculs de classe couvrent les **48 sous-classes à chaque niveau de 1 à 20**, avec deux vocations pour le clerc : 1 040 scénarios d’intégration. Le navigateur couvre désormais les quatre sous-classes de toutes les classes à chaque niveau de 1 à 20. Les anciens paliers 1/3/6/10/20 (et 7/14 du guerrier) et le clerc proviennent de l’exécution complète précédente ; les niveaux manquants sont couverts par le complément décrit plus haut. La suite conserve ces tests pour les futures régressions.

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
