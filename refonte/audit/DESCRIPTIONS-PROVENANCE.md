# Provenance des descriptions — 30 octobre 2026

Ce contrôle porte sur les textes et leur provenance. Le gel des **règles de jeu** ne vaut pas validation des droits de redistribution. Aucun texte du catalogue, calcul ou personnage n'est modifié par ce lot.

## Résultats établis

Le catalogue reconstruit pour l'audit a la même empreinte SHA-256 que la version MongoDB publiée : `b2029d300c21ab5631e54d701b3506874f9253f7787c84cde324111c788a4697`.

- Le journal contient **738 corrections**, dont **566** référencent le SRD français 5.2.1 et **172** d'autres références. Les 16 ajouts sont comptés séparément. Une correction n'est pas un texte ni une entrée unique.
- L'inventaire couvre les **637 entrées du Grimoire**, puis les compétences et profils complémentaires : **785 entrées au total**, dont 734 avec du texte détecté.
- **2 001 champs textuels** sont relevés, plus **95 champs** des fichiers complémentaires. Noms seuls, identifiants, chiffres isolés et métadonnées ne sont pas comptés comme descriptions.
- Pour 1 267 champs, une correction, un ajout ou une source explicite renvoie au SRD ; pour 472, à une autre référence. Pour **262 champs hérités**, seule la source de comparaison de l'entrée est connue. Elle ne prouve pas l'origine de leur rédaction.
- **339 des 390 sorts** figurent dans l'index documentaire SRD déjà établi ; **51 n'y figurent pas**. Cette absence est une priorité de recherche, pas une conclusion juridique.
- Les 47 sous-classes comparées à une autre référence ne sont **pas** automatiquement 47 sous-classes hors SRD. Leur présence éventuelle dans le SRD reste à rapprocher individuellement. Même réserve pour les dons et historiques.

## Attribution livrée

La mention prescrite dans le SRD français 5.2.1, les liens vers sa source et la licence CC BY 4.0, et l'indication des adaptations figurent dans le Grimoire et la page publique `/sources.html`. Les pieds de page donnent accès à cette page. L'ancienne URL `/mentions-legales.html` y redirige ; la page est une page de sources, pas une déclaration de conformité complète des mentions légales ou de la politique de confidentialité.

L'attribution des compléments SRD 5.1 est conservée. Une attribution SRD existait déjà dans un volet de la fiche personnage : elle n'était donc pas absente de tout le site, mais elle manquait au Grimoire.

## Comparaison des textes

Référence : [PDF officiel français SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf), 380 pages, SHA-256 `480604d949a3bb77f639cf31c1e9e1e7ebb04ae481d943db662ba546828d94bf`.

Le texte est extrait colonne par colonne avec PDFium. La comparaison ignore casse, accents et ponctuation ; elle relève les suites d'au moins douze mots identiques. Pour les descriptions de sorts : 69 correspondent entièrement après normalisation, 265 partagent au moins une suite et 56 n'en partagent pas. Ces résultats détectent des ressemblances ; ils ne déterminent ni une contrefaçon ni une autorisation. Une phrase commune peut décrire une mécanique commune.

L'inventaire détaillé [description-provenance-2024.json](description-provenance-2024.json) contient les chemins des champs, empreintes, références et résultats de comparaison, sans recopier leurs textes. Il est produit par [audit-description-provenance.mjs](audit-description-provenance.mjs), à partir du PDF et de son extraction locale dans `.local/descriptions-review/`. Les livres hors SRD ne font pas l'objet d'une comparaison exhaustive dans ce lot.

## Reste à faire avant de déclarer les textes prêts pour une diffusion plus large

1. Vérifier les 51 sorts absents de l'index SRD, puis établir l'appartenance au SRD de chaque sous-classe, don, historique et profil référencé ailleurs. Une référence Roll20 peut aussi décrire un élément du SRD.
2. Retrouver la provenance des 262 champs hérités et des 95 champs complémentaires. Les sources de vérification des mécaniques ne suffisent pas à attribuer leur prose.
3. Pour les descriptions effectivement hors SRD : examiner la rédaction, sa source et les conditions d'utilisation. Préparer des résumés indépendants centrés sur les informations nécessaires au jeu, puis contrôler la fidélité des mécaniques. Une paraphrase ou une traduction ne garantit pas à elle seule les droits de redistribution ; les cas non résolus doivent rester signalés et faire l'objet d'un choix explicite avant publication dans l'application.
4. Revoir séparément les droits du PDF de fiche, des illustrations et les usages de marques : ce contrôle textuel ne les valide pas.

**Aucune réécriture globale ni validation juridique du contenu hors SRD n'a été effectuée.** La licence du SRD ne s'étend pas aux autres contenus du catalogue. Les sources, textes et personnages existants sont préservés.

Références : [SRD officiel](https://www.dndbeyond.com/srd), [licence CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode).

## Première liste de vérification : sorts absents de l’index SRD

Les 51 noms ci-dessous sont des candidats à examiner, sans présumer de la provenance exacte de chaque champ ni d’une absence dans toutes les versions du SRD. Leurs références individuelles sont dans l’inventaire JSON.

- Coup de tonnerre (`coup_de_tonnerre`)
- Faux amis (`faux_amis`)
- Frappe épineuse (`frappe_epineuse`)
- Glas (`glas`)
- Mot de radiance (`mot_de_radiance`)
- Voile défensif (`voile_defensif`)
- Armure d'Agathys (`armure_d_agathys`)
- Châtiment de tonnerre (`chatiment_de_tonnerre`)
- Duel forcé (`duel_force`)
- Grêle d'épines (`grele_d_epines`)
- Tentacules de Hadar (`tentacules_de_hadar`)
- Trait ensorcelé (`trait_ensorcele`)
- Convocation de bête (`convocation_de_bete`)
- Cordon de flèches (`cordon_de_fleches`)
- Couronne du dément (`couronne_du_dement`)
- Nuée de daggers (`nuee_de_daggers`)
- Présence bestiale (`presence_bestiale`)
- Présence royale de Yolane (`presence_royale_de_yolane`)
- Vigueur arcanique (`vigueur_arcanique`)
- Arme élémentaire (`arme_elementaire`)
- Aura du croisé (`aura_du_croise`)
- Aura de vitalité (`aura_de_vitalite`)
- Châtiment de cécité (`chatiment_de_cecite`)
- Châtiment de courroux (`chatiment_de_courroux`)
- Convocation de fée (`convocation_de_fee`)
- État cadavérique (`etat_cadaverique`)
- Flèche de foudre (`fleche_de_foudre`)
- Vif carquois (`vie_carquois`)
- Voracité de Hadar (`voracite_de_hadar`)
- Convocation d'aberration (`convocation_d_aberration`)
- Convocation d'artificiel (`convocation_d_artificiel`)
- Convocation d'élémentaire (`convocation_de_elementaire`)
- Grasping Vine (`lame_avide`)
- Cercle de pouvoir (`cercle_de_pouvoir`)
- Châtiment du ban (`chatiment_du_ban`)
- Convocation de céleste (`convocation_de_celeste`)
- Convocation de mort-vivant (`convocation_de_mort_vivant`)
- Frappe du vent d'acier (`frappe_du_vent_d_acier`)
- Invocation de volée (`invocation_de_volee`)
- Perturbations synaptiques (`perturbations_synaptiques`)
- Tempête radieuse de Jallarzi (`tempete_radieuse_de_jallarzi`)
- Vague destructrice (`vague_destructrice`)
- Chaudron bouillonnant de Tasha (`chaudron_bouillonnant_de_tasha`)
- Convocation de fiélon (`convocation_de_fielon`)
- Portail arcanique (`portail_arcanique`)
- Mot de pouvoir fortifiant (`mot_de_pouvoir_fortifiant`)
- Télépathie (`telepathie`)
- Flux de lune (`flux_de_lune`)
- Mind Sliver (`mind_sliver`)
- Staggering Smite (`staggering_smite`)
- Aura de pureté (`aura_de_purete`)
