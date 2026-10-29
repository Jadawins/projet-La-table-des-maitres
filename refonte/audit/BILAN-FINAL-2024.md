# Bilan du lot PHB 2024

Référence : `phb2024-2026-10-28`, PHB 2024 et errata officiels disponibles au 28 octobre 2026. Bilan établi le 29 octobre 2026. Ce lot concerne la création et la fiche sur ordinateur, niveaux 1 à 20. Le téléphone, le multiclasse et la gestion du combat restent hors périmètre.

## Résultat

Sur 814 entrées documentaires, **809 sont clôturées** et **cinq sont exclues des nouveaux choix faute de référence retrouvée**. Aucune de ces cinq n'est présentée comme conforme. Le registre contient les références, les champs comparés et les preuves de vérification ; le journal conserve les valeurs avant/après, sources et préconditions des corrections.

Le périmètre comprend 12 classes et 48 sous-classes, 10 espèces, 16 historiques, 75 dons actifs (deux autres archivés), 390 sorts actifs (un doublon conservé pour traçabilité), 38 armes, 13 armures, 25 outils, 18 compétences, huit bottes d'armes, 28 manifestations occultes et les profils complémentaires. Les dix profils draconiques conservés au catalogue ne rétablissent pas l'ancienne transformation erronée de l'ensorceleur draconique.

Les modifications touchent les paliers, conditions et ressources des aptitudes, les listes et paramètres des sorts, les effets des dons, ainsi que les prix, poids, propriétés et usages de l'équipement. Les effets conditionnels sont distingués des valeurs permanentes ; leur présence sur la fiche ne signifie pas qu'un moteur de combat les exécute.

## Preuves

- Campagne unitaire complète : **2 840 réussites**, aucun échec, ignoré ou annulé. Les 55 contrôles complémentaires réussis comprennent deux cas nouveaux : 2 842 tests distincts à ce stade.
- Rapprochement final du catalogue : **1 106 réussites**, aucun échec, ignoré ou annulé. Contrôle des valeurs intégrées contre les comparaisons enregistrées, des 16 ajouts et de l'affichage des 390 sorts ; distinction entre DD fixe et DD du personnage. Total : **3 948 tests unitaires distincts**.
- Campagne navigateur complète : **1 296 réussites et deux échecs de tests**, aucun ignoré ni résultat instable, en 1 h 28. Une assertion cherchait une ancienne formulation ; un scénario omettait les choix obligatoires de Doué. Les deux fichiers ont été rejoués après correction : **six réussites**, aucun échec, ignoré ou résultat instable. Les rapports initiaux sont conservés ; les 1 298 parcours distincts sont ainsi couverts. Ce n'est pas une nouvelle exécution complète d'un seul tenant.
- Les 48 sous-classes ont une couverture à chacun des niveaux 1 à 20 ; le clerc est couvert avec ses deux vocations. Création, fiche, sauvegarde, actualisation, réouverture et conservation des choix sont contrôlées.

Les fichiers applicatifs et le catalogue fonctionnel sont identiques à ceux de la campagne navigateur. Les changements ultérieurs portent sur les tests, les preuves, l'affichage du suivi et le marqueur administratif du gel. L'empreinte initiale, celle du gel et cette différence de métadonnées sont distinguées dans le manifeste final.

Preuves : `final-unit-verification.json`, `final-browser-verification.json`, `final-catalogue-verification.json` et leurs journaux/rapports associés. L'affichage isolé d'un sort dans les contrôles complémentaires ne certifie pas un personnage complet ; les parcours et tests de validation assurent cette autre partie du contrôle.

## Réserves et conservation

Les cinq exclusions sont : `giant-rat-diseased`, `swarm-of-beetles`, `swarm-of-centipedes`, `swarm-of-spiders` et `swarm-of-wasps`. Le contrôle d'exclusion et le garde de publication les distinguent des entrées validées. Les anciens dons Truand/Préparateur de poison et le doublon Couronne de folie restent archivés.

Les fiches anciennes gardent leur version : aucune réécriture ni aucun recalcul silencieux. La remise à niveau crée une copie avec un nouvel identifiant ; l'original reste protégé au serveur. Aucun personnage réel n'a été modifié dans ce lot ; Youpi matin demeure au niveau 3, révision 1. Les contrôles utilisent des personnages synthétiques dans un environnement local. Les dés physiques restent possibles et aucun lancer n'est automatique.

## Gel et publication

Le gel local est consigné dans `final-freeze-manifest.json` après contrôle du registre et des preuves. L'archive locale finale et sa vérification d'extraction sont enregistrées dans `final-backup-verification.json`. La première sauvegarde candidate et les traces des deux échecs initiaux restent également disponibles.

**Aucune publication ni écriture sur le VPS dans cette reprise.** La version de production existante est conservée. Avant une publication distincte : sauvegarder la BDD et la version déployée, vérifier leur restauration possible, préparer le paquet validé et conserver le retour vers la version précédente (`20261028T145508Z`, à confirmer sur le VPS). Les sessions en mémoire et l'ancien site doivent être traités séparément si leur ouverture au public change.

Pour restaurer les sources locales : extraire l'archive finale dans un dossier vide, vérifier les empreintes du manifeste, puis utiliser cette copie. Les dépendances et les secrets sont exclus de l'archive et restent à fournir dans l'environnement d'exécution. Ce n'est pas une sauvegarde de la BDD de production.

Le lot s'arrête sur cette référence. Aucune recherche continue de nouveaux errata ni modification automatique après gel ; une évolution ultérieure ouvre un nouveau lot daté.
