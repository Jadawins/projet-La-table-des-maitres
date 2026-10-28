# Refonte — La Table du Maître

## Priorité actuelle : PC, clerc jusqu’au niveau 10

Décision utilisateur : le téléphone et l’application installable sont hors périmètre tant que les espèces, classes et sous-classes ne sont pas fiables sur PC. Les notes plus anciennes évoquant un chantier mobile ne définissent plus la priorité.

Le clerc est désormais pris en charge aux niveaux 1–10, pour les quatre domaines de la BDD actuelle. Voir [CLERC-1-10.md](audit/CLERC-1-10.md) pour les 40 lignes de contrôle et les limites, notamment les noms de sorts non reliés et les effets de dons qui restent décrits. 80 scénarios couvrent les deux vocations ; 125 tests passent au total. Le parcours PC complet de niveau 10 a aussi été vérifié dans le navigateur. Les choix des paliers 4/8, Frappe consacrée au niveau 7, les ressources et la maîtrise courante sont conservés dans la sauvegarde.

Livraison active : `/var/www/myrpgtable/refonte-access/20261027T150406Z`. Sauvegarde préalable de 3 267 documents : `/root/backups/myrpgtable-persistence-20261027T150406Z/`. Un contrôle réel MongoDB a enregistré puis relu les quatre domaines au niveau 10 dans la collection de tests avant de supprimer uniquement son document temporaire. Aucun personnage utilisateur n’est monté de niveau automatiquement.

## Référence courante — décision utilisateur du 27 octobre 2026

Développer à partir de la **BDD actuelle**. La comparaison avec les publications externes et les errata est remise à plus tard. Les corrections de contenu ajoutées au catalogue local à partir de ces sources ont été retirées ; les observations sont conservées dans `audit/COMPARAISON-EXTERNE-DIFFEREE.md` comme historique, sans statut de correction obligatoire. Les notes plus anciennes ci-dessous décrivent les étapes précédentes et ne remplacent pas cette décision.

Conserver les adaptations techniques explicites (identifiants, STR/FOR, libellés de compétences, liaison connue d'un nom de sort), sans inventer une règle, une compétence ou une fiche absente. Les quatre domaines du clerc sont sélectionnables à partir des données existantes. Les noms de sorts non reliés restent visibles comme tels.

## Décisions du 27 octobre 2026

- Refonte complète, module par module. Le site actuel n'a pas besoin d'être maintenu en parallèle.
- Conserver la direction artistique sombre, violet et or, Supabase pour l'authentification et MongoDB pour les données.
- D&D 2024 uniquement pour le premier module. Concevoir pour ordinateur et téléphone dès le départ.
- L'utilisateur veut choisir la manière de lancer les dés : dés physiques avec saisie des résultats, ou dés dans l'application déclenchés explicitement. Il préfère personnellement les dés physiques. Conserver aussi les méthodes sans lancer pour les caractéristiques. Étendre ce choix aux futurs jets de la fiche ; ne rien lancer automatiquement.
- Premier module : mes personnages, création, sauvegarde et fiche. Le niveau de départ se choisit dès l'identité (1 à 20), notamment pour les aventures commençant au niveau 3. Le moteur devra proposer tous les choix requis jusqu'au niveau retenu. L'implémentation pourra être progressive, avec un premier scénario de niveau 1 puis de niveau 3 ; ne pas figer l'interface au niveau 1.
- Nouvelle création : aucun nom, classe, espèce ou historique présélectionné. Distinguer le bouton « Créer un personnage » de « Reprendre mon brouillon ». Le résumé affiche les choix seulement après sélection.
- Ne pas développer campagnes, sessions, combat partagé, contenus personnalisés ou générateur LPC pendant ce module.
- Une application installable est un objectif ultérieur, après validation de l'expérience mobile.

## Livraison actuelle : maquette locale

Choix d'origine et dons : [ORIGINES.md](ORIGINES.md). Le parcours humain, les options structurées des dons et des lignages, les sorts d'origine et les effets Robuste/Vigilant sont intégrés à partir de la BDD. Cette note précise les limites restantes.

Mise à jour : un premier parcours de règles est intégré pour le clerc 1–3 / domaine de la Vie. Voir [REGLES-2024.md](REGLES-2024.md) pour les choix implémentés, les corrections locales, les tests et les limites. Les sections de cadrage initial ci-dessous décrivent le point de départ ; ce fichier de suivi précise l'état actuel.

`maquette/` contient une proposition interactive à examiner avant de développer le module final. Aucun appel à l'API de production, aucune modification de Supabase ou MongoDB. Les exemples sont fictifs ; le catalogue provient des fichiers JSON locaux, dont la concordance avec MongoDB reste à vérifier.

Le parcours esquisse six sections : identité, classe, origines, caractéristiques, équipement, récapitulatif. Les caractéristiques proposent la saisie de dés physiques, six jets de 4d6 avec retrait du plus faible dans le navigateur (chaque dé est affiché ; génération par Web Crypto sans biais de modulo), ou les valeurs standard. Les résultats peuvent être répartis librement. Le mode physique est proposé en premier ; rien n'est lancé à l'ouverture. L'achat de points reste à intégrer dans la version complète. La fiche est un aperçu, pas un personnage complet ou validé. Les aptitudes, dons, maîtrises, langues, sorts et lignages devront être conçus dans les sections correspondantes avant toute sauvegarde réelle. Pas de moteur de règles complet dans cette maquette.

Lancer depuis la racine du dépôt : `node refonte/serve.mjs`, puis ouvrir l'adresse affichée. `/mobile.html` affiche la même interface dans un cadre de 390 × 844 pour vérifier l'adaptation à un petit écran. Le serveur écoute uniquement sur la boucle locale et ne sert que la maquette, le catalogue et son image de fond. Le brouillon est stocké uniquement dans ce navigateur, sous une clé propre à la maquette.

## Prochaines étapes, dans cet ordre

Suivi de l'audit exhaustif : [audit/SUIVI.md](audit/SUIVI.md). Vue interactive : `/audit.html` avec le serveur local. Régénérer après un nouvel extrait avec `node refonte/audit/run.mjs`. Les données brutes, les références, les tests numériques, l'état de l'interface et la validation complète sont distingués. Les cases ne deviennent pas vertes par simple présence de données.

1. Valider le parcours et la direction visuelle avec l'utilisateur.
2. Vérifier les données et les contrats des routes existantes ; fixer le modèle d'un personnage 2024, les identifiants, unités et données sources.
3. Préparer une sauvegarde vérifiée du code et de MongoDB avant les changements serveur. Ne pas supposer que Git sauvegarde la BDD.
4. Construire l'enveloppe de l'application, la connexion et la liste réelle des personnages.
5. Implémenter la création avec calculs indépendants de l'interface et validation serveur ; couvrir les choix de niveau 1, y compris les particularités des espèces et des classes.
6. Enregistrer et relire une fiche cohérente ; tester le parcours sur ordinateur et téléphone.
7. Remplacer l'ancienne interface, puis étudier l'installation sur téléphone.

La technologie de la nouvelle application n'est pas encore arrêtée. Garder une séparation entre interface, règles/calculs et accès aux données ; choisir l'outillage après la validation du parcours.

## Points repérés dans l'existant

### Consultation de MongoDB le 27 octobre 2026

Accès SSH et lecture de la base `myrpgtable` vérifiés. Aucune écriture dans MongoDB et aucun identifiant exporté. Comptages : 12 classes, 48 sous-classes, 10 espèces, 16 historiques, 374 sorts, 75 dons, 17 compétences, 37 armes et 13 armures. Les classes possèdent leurs données de niveaux 0 à 20. Ces nombres décrivent le contenu présent, pas sa conformité exhaustive aux règles.

`data/classes-mongodb.json` est un extrait limité aux noms de classes et à `niveaux.0.caracteristique_principale`. La suggestion de caractéristiques utilise cet extrait réel de MongoDB ; les autres données de la maquette restent issues des fichiers JSON locaux. Ce n'est pas une connexion permanente du navigateur à la BDD.

La suggestion est volontaire : elle conserve les six résultats, affecte les plus élevés aux caractéristiques principales, puis à CON, et conserve l'ordre relatif des autres caractéristiques. La priorité entre plusieurs principales est choisie par le joueur. Le choix de CON est une aide proposée par l'interface, pas un champ inventé dans MongoDB. Prévoir ultérieurement les profils comme guerrier Force ou Dextérité et les préférences secondaires plus fines. Répartition manuelle et annulation restent possibles ; aucun relancement.

### À traiter pendant la reconstruction

- Certains champs utilisent STR au lieu de FOR ; normaliser à la frontière des données et lors de la reprise d'un brouillon.
- L'or d'historique peut figurer dans la liste d'équipement plutôt que dans `or_depart`. Éviter omissions et doubles comptages.
- L'achat d'un objet peut remplacer le paquetage de classe dans le code existant.
- Le bouclier décrit un bonus de CA, pas une CA de base.
- Les étapes doivent dépendre des choix du personnage ; ne pas imposer une étape de sorts vide.
- Vérifier le contenu des règles : l'affichage d'une donnée ne prouve pas son exactitude 2024.
- Le serveur actuel accepte des calculs de personnage fournis par le navigateur ; déterminer les validations serveur nécessaires.
- `api/auth.js` contient un repli qui décode un jeton sans vérifier sa signature lorsque les clés publiques sont indisponibles. Conserver Supabase, mais corriger ce comportement avant de brancher la nouvelle application : refuser l'accès si la vérification est impossible.

## Critères de fin du premier module

Créer, sauvegarder et rouvrir un personnage de niveau 1 avec tous ses choix obligatoires, retrouver exactement ses données et ses calculs, reprendre un brouillon, isoler les personnages de chaque compte et utiliser le parcours sur petit écran sans débordement. Tester au moins une classe martiale, une classe magique et les choix particuliers d'espèce. Prévoir erreurs réseau, expiration de session et validation côté serveur.

## Fiche de personnage (27 octobre 2026)

L’aperçu est accessible à tout moment depuis « Voir ma fiche en cours ». Il rassemble caractéristiques finales, sauvegardes, compétences, repères de partie, équipement et monnaies, aptitudes de classe/sous-classe, traits d’espèce, dons, sorts et détails de personnalité. Les champs libres (langues, apparence, histoire…) sont conservés dans le même brouillon local. Une mise en page d’impression A4 est fournie.

Les valeurs calculées reprennent la BDD actuelle. La CA suppose que l’armure et le bouclier de départ sont portés. Les effets particuliers restent consultables dans les aptitudes ; leur automatisation n’est pas exhaustive. Une compétence sans caractéristique reliée dans la source reste affichée avec un tiret. Les choix détaillés de classe restent limités au clerc 1–3 ; la fiche ne valide pas les autres parcours. Aucune sauvegarde distante ni modification de MongoDB.

Vérifications de la fiche : `node --test refonte/tests/sheet.test.mjs`.

## Mise à jour déployée — sorts et dons (27 octobre 2026, 15:40 UTC)

État courant : `/var/www/myrpgtable/refonte-access/20261027T154005Z`. La BDD reste la référence ; l’utilisateur a autorisé les références officielles uniquement pour les sorts manquants ou de rang incohérent. Le plan exact avec valeurs avant/après et références est dans `data/spell-link-corrections.json` ; ne pas le régénérer après migration. Une sauvegarde complète précède la correction, puis une autre précède le déploiement. L’historique serveur est dans `refonte_regles_corrections`.

- Quatre listes de domaines corrigées de manière ciblée ; Porte dimensionnelle ajoutée depuis le SRD 5.2.1 français avec attribution. Escamotage/DEX restauré depuis le fichier JSON d’origine. Catalogue : 375 sorts et 18 compétences. Les autres écarts potentiels de règles et paliers restent différés.
- Dons : choix structurés de compétence, expertise, élément et deux rituels, validation à leur niveau d’acquisition, conservation locale et distante. Intégration des bonus permanents de compétences, formations, outils, vitesse, escalade, vision, résistance au poison, plafond de DEX en armure intermédiaire et bonus par école de sort. Les effets conditionnels sont affichés et chiffrés sans modifier les valeurs permanentes. Aucun jet de dés automatique.
- Correction de la reprise des brouillons comportant des choix d’origine aux niveaux 4/8 : les emplacements sont initialisés avant leur lecture, évitant une interruption avant la restauration du niveau et des scores.
- Vérification : 136 tests, dont 80 scénarios clerc/domaine/vocation de niveau 1 à 10. Sauvegarde/relecture MongoDB vérifiées pour les quatre domaines niveau 10 ainsi que pour expertise et rituels ; collection temporaire vide après contrôle. Vérification visuelle sur PC du choix Expert, conservation après actualisation et expertise Escamotage +10 au niveau 10.
- Youpi matin vérifié après déploiement : niveau 3, révision 1, aucune modification du personnage.

Ces contrôles valident l’intégration du parcours clerc concerné ; ils ne valident pas toutes les règles du jeu ni les autres classes. Le téléphone reste hors périmètre.

Sources ciblées : [présentation officielle du clerc 2024](https://www.dndbeyond.com/posts/1767-2024-cleric-vs-2014-cleric-whats-new), [SRD 5.2.1 français](https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf).


## 28 octobre 2026 — clerc 1–20 déployé

Version 20261028T062037Z. 200 tests passent ; audit de 80 lignes et 160 scénarios. Choix des paliers 12/16/19, douze faveurs épiques, ressources et aptitudes de haut niveau, sorts jusqu’au rang 9. Vérification du parcours PC et sauvegarde/relecture serveur avec les quatre domaines et deux vocations. Sauvegarde préalable complète, aucune modification des personnages existants ; Youpi matin reste niveau 3, révision 1. Le README décrit désormais uniquement l’état actuel.


## 28 octobre 2026 — tests de parcours automatiques

200 tests de règles et 164 parcours Chromium réussis. Tests de création, sauvegarde, réouverture sans brouillon, modifications, erreur réseau et isolation. Préparation d’un déploiement bloquée en cas d’échec ; contrôle GitHub ajouté avant le travail de déploiement. Rapport complet dans audit/E2E-PC.md ; environ 13 minutes pour le navigateur local.

## 28 octobre 2026 — moteur commun et quatre classes prioritaires

Version 20261028T074925Z déployée. Le guerrier est différé au profit du barbare, du rôdeur, du barde et du druide. Progression commune extraite, quatre sous-classes chacune, niveaux 1–20, choix propres aux classes, calculs de fiche et sauvegarde. Le clerc reste couvert par les régressions.

531 tests de calcul/validation et 244 parcours Chromium réussis, sans test ignoré ni résultat instable. Les calculs couvrent les 320 combinaisons des nouvelles classes/sous-classes/niveaux ; le navigateur vérifie leurs paliers 1/3/6/10/20, ainsi que les 160 anciens parcours du clerc et quatre régressions.

Compléments officiels limités aux données manquantes, autorisés et tracés dans audit/COMPLEMENTS-CLASSES.md et data/class-supplements.json. Les terrains de la Terre conservent la structure antérieure présente dans la BDD. Les ambiguïtés du compagnon restent à préciser avec le MJ. Aucune modification des collections de règles pour cette extension.

Sauvegarde préalable de 3270 documents dans /root/backups/myrpgtable-persistence-20261028T074925Z/database.ejsonl.gz. Contrôle MongoDB réel des seize nouvelles sous-classes niveau 20, puis nettoyage de la collection temporaire. Youpi matin vérifié avant et après : niveau 3, révision 1. Accès authentifié et blocage des anciennes routes vérifiés après activation. Le téléphone reste hors périmètre.

## 28 octobre 2026 — douze classes intégrées et déployées

Version 20261028T133629Z. Ajout du guerrier, paladin, roublard, moine, ensorceleur, magicien et occultiste, quatre sous-classes chacune, niveaux 1–20. Choix propres aux classes, magie des sous-classes, grimoire, métamagies, pactes, invocations et arcanums intégrés au modèle, à la fiche et au contrat de sauvegarde. BDD conservée comme référence ; compléments absents uniquement, tracés dans les fichiers data et audit/COMPLEMENTS-CLASSES.md. Les noms non identifiés restent signalés sans effet inventé.

1 105 tests de règles et 392 parcours Chromium réussis, sans échec, test ignoré ni résultat instable, en 34,7 minutes pour le navigateur avec deux exécutants. 1 040 scénarios d’intégration des classes couvrent les vingt niveaux. Contrôle MongoDB réel des 44 sous-classes supplémentaires niveau 20, contrôles antérieurs du clerc conservés, puis nettoyage temporaire.

Sauvegarde complète préalable de 3 270 documents dans /root/backups/myrpgtable-persistence-20261028T133629Z/database.ejsonl.gz. Archive vérifiée par SHA-256. Youpi matin niveau 3, révision 1 avant et après. Accueil/connexion, protection de l’atelier et blocage des anciennes routes vérifiés. Téléphone hors périmètre ; toutes les combinaisons espèces/historiques/dons ne sont pas encore couvertes.

## 28 octobre 2026 — origines, historiques et dons vérifiés

Version 20261028T145508Z déployée. 2 360 tests de règles et 442 parcours Chromium réussis sans échec, test ignoré ni résultat instable. Matrice de 7 200 scénarios d’origine, 780 contrôles de dons, 332 combinaisons de don humain/historique/taille, styles et répartitions de bonus. Couverture exacte et limites dans audit/ORIGINES-DONS.md et E2E-PC.md.

Corrections : PV nains, formations d’armure et chaîne de prérequis, lien du don du Marin, fiches et calculs des sorts de lignage, résistances et sens, conservation des choix d’ascendance géante et de caractéristique du tieffelin, choix de compétence au niveau d’acquisition. Prestidigitation et Illusion mineure ajoutées au catalogue, sans écriture des collections de règles ; liens tracés dans data/origin-link-corrections.json. Deux sorts du gnome restent non identifiés, les six noms de classes antérieurs restent signalés.

Sauvegarde complète de 3 270 documents avant activation : /root/backups/myrpgtable-persistence-20261028T145508Z/database.ejsonl.gz. MongoDB réel : anciens contrôles et 44 sous-classes niveau 20, puis 30 origines et onze dons humains sauvegardés/relus, collection temporaire nettoyée. Youpi matin niveau 3, révision 1 avant et après. Routes HTTP et archive SHA-256 vérifiées.
