# La Table du Maître — état actuel

Dernière mise à jour : 28 octobre 2026. Atelier : https://myrpgtable.fr/atelier/.

## Périmètre

La création et la fiche du **clerc, barbare, rôdeur, barde et druide du niveau 1 au niveau 20**, avec les quatre sous-classes présentes pour chacune dans la BDD, sont intégrées sur ordinateur. Le téléphone et l’application installable restent hors périmètre. Les sept autres classes restent à traiter.

La **BDD actuelle sert de référence**. Les compléments ciblés sont tracés dans [data/spell-link-corrections.json](data/spell-link-corrections.json) et [audit/COMPLEMENTS-CLASSES.md](audit/COMPLEMENTS-CLASSES.md). Les huit terrains du Cercle de la Terre correspondent à une ancienne version conservée dans la BDD ; leurs listes manquantes sont complétées depuis les sources officielles correspondantes. L’intégration vérifiée ne signifie pas une conformité documentaire globale au Manuel 2024. Aucune correction supplémentaire de la BDD de règles n’a été faite pour cette extension.

## Fonctionnement disponible

- Création sans présélection d’identité, de classe, d’espèce ou d’historique ; choix des dés physiques, des jets explicites de l’application ou des valeurs standard.
- Choix des paliers 4, 8, 12 et 16, puis don ou faveur épique au niveau 19. Prérequis évalués à leur palier et plafonds de caractéristiques propres à chaque don.
- Sorts et emplacements jusqu’au rang 9 ; ressources actualisées ; Frappe consacrée améliorée au niveau 14 ; aptitudes des domaines au niveau 17 ; Grâce divine suprême au niveau 20.
- Choix structurés et sauvegardés des dons et faveurs : compétences, expertise, éléments, résistances, rituels et sort supplémentaire. Les bonus permanents sont intégrés à la fiche ; les effets conditionnels restent détaillés et chiffrés, sans lancer de dés automatique.
- Fiche en six rubriques, impression, brouillons locaux, sauvegarde dans le compte, réouverture et isolation entre comptes.
- Moteur commun de progression : paliers lus depuis la BDD, prérequis au niveau d’acquisition, formations et augmentations permanentes. Le module du clerc conserve les particularités de ses domaines.
- Barbare : bottes, compétence supplémentaire, Rage, défense sans armure, attaques et augmentation FOR/CON du niveau 20. Rôdeur : style, expertises, langues, options du Chasseur et compagnon. Barde : instruments, expertises, Polyvalence et sorts par CHA. Druide : vocation, formes connues et profils, terrain et Élan élémentaire.
- Les choix pendant le combat restent décrits avec leurs conditions. Les ambiguïtés du compagnon exigent une précision du joueur avec le MJ ; aucun paramètre de règle manquant n’est inventé.

## Vérifications

Commande portable : `node refonte/e2e/verify.mjs`. Les tests de calcul et validation couvrent **531 cas**, dont chaque combinaison des quatre nouvelles classes, de leurs quatre sous-classes et des vingt niveaux. Voir le [rapport d’intégration](audit/CLASSES-PRIORITAIRES.md) et le [dernier rapport de parcours](audit/E2E-PC.md) pour les résultats d’exécution.

L’[audit du clerc 1–20](audit/CLERC-1-20.md) couvre 80 lignes et 160 scénarios domaine/niveau/vocation. Régénération et Résurrection sont affichées au rang réel 7 de leurs fiches, malgré la rubrique 5 de la liste brute du domaine Vie ; le palier BDD 17 est conservé.

Le parcours PC a été vérifié jusqu’à une fiche complète niveau 20 : paliers 12/16/19, faveur avec deux résistances, conservation après actualisation, six sorts mineurs et vingt-deux sorts préparés dont un de rang 9. Les contrôles serveur ont sauvegardé et relu les quatre domaines niveau 20 avec les deux vocations, les résistances et le sort de faveur, dans une collection temporaire nettoyée après usage.

Youpi matin a été vérifié avant et après déploiement : **niveau 3, révision 1, inchangé**.

Les [tests de parcours navigateur](e2e/README.md) automatisent 160 créations clerc/domaine/niveau/vocation, 80 créations des nouvelles classes aux niveaux 1, 3, 6, 10 et 20, et quatre scénarios de régression. Ils couvrent l’enregistrement, l’actualisation, l’ouverture sans brouillon local, les erreurs réseau et l’isolation entre comptes. Le script de préparation d’un déploiement lance les suites avant de créer le paquet ; les rapports et traces d’échec sont conservés localement et publiés comme artefacts par le workflow GitHub une fois ces changements envoyés dans le dépôt.

## Organisation

- `maquette/character-rules.mjs` : caractéristiques, PV, sorts et validation du parcours.
- `maquette/progression.mjs` : moteur commun de progression, paliers, prérequis et formations.
- `maquette/cleric-progression.mjs` : compatibilité et particularités des domaines du clerc.
- `maquette/class-profiles.mjs` : choix et ressources des quatre classes prioritaires.
- `maquette/origin-rules.mjs` et `feat-effects.mjs` : origines et dons.
- `maquette/sheet-model.mjs` / `sheet-view.mjs` : calcul et rendu de la fiche.
- `maquette/character-storage.mjs` : contrat de sauvegarde partagé avec le serveur.
- `access/` : accès authentifié, stockage, sauvegarde et déploiement.
- `audit/` et `tests/` : rapports et vérifications. Les anciens noms de fichiers 1–10 sont conservés pour compatibilité ; le rapport 1–20 est la référence du périmètre courant.

## Production

Version active : `/var/www/myrpgtable/refonte-access/20261028T074925Z`.

Service PM2 : `myrpgtable-refonte`. Une sauvegarde complète de MongoDB précède chaque déploiement, avec retour à la version précédente prévu par le script. L’ancienne application reste inaccessible. Les sessions en mémoire peuvent nécessiter une reconnexion après redémarrage ; leur persistance reste à traiter avant une ouverture publique plus large.

Le serveur local se lance avec `node refonte/serve.mjs` (port 4178 par défaut). Le test PC isolé utilise `REFONTE_PREVIEW_PORT=4188`. Pour relire les règles distantes, définir `MYRPGTABLE_SSH` puis exécuter `refonte/read-rules.ps1` ; aucun secret ne doit être exporté dans le projet.

## Suite

Utiliser les cinq parcours disponibles pour préparer les personnages de la table, puis traiter les sept autres classes. Le guerrier a été différé à la demande de l’utilisateur, au profit du barbare, du rôdeur, du barde et du druide. Le téléphone reste hors périmètre. L’historique est conservé dans [HISTORIQUE.md](HISTORIQUE.md).
