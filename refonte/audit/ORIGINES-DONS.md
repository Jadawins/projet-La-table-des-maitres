# Origines, historiques et dons — extension des contrôles

Version déployée le 28 octobre 2026 : 20261028T145508Z. Les 2 360 tests de règles et 442 parcours navigateur passent, sans échec, test ignoré ni résultat instable. Les 30 origines et onze dons humains ont aussi été sauvegardés et relus sur MongoDB, puis les documents de contrôle nettoyés. La BDD actuelle reste la référence.

## Couverture

- 10 espèces, 20 lignages ou héritages nommés, 30 combinaisons espèce/lignage/taille, 16 historiques et 12 classes.
- 5 760 croisements exhaustifs classe × origine × historique au niveau 5.
- 1 440 scénarios supplémentaires : chaque origine et chaque classe aux niveaux 1, 3, 10 et 20, avec historiques répartis. Total : **7 200 scénarios d’origine**.
- **780 contrôles de dons** : chaque don hors styles et chaque classe, au premier palier compatible avec son niveau minimal ; cas admissibles et cas refusés. Les quatre sous-classes ne sont pas croisées avec chaque don dans cette matrice.
- **332 combinaisons légales de don humain, historique et taille** ; les doublons non répétables sont exclus.
- Les dix styles de combat sont chacun sauvegardés et affichés pour guerrier, rôdeur et paladin. Les bonus +1/+1/+1 et toutes les répartitions +2/+1 de chaque historique sont vérifiés séparément.
- **50 parcours navigateur supplémentaires** : les 30 origines, les onze dons humains, cinq interactions de dons et quatre parcours niveau 20. Sauvegarde, actualisation, reprise sans brouillon local et conservation des nouveaux choix.

## Défauts corrigés

1. Ténacité naine : +1 PV par niveau. La variante collinaire répétant ce même bonus ne le double pas.
2. Les formations aux armures du nain des montagnes apparaissent et comptent dans les prérequis des dons.
3. Protection légère acquise à un palier permet Protection intermédiaire au palier suivant.
4. Le libellé du Marin « Habitué des tavernes » rejoint la fiche BDD « Bagarreur de tavernes », en conservant le libellé source et les effets BDD.
5. Les fiches de sorts d’espèce reconnues sont fusionnées avant le calcul des dégâts, du DD et des effets de dons. Niveaux, seuils d’acquisition, utilisations et caractéristiques BDD restent conservés.
6. Porte-lumière est relié à Lumière par CHA ; les variantes de noms des autres sorts sont tracées dans le fichier de liens. Prestidigitation et Illusion mineure, absentes du catalogue, sont ajoutées depuis les sources officielles disponibles.
7. Résistances : retrait des marqueurs variables une fois le lignage choisi, fusion des doublons et normalisation des libellés. Vision dans la nuit de l’Aasimar reconnue comme sens de vision dans le noir.
8. Ascendance géante du goliath et caractéristique de Présence d’outre-monde du tieffelin : choix obligatoires, sans présélection, sauvegardés et affichés. Le choix du tieffelin affecte Thaumaturgie ; les autres sorts gardent leur caractéristique BDD.
9. Les dons ultérieurs ne rendent plus invalide la compétence du barbare acquise au niveau 3. Observateur n’est pas assimilé à une nouvelle maîtrise absente.
10. Magie rituelle et Faveur du destin ne sont proposées que si la liste de classe permet effectivement de remplir leurs choix. Aucune liste de sorts d’une autre classe n’est inventée pour un personnage sans incantation.
11. Une taille incompatible avec une espèce ne peut pas être enregistrée comme une fiche complète.

## Sources et traces

Les valeurs avant/après et les liens sont conservés dans `data/origin-link-corrections.json` ; les deux nouvelles fiches figurent dans `data/missing-spells.json`. Aucun document de règles MongoDB n’est réécrit.

Références ciblées : [Marin](https://roll20.net/compendium/dnd5e/Backgrounds%3ASailor?expansion=32231&iframe=true), [Aasimar](https://roll20.net/compendium/dnd5e/Races%3AAasimar?expansion=32231), [Prestidigitation](https://roll20.net/compendium/dnd5e/Spells:Prestidigitation?expansion=32231&iframe=true), [Illusion mineure](https://roll20.net/compendium/dnd5e/Spells:Minor%20Illusion?expansion=32231&iframe=true), [Ray of Sickness](https://roll20.net/compendium/dnd5e/Spells:Ray%20of%20Sickness?expansion=32231&iframe=true). Pour Rayon de maladie → Rayon empoisonneur, le rapprochement conserve le JS de CON de la fiche BDD, malgré la différence 2024. Ces références ne déclenchent pas une révision générale des autres règles.

## Limites explicites

Transmutation du bois et Croissance naturelle du gnome restent non identifiées : avertissement visible, texte source conservé, aucun effet inventé. Les six noms de sorts de classes précédemment signalés et les paramètres manquants du compagnon, du moine ou des pouvoirs psioniques restent également à préciser.

Cette couverture vérifie l’intégration du catalogue actuel. Elle n’atteste pas une conformité globale au Manuel 2024, tous les choix possibles d’équipement, tous les dons à chaque palier de chaque sous-classe, ni le jeu en combat. Les transformations et effets conditionnels restent décrits sans être activés automatiquement. Aucun personnage existant n’est modifié dans la BDD par ces tests.

Le dernier résultat complet, la version et le contrôle MongoDB réel sont consignés dans [E2E-PC.md](E2E-PC.md). Le téléphone reste hors périmètre.
