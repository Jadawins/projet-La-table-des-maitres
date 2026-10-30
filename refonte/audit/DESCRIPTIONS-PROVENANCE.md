# Provenance des descriptions — 30 octobre 2026

Ce contrôle porte sur les textes et leur provenance. Le gel des **règles de jeu** ne vaut pas validation des droits de redistribution. Après le premier lot de six retouches et 29 espacements, une nouvelle édition réécrit 238 textes : 51 descriptions principales de sorts, huit profils convoqués et 179 textes d’aptitudes des 36 sous-classes hors SRD. Les deux descriptions RP déjà rédigées librement sont conservées. Les calculs et personnages restent inchangés.

## Résultats établis

Le catalogue reconstruit pour l'audit a la même empreinte SHA-256 que la version MongoDB publiée : `7938ed5423f84d3301566923d55f8c8d69095adc715009f7fb27a3d38f4659a6`.

- Le journal contient **738 corrections**, dont **566** référencent le SRD français 5.2.1 et **172** d'autres références. Les 16 ajouts sont comptés séparément. Une correction n'est pas un texte ni une entrée unique.
- L'inventaire couvre les **637 entrées du Grimoire**, puis les compétences et profils complémentaires : **785 entrées au total**, dont 734 avec du texte détecté.
- **2 001 champs textuels** sont relevés, plus **95 champs** des fichiers complémentaires. Noms seuls, identifiants, chiffres isolés et métadonnées ne sont pas comptés comme descriptions.
- Pour 1 267 champs, une correction, un ajout ou une source explicite renvoie au SRD ; pour 472, à une autre référence. Au début de l’audit, pour **262 champs hérités**, seule la source de comparaison de l’entrée était connue. Elle ne prouve pas l'origine de leur rédaction.
- Le contrôle du chapitre complet et des alias confirme **339 sorts dans le SRD 5.2.1 et 51 hors SRD**. Les 110 champs textuels des 51 sont examinés ; les 51 descriptions principales et huit profils convoqués sont réécrits dans la nouvelle édition. Voir le [bilan des sorts](SORTS-SRD.md). L'appartenance au SRD et les droits sur la rédaction actuelle restent distincts.
- Le rapprochement des sous-classes est terminé : **12 présentes dans le SRD 5.2.1 et 36 absentes**. Onze des douze présentes avaient été comparées à une autre publication ; le classement ne dépend donc pas de cette source de comparaison. Le [tableau des 48 sous-classes](SOUS-CLASSES-SRD.md) donne les noms du site, les correspondances et les pages du SRD. Le rapprochement reste à faire pour les dons et historiques.

## Attribution livrée

La mention prescrite dans le SRD français 5.2.1, les liens vers sa source et la licence CC BY 4.0, et l'indication des adaptations figurent dans le Grimoire et la page publique `/sources.html`. Les pieds de page donnent accès à cette page. L'ancienne URL `/mentions-legales.html` y redirige ; la page est une page de sources, pas une déclaration de conformité complète des mentions légales ou de la politique de confidentialité.

L'attribution des compléments SRD 5.1 est conservée. Une attribution SRD existait déjà dans un volet de la fiche personnage : elle n'était donc pas absente de tout le site, mais elle manquait au Grimoire.

## Comparaison des textes

Référence : [PDF officiel français SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf), 380 pages, SHA-256 `480604d949a3bb77f639cf31c1e9e1e7ebb04ae481d943db662ba546828d94bf`.

Le texte est extrait colonne par colonne avec PDFium. La comparaison ignore casse, accents et ponctuation ; elle relève les suites d'au moins douze mots identiques. Pour les descriptions de sorts : 69 correspondent entièrement après normalisation, 265 partagent au moins une suite et 56 n'en partagent pas. Ces résultats détectent des ressemblances ; ils ne déterminent ni une contrefaçon ni une autorisation. Une phrase commune peut décrire une mécanique commune.

L'inventaire détaillé [description-provenance-2024.json](description-provenance-2024.json) contient les chemins des champs, empreintes, références et résultats de comparaison, sans recopier leurs textes. Il est produit par [audit-description-provenance.mjs](audit-description-provenance.mjs), à partir du PDF et de son extraction locale dans `.local/descriptions-review/`. Les livres hors SRD ne font pas l'objet d'une comparaison exhaustive dans ce lot.

## Reste à faire avant de déclarer les textes prêts pour une diffusion plus large

1. Établir l'appartenance au SRD de chaque don, historique et profil référencé ailleurs. Les classements des 48 sous-classes et des 390 sorts sont terminés ; les droits de redistribution de leurs textes restent distincts. Une référence Roll20 peut aussi décrire un élément du SRD.
2. Retrouver la provenance des 262 champs hérités et des 95 champs complémentaires. Les sources de vérification des mécaniques ne suffisent pas à attribuer leur prose.
3. Pour les descriptions effectivement hors SRD : examiner la rédaction, sa source et les conditions d'utilisation. Préparer des résumés indépendants centrés sur les informations nécessaires au jeu, puis contrôler la fidélité des mécaniques. Une paraphrase ou une traduction ne garantit pas à elle seule les droits de redistribution ; les cas non résolus doivent rester signalés et faire l'objet d'un choix explicite avant publication dans l'application.
4. Revoir séparément les droits du PDF de fiche, des illustrations et les usages de marques : ce contrôle textuel ne les valide pas.

**Les 51 descriptions de sorts, huit profils convoqués et les textes des 36 sous-classes hors SRD sont désormais réécrits ou conservés lorsqu’ils avaient déjà une rédaction indépendante (deux passages RP). Ce lot ne valide pas les droits et ne couvre pas tout le catalogue.** La licence du SRD ne s'étend pas aux autres contenus du catalogue. Les sources, textes et personnages existants sont préservés.

Références : [SRD officiel](https://www.dndbeyond.com/srd), [licence CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode).

## Classements terminés et propositions éditoriales

- [48 sous-classes : 12 SRD et 36 hors SRD](SOUS-CLASSES-SRD.md).
- [390 sorts : 339 SRD et 51 hors SRD](SORTS-SRD.md), avec lecture des 110 champs des 51 sorts.
- [Six retouches appliquées](editorial-description-drafts-2024.json), avec valeurs avant/après et empreintes : deux passages RP de sous-classes et quatre descriptions de sorts. Elles sont appliquées avec leurs contrôles d’empreinte ; 29 corrections d’espacement les accompagnent. Elles ne changent pas le statut des droits.

Les compteurs de références ci-dessus décrivent les sources documentaires de départ, pas l’auteur de chaque nouvelle phrase. Le journal [non-srd-description-rewrite-20261030.json](../data/non-srd-description-rewrite-20261030.json) trace séparément les 238 rédactions nouvelles, avec leurs valeurs sources. Les statistiques, composantes matérielles, textes de progression et tableaux complémentaires restent des données techniques distinctes.
