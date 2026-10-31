# Réécriture des dons hors SRD — 31 octobre 2026

Livraison : `20261031T140222Z`. Édition MongoDB : `phb2024-2026-10-28-dons-20261031`. Règles des personnages : `phb2024-2026-10-28`, inchangées.

## Travail réalisé

Le chapitre complet des dons du [SRD français 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf#page=92), pages 92–94, fournit 17 dons présents au catalogue. Le classement porte sur 77 entrées : 75 actives et deux archives héritées. Une URL de comparaison utilisée auparavant ne suffit pas à décider de l’appartenance au SRD.

Les **58 dons actifs hors SRD** reçoivent une nouvelle rédaction technique : **169 champs**, soit 58 descriptions et 111 effets. Chaque changement est consigné avec son texte précédent, son empreinte et son texte nouveau dans [le journal du lot](../data/non-srd-feat-rewrite-20261031.json).

Les 17 dons SRD et les archives Truand et Préparateur de poison ne sont pas modifiés. Les 46 expressions de hausse de caractéristique, prérequis, identifiants, catégories, types d’effets et données structurées sont conservés exactement. Les expressions nécessaires aux calculs et valeurs résolues restent compatibles. Les dés physiques et l’absence de lancer automatique sont conservés.

## Vérifications réalisées

- La campagne complète exécute **4 010 tests** : 4 008 passent immédiatement et deux échouent parce qu’ils attendent l’ancienne formulation. Les calculs contrôlés par ces tests ne divergent pas. Les deux assertions sont adaptées au texte nouveau, puis les **15 tests ciblés passent**, sans échec ni test ignoré. La campagne complète n’est pas relancée pour ces seules retouches de rédaction ; le rapport conserve ce déroulement, sans présenter un second passage complet fictif.
- **52 comparaisons de fiches avant/après** couvrent les dons admissibles dans les parcours de création utilisés. Les six styles de combat restants ont leur contenu structuré préservé et sont couverts par le contrôle exact des champs non textuels. Caractéristiques, PV, CA, vitesses, attaques, magie, compétences, sauvegardes, ressources et erreurs sont identiques.
- Les signatures numériques sont identiques pour chaque texte modifié et chaque effet résolu. Les 46 expressions de caractéristiques et les conditions de répétition sont vérifiées.
- **Huit parcours navigateur** passent. Après les dernières retouches, **deux contrôles supplémentaires du catalogue** et **les 58 fiches de dons du Grimoire** sont repris : les 169 nouveaux textes sont visibles, sans erreur JavaScript. Six captures sont conservées localement ; les fiches Empoisonneur et Faveur de résistance aux énergies sont contrôlées visuellement.
- En annulant uniquement les 169 modifications et la métadonnée d’édition, on retrouve exactement le catalogue précédent. Le contrôle est également effectué sur le **catalogue réellement chargé depuis MongoDB**, avant l’import.

La preuve est produite par [verify-feat-rewrite.mjs](verify-feat-rewrite.mjs) ; les comptes de tests et résultats de publication sont dans [feat-rewrite-result-20261031.json](feat-rewrite-result-20261031.json). Les tests navigateur utilisent des comptes et données simulés, sans identifiants réels.

## Publication et préservation

La sauvegarde complète de **3 277 documents**, la livraison précédente, la configuration et le retour arrière sont conservés dans `/root/backups/myrpgtable-persistence-20261031T140222Z/`. L’import crée une nouvelle édition immutable ; les catalogues précédents restent en base. Aucun catalogue de production ni export de personnages n’est ajouté à Git ou livré dans les fichiers publics.

Huit contrôles réels de sauvegarde/réouverture et d’attribution réussissent avant et après bascule dans des collections de contrôle isolées et nettoyées. Les empreintes des personnages réels restent identiques ; les deux fiches nommées Youpi matin restent au niveau 3, révision 2. Les 17 contrôles HTTP passent et le service utilise la livraison attendue.

Empreinte du catalogue : `6b37cbdff5f0ba1c4c7822c620d66134545dde13eeb915be503037870fe25b9d`.

## Limites et suite

Cette édition traite les textes des dons actifs hors SRD. Les descriptions de sorts, profils convoqués et sous-classes déjà traitées restent celles de l’édition précédente. Les historiques, espèces, autres profils et textes complémentaires restent à examiner séparément ; ils ne sont pas déclarés réécrits par ce lot.

Le catalogue figé fournit les mécaniques de travail. Les livres hors SRD ne sont pas accessibles exhaustivement pour une comparaison phrase par phrase. Une nouvelle rédaction ne constitue pas, à elle seule, une autorisation de redistribution ; ce bilan ne délivre aucune validation juridique générale.
