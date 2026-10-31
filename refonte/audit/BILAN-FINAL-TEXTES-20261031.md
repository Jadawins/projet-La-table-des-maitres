# Clôture des descriptions — 31 octobre 2026

Édition : `phb2024-2026-10-28-textes-final-20261031`. Livraison : `20261031T142735Z`. Version de règles conservée : `phb2024-2026-10-28`.

## Derniers changements

Le journal final contient **244 champs rédigés à nouveau** :

- 144 pour les historiques : seize présentations et 128 exemples facultatifs de personnalité, sans nouvelle contrainte de jeu.
- Seize pour les espèces : dix présentations originales et six traits d’Aasimar.
- Deux descriptions du Têtard de slaad, avec statistiques identiques.
- Vingt manœuvres du Maître de guerre et leur aide-mémoire.
- Soixante et une précisions courtes des sorts hors SRD : progression, déclenchement, composantes et fonctionnement, en complément des descriptions principales déjà réécrites.

Le [relevé final](editorial-final-dispositions-20261031.json) couvre **2 021 champs détectés et les 95 champs complémentaires**. Chaque texte conservé a une décision explicite. Les cinq variantes animales sans référence restent exclues et les deux dons hérités restent archivés. Le [rapport de provenance](DESCRIPTIONS-PROVENANCE.md) clôt la liste de travail éditoriale.

## Vérifications

Une première campagne a détecté quatre échecs liés à deux dépendances aux textes : lecture de la portée de Vision dans le noir d’Aasimar et des paliers de dégâts des sorts mineurs. La rédaction finale conserve les expressions techniques reconnues par le moteur, sans changer le code de jeu. Les vérifications ciblées passent, puis une nouvelle campagne complète est exécutée sur cette rédaction finale.

- **4 017 tests unitaires réussis**, sans échec ni test ignoré lors de la campagne finale.
- **423 comparaisons de fiches avant/après** : seize historiques avec douze classes, 29 combinaisons de variantes/tailles d’espèce aux niveaux 1/3/20, et 48 sous-classes aux niveaux 3/10/20. Les dégâts et DD des sorts sont inclus. Un test supplémentaire vérifie les sorts mineurs modifiés aux niveaux 1/5/11/17/20.
- **Huit parcours navigateur** réussis sur le catalogue final : navigation, Grimoire, accès, administration, isolation des comptes et PDF aux niveaux 3/20.
- **64 pages du Grimoire** contrôlées, avec 221 nouveaux champs visibles. Le catalogue authentifié contient bien les 244 textes. Aucune erreur JavaScript ; six captures locales, dont Aasimar et Guide inspectées visuellement.
- Annuler les 244 corrections et restaurer la métadonnée d’édition retrouve exactement l’ancien catalogue. Signatures numériques, prérequis, coûts structurés, types et identifiants restent identiques.

La preuve est produite par [verify-final-editorial.mjs](verify-final-editorial.mjs), les décisions par [close-editorial-review.mjs](close-editorial-review.mjs). Exports MongoDB, données réelles et captures restent hors Git.

## Publication

Le catalogue proposé est comparé au catalogue réellement chargé depuis MongoDB avant import. La sauvegarde complète de **3 278 documents**, la livraison précédente et le retour arrière sont dans `/root/backups/myrpgtable-persistence-20261031T142735Z/`.

L’import crée une édition immutable et conserve les précédentes. Aucune fiche existante n’est réécrite. Huit contrôles de persistance/attribution sont effectués avant et après bascule sur des données isolées, avec nettoyage et comparaison des empreintes des personnages réels. Les accès HTTP et le service sont contrôlés après publication. Résultats constatés : [final-editorial-result-20261031.json](final-editorial-result-20261031.json).

Empreinte du catalogue : `0f591b9cfdb7b0cac2bc728b843b4b7f77a457c26669dba0c75c4922a33df709`.

## Arrêt de cette campagne

Le travail demandé sur les descriptions actives est achevé. Références techniques et archives conservées ont une décision ; elles ne restent pas sous une mention générique « à faire ». Ce résultat ne certifie pas les droits de redistribution hors SRD et ne remplace pas l’examen distinct du PDF, des illustrations, des marques ou des obligations générales du site.

Publication constatée : comparaison avec l’ancien catalogue MongoDB réussie, import relu et vérifié, huit contrôles avant et huit après bascule réussis, 17 accès HTTP conformes. Personnages réels inchangés, dont les deux fiches Youpi matin au niveau 3, révision 2.
