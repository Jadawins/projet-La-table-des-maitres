# Bestiaire relié aux combats

Dans un groupe dont vous êtes MJ, ouvrir le combat en préparation ou le mettre en pause. Le panneau **Ajouter depuis le bestiaire** permet de rechercher un profil par nom français ou anglais, sans tenir compte des accents, puis de filtrer par type, taille et facteur de puissance. Les FP fractionnaires sont acceptés. Les résultats sont paginés par 40, avec **Afficher la suite**.

Le profil affiche les PV, CA, caractéristiques, vitesses, sauvegardes, compétences, sens, résistances, immunités, attaques et aptitudes effectivement présents dans la base. Les descriptions sont présentées comme du texte, sans interpréter du HTML. Les textes très longs peuvent être abrégés avec une indication. Le module n’invente pas de bonus d’initiative à partir d’un bonus de Dextérité ; le total reste saisi avec vos dés.

Choisir entre un et vingt exemplaires et **Ajouter au combat**. Les noms sont numérotés sans doublon ; chaque exemplaire possède ses propres PV, états et initiative non renseignée. Ils commencent cachés aux joueurs. La limite globale reste de 100 participants. Pendant un combat démarré, l’ajout demande une pause.

## Données et accès

La source de production est la collection MongoDB existante `monstres` : 322 profils au relevé initial. Aucun nouveau catalogue de règles n’est livré dans le navigateur et l’ancien import destructif `api/import-monstres.js` n’est jamais exécuté. Le catalogue PHB figé, les fiches, groupes et combats existants ne sont pas migrés.

Les recherches peuvent utiliser un cache serveur de soixante secondes. Au moment d’ajouter, le serveur relit le profil et utilise ses propres PV et CA : une valeur envoyée par le navigateur ne peut pas les remplacer. Une copie bornée du profil et son empreinte sont conservées dans le participant. Les corrections ultérieures du bestiaire ne changent donc pas silencieusement les adversaires déjà préparés.

Le bestiaire de préparation et les profils copiés sont réservés au MJ du groupe, côté serveur. Révéler un adversaire aux joueurs ne révèle pas son profil, ses PV, sa CA ou ses attaques. Une erreur du bestiaire laisse accessibles le combat et la création manuelle d’un adversaire.

## Portée de cette intégration

Ce lot reprend les profils existants sans réécrire leurs mécaniques ou descriptions. Le libellé de source hérité `SRD-2024` est conservé dans les données ; il ne constitue pas une vérification de l’édition de chaque profil. L’import historique mentionne des données open5e et contient des descriptions anglaises. Ce raccordement ne vaut donc pas nouvel audit documentaire du bestiaire. Les attributions SRD 5.1 et 5.2.1 restent accessibles sur la page Sources et licences.

Les attaques et aptitudes sont des repères de lecture : aucun lancer, effet, résistance ou dégât n’est appliqué automatiquement. La résolution automatisée des attaques reste un lot séparé.

## Vérification

Tests du fournisseur, des droits d’accès et des ajouts au combat : recherche, fractions, pagination, quantités, absence de statistiques, valeurs serveur, snapshots stables, PV indépendants, révisions périmées, confidentialité et indisponibilité. Les parcours navigateur couvrent recherche/filtres, ajout multiple, consultation des profils, sauvegarde/réouverture et compte joueur ; les parcours existants sont conservés.

Le proxy de tests simule une adresse source distincte à chaque connexion de navigateur. Cela évite de faire passer tous les comptes simulés pour un seul client et de déclencher leur limite commune de connexions. Les protections de production restent actives et inchangées. Le résultat HTTP de connexion est désormais vérifié avant d’attendre la navigation.

Le contrôle réel `audit/check-bestiary-persistence.mjs` lit les profils MongoDB, vérifie leur pagination et écrit uniquement dans des groupes et combats de contrôle. Les collections réelles `personnages_refonte`, `groupes_refonte`, `combats_refonte` et `monstres` sont comparées avant/après. Une sauvegarde et un retour arrière précèdent la publication.

Publication du 1er novembre 2026 : livraison `20261101T160457Z`. Les 68 tests ciblés et dix-huit parcours navigateur passent, sans échec ni test ignoré, puis un parcours visuel est repris après l’harmonisation des champs du combat. Les 322 profils source se normalisent et sont importables avec leurs PV et CA ; 311 comportent des attaques structurées, les onze autres restent présentés avec les seuls renseignements existants. Les neuf contrôles MongoDB du bestiaire, onze du combat, huit des groupes et 22 parcours de personnages passent avant/après publication, ainsi que vingt et un accès HTTP. Les empreintes des collections réelles sont identiques. Sauvegarde de 3 281 documents et retour arrière : `/root/backups/myrpgtable-persistence-20261101T160457Z/`. [Relevé de publication](../audit/bestiary-publication-20261101.json). Aucune connexion interactive en production n’a été automatisée.
