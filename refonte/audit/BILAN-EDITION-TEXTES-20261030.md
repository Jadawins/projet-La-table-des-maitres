# Édition de textes du 30 octobre 2026

Livraison : `20261030T134224Z`. Catalogue MongoDB : `phb2024-2026-10-28-textes-20261030`. Version des règles des personnages conservée : `phb2024-2026-10-28`.

## Corrections appliquées

Les six retouches préparées sont appliquées : les listes d’exemples RP de l’Âme mécanique et du Vagabond féerique, les descriptions de Frappe du vent d’acier, Mind Sliver, Voile défensif et Armure d’Agathys. Le geste de composante, les cibles, valeurs, durées, attaques et conditions sont conservés. La note interne sur le nom français de Mind Sliver reste dans l’audit et disparaît du texte joueur.

Vingt-neuf autres champs de sorts et profils convoqués reçoivent les espaces manquants entre mots, nombres et unités. Pour ces champs, retirer les espaces redonne exactement le texte précédent. Les dés restent écrits sous la forme `1d6`, sans séparation interne.

Le [journal éditorial](../data/editorial-description-corrections-20261030.json) contient les 35 champs, leurs valeurs avant/après, leurs raisons et les empreintes des valeurs sources. L’application vérifie toutes les préconditions avant de changer une copie du catalogue. Un texte source différent bloque l’opération.

## Vérifications

- La comparaison complète retrouve l’ancien catalogue octet pour octet après annulation des 35 retouches et retrait de la seule métadonnée d’édition. Aucun champ mécanique ni module joueur n’est modifié.
- La campagne unitaire initiale compte 4 002 tests : 4 000 passent et deux assertions exigent l’ancienne formule collée `CA11+rang`. Elles sont adaptées pour accepter les espaces en vérifiant toujours la formule. Les deux fichiers concernés repassent ensuite leurs 24 tests. Le résultat final couvre **4 002 tests distincts validés**, sans compter deux fois la reprise ciblée. Aucun échec ni test ignoré ne reste ouvert.
- Huit parcours navigateur passent : intégrité et protection du catalogue, accueil/recherche, accès administrateur, copie/transfert de fiche et trois parcours PDF, dont les niveaux 3 et 20.
- Les six textes retouchés sont contrôlés dans le Grimoire : nouvelle rédaction visible, ancienne rédaction absente, aucune erreur JavaScript.
- Avant import, un contrôle en lecture seule compare la nouvelle édition au catalogue réellement chargé depuis MongoDB. L’annulation des 35 champs retrouve exactement celui-ci.
- Les huit parcours de persistance et les contrôles d’attribution réussissent avant et après bascule. Les documents de personnages réels, dont les deux Youpi matin niveau 3/révision 2, gardent leurs empreintes.

## Publication et retour arrière

L’import crée un nouveau document dans `regles_catalogues` ; il ne remplace pas le catalogue précédent. Le manifeste distingue l’identifiant des règles (`id`) et celui de l’édition de textes (`catalogueId`). Le chargement contrôle l’empreinte complète et la concordance de la métadonnée d’édition. Les personnages gardent leur version de règles et ne demandent aucune migration.

Empreinte précédente : `b2029d300c21ab5631e54d701b3506874f9253f7787c84cde324111c788a4697`.

Nouvelle empreinte : `60c30777c19fce5b10c5a2c47410f11a5ac98977a686a55859711ccd1a522826`.

La sauvegarde de 3 275 documents, la livraison précédente, les reçus d’import, les contrôles et le script de retour arrière se trouvent dans `/root/backups/myrpgtable-persistence-20261030T134224Z/`. Le catalogue est chargé depuis MongoDB ; aucun export de catalogue ni de personnages n’est livré dans le site ou commité comme donnée de production.

## Limites

Ce lot corrige les problèmes de rédaction et de typographie repérés dans les textes examinés. Il n’est pas une réécriture de tout le catalogue ni une validation juridique des 36 sous-classes et 51 sorts hors SRD. Les statuts de droits restent explicites dans l’inventaire. La revue des dons, historiques et autres textes demeure un lot distinct.
