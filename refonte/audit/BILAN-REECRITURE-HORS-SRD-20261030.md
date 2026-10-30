# Réécriture des descriptions hors SRD — 30 octobre 2026

Livraison : `20261030T141809Z`. Édition MongoDB : `phb2024-2026-10-28-resumes-20261030`. Règles des personnages : `phb2024-2026-10-28`, inchangées.

## Travail réalisé

Le lot remplace **238 textes**, avec une nouvelle rédaction technique fondée sur les mécaniques déjà présentes dans le catalogue figé :

- Les **51 descriptions principales des sorts hors SRD**.
- Les **huit descriptions de profils convoqués** associées, avec séparation des statistiques et du fonctionnement des actions/traits.
- **179 descriptions d’aptitudes, options et traits** réparties sur les **36 sous-classes hors SRD**. Les deux descriptions purement cosmétiques déjà rédigées librement au lot précédent sont conservées.

Les résumés distinguent cibles, coût, déclencheur, effet, restrictions et fin d’effet selon les besoins de chaque aptitude. Les noms qui identifient les choix ne sont pas remplacés. Les chiffres et les formules ne sont pas modifiés pour donner artificiellement une impression de nouveauté.

Le [journal des réécritures](../data/non-srd-description-rewrite-20261030.json) conserve chaque chemin de champ, la valeur précédente, son empreinte et le nouveau texte. Il distingue les 238 changements des deux textes déjà originaux. La construction applique d’abord l’édition précédente, puis celle-ci ; une divergence de texte ou de métadonnée d’édition précédente bloque l’opération sans modifier l’entrée source.

## Vérifications réalisées

- **4 006 tests unitaires réussis**, sans échec ni test ignoré.
- **108 comparaisons de fiches avant/après** : les 36 sous-classes aux niveaux 3, 10 et 20 gardent les mêmes caractéristiques, compétences, sauvegardes, attaques, PV, CA, magie, emplacements, vitesses, résistances, ressources et erreurs de validation.
- Chaque texte garde la même signature numérique et les mêmes dés. Une vérification documentaire complémentaire n’a relevé aucune disparition des caractéristiques, états ou types de dégâts présents dans les textes sources.
- L’annulation des 238 textes et le rétablissement de la métadonnée d’édition précédente retrouvent exactement le catalogue antérieur. Aucun autre champ ni module joueur n’est modifié.
- **Huit parcours navigateur** réussis, dont accès et intégrité du catalogue, recherche, isolation des comptes, attribution administrative et PDF aux niveaux 3 et 20.
- **87 fiches du Grimoire** parcourues : les 238 nouveaux textes sont présents et visibles après ouverture des détails, les anciens sont absents. Aucune erreur JavaScript. Six captures couvrent des sorts, un profil convoqué et plusieurs sous-classes.

## Publication

La sauvegarde complète avant import contient **3 276 documents**. Avant la bascule, une comparaison en lecture seule avec le catalogue réellement chargé depuis MongoDB confirme que seuls les textes prévus et la métadonnée d’édition changent.

L’import crée un nouveau document de catalogue sans écraser les deux éditions précédentes. Les huit contrôles de persistance et les essais d’attribution réussissent avant et après publication. Les personnages réels, dont les deux Youpi matin niveau 3/révision 2, conservent leurs empreintes.

Empreinte précédente : `60c30777c19fce5b10c5a2c47410f11a5ac98977a686a55859711ccd1a522826`.

Nouvelle empreinte : `7938ed5423f84d3301566923d55f8c8d69095adc715009f7fb27a3d38f4659a6`.

Sauvegarde, reçus et retour arrière : `/root/backups/myrpgtable-persistence-20261030T141809Z/`. Le site charge l’édition depuis MongoDB ; aucun export de catalogue n’est livré dans les fichiers publics.

## Portée et limites

Ce lot est une réécriture effective des textes énumérés ci-dessus. Il ne constitue pas une comparaison exhaustive mot à mot avec les livres : toutes les références complètes ne sont pas accessibles. La source de travail est le catalogue déjà figé et ses références documentées. Aucun passage n’est déclaré contrefaisant sur la seule base d’un test de ressemblance ; aucune réécriture n’est présentée comme une garantie de droits.

Les valeurs techniques des sorts — composantes, déclencheurs d’incantation et formules de progression — restent conservées. Les dons, historiques, espèces et autres profils ou tableaux complémentaires ne sont pas présentés comme réécrits par ce lot. Leur examen demeure distinct, de même que les droits du PDF, des illustrations et des marques. Les attributions SRD restent affichées.
