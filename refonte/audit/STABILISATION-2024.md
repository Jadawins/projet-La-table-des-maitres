# Stabilisation PHB2024 — bilan de travail

Historique de travail au 29 octobre 2026, désormais remplacé par [le bilan final](BILAN-FINAL-2024.md). La version locale est figée ; la production reste inchangée. Les étapes intermédiaires ci-dessous sont conservées pour traçabilité.

## Préparé

- Douze classes et48 sous-classes : traits, aptitudes, tables et paliers comparés ; adaptations de choix et ressources.
- Profils :108 animaux comparés, dix dragons, sept familiers spéciaux dont le têtard de slaad. Les cinq variantes animales sans référence sont conservées mais exclues des nouveaux choix.
- Dons :75 dons PHB actifs, deux entrées héritées archivées. Compétences, expertise, rituels et maîtrises d’arme explicites ; effets conditionnels distingués des valeurs permanentes.
- Sorts :373 fiches existantes avec comparaison détaillée dans spell-comparisons-2024.json ; les additions et compléments sont tracés séparément. Les389 anciennes cartes ont été reprises, deux absences PHB supplémentaires ajoutées et un doublon archivé :390 sorts actifs. Les huit convocations présentent leurs profils et formules.
- Équipement :38 armes,13 armures,25 outils ;18 compétences. Les94 comparaisons figurent dans equipment-reference-2024.json. Pic de guerre ajouté ; dégâts, bottes, poids, prix et utilisations corrigés.
- Sauvegarde : version de règles explicite ; mise à niveau volontaire d’une ancienne fiche dans une copie ; protection serveur de l’original. Choix d’arme et jusqu’à six rituels conservés.

## Vérifications

La campagne unitaire complète après corrections a réussi : **2 840 tests, aucun échec ni test ignoré**, en 468,9 secondes. Les 55 contrôles ciblés complémentaires ont également réussi ; deux sont distincts de la campagne complète, soit **2 842 tests unitaires distincts**. Preuves : final-unit-verification.json, final-unit-tests.txt et final-additional-tests.txt. Les premières campagnes en échec sont conservées dans l'historique de reprise et ne sont pas comptées comme validations.

La campagne navigateur complète est terminée en 1 h 28 : **1 296 réussites et deux échecs**, aucun parcours ignoré ni instable. Les échecs étaient des attentes obsolètes : le libellé de Tempête de neige et les trois maîtrises de Doué que le scénario ne sélectionnait pas. Les deux fichiers concernés ont été rejoués : **six réussites, aucun échec, ignoré ou instable**. Cela couvre 1 298 parcours distincts après correction des tests, sans changement applicatif. Les rapports initiaux et correctifs restent conservés dans final-browser-results.json et final-browser-corrective-results.json ; le rapprochement et les 48 couvertures de niveaux sont dans final-browser-verification.json.

Les douze classes et les 48 sous-classes ont une couverture navigateur pour chacun des niveaux 1 à 20 (deux vocations pour le clerc). Le registre rapproche ces preuves avec leurs comparaisons documentaires et les tests unitaires. **53 clôtures nouvelles, 96 clôtures au total** ; les sorts, dons et profils individuels demandent encore leur propre rapprochement. Cela ne constitue pas un gel.

Empreinte de la candidate testée : `651a4fddbaff14fe72ab14c90b77f8e4b08849bf69e496ce732cd2607d849a77`, enregistrée dans final-candidate-manifest.json. Les 19 fichiers applicatifs et le catalogue ont été comparés à l'atelier effectivement servi aux tests. Empreinte inchangée après préparation de la sauvegarde. Ne pas annoncer le gel avant le résultat complet, sans échec, test ignoré ni résultat instable.

## Réserves et sauvegarde

Cinq variantes animales sans référence 2024 accessible restent documentées comme indisponibles et exclues des nouvelles créations : rat géant malade et nuées de scarabées, mille-pattes, araignées et guêpes. Elles ne sont pas déclarées conformes. Deux anciens dons et un doublon de sort sont archivés, avec leurs correspondances conservées.

Une sauvegarde locale de la candidate a été créée le 29 octobre 2026 dans `C:\Users\w.einsargueix\dev\myrpg-backups\candidate-20261029-164743\sources-candidate.zip`. Son manifeste fournit le SHA-256 ; une extraction séparée a confirmé l'identité de **211 fichiers** avec les sources (seul le suivi dynamique des compteurs est exclu de cette comparaison). Cette archive de sources exclut les secrets et dépendances ; elle ne constitue pas une sauvegarde de la BDD de production. La sauvegarde de production et la procédure de retour arrière restent nécessaires avant toute publication.

## Restant avant gel

Rapprocher les preuves de chaque autre entrée du registre avant sa clôture. Compléter le bilan final et identifier l'archive de la version gelée. Les réserves documentaires restent nommées, jamais transformées en validations. Les conditions de publication demeurent distinctes du gel local. Les nouveaux tests et le seul affichage du suivi changent l'empreinte globale, mais les 19 fichiers applicatifs et le catalogue sont identiques à ceux de la campagne complète ; ce contrôle est imposé par collect-final-browser.mjs.

Aucun accès en écriture au VPS ni modification de personnage réel pendant cette reprise. Production20261028T145508Z conservée ; Youpi matin niveau3/révision1 préservé.
