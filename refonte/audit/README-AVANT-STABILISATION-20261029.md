# La Table du Maître — état actuel

Dernière mise à jour : 28 octobre 2026. Atelier : https://myrpgtable.fr/atelier/.

## Périmètre

La création et la fiche des **douze classes du niveau 1 au niveau 20**, avec leurs **48 sous-classes présentes dans la BDD**, sont intégrées sur ordinateur. Le téléphone et l’application installable restent hors périmètre. Les douze classes sont déployées dans l’atelier.

**Production actuelle :** les règles proviennent encore de la BDD antérieure. Les compléments ciblés sont tracés dans [data/spell-link-corrections.json](data/spell-link-corrections.json) et [audit/COMPLEMENTS-CLASSES.md](audit/COMPLEMENTS-CLASSES.md). Les huit terrains du Cercle de la Terre correspondent à une ancienne version conservée dans la BDD ; leurs listes manquantes sont complétées depuis les sources officielles correspondantes. L’intégration vérifiée ne signifie pas une conformité documentaire globale au Manuel 2024. Aucune correction supplémentaire de la BDD de règles n’a été faite pour cette extension.

## Stabilisation en cours — référence fixe

Décision du 28 octobre 2026 : aligner le catalogue complet sur les règles 2024 et les errata officiels disponibles à cette date, puis figer cette version. Voir les [limites et conditions de clôture](REGLES-FIGEES.md). Les corrections locales sont journalisées avec leurs valeurs avant/après dans `data/rules-2024-corrections.json` ; elles ne réécrivent pas le relevé MongoDB.

État local au 29 octobre : 61 entrées corrigées et une fiche absente ajoutée sur copie (Rayon de lune). Le registre clôt 49 entrées sur 799 : sept sous-classes, huit bottes, dix espèces, seize historiques, deux dons et six sorts. Les quatre cercles du druide sont contrôlés dans des lots ciblés aux niveaux 1–20 ; les profils des formes animales restent ouverts, donc la classe n’est pas clôturée globalement. Dernier lot : 2 807 tests de calcul et validation et 60 parcours navigateur réussis, sans échec ni test ignoré. Les 80 parcours Terre et deux parcours de sorts appartiennent aux lots précédents. Ces preuves ne constituent pas une exécution complète de la version finale. Publication bloquée tant que le registre reste incomplet.

Suivi local : `http://127.0.0.1:9335/rules-progress.html`. Le registre compte 620 entrées principales (dont Rayon de lune ajouté pour une liste de sous-classe existante) et 179 compléments existants (compétences, profils, sorts ajoutés, invocations), soit 799 entrées à traiter, sans nouvelle fonctionnalité ajoutée au périmètre.

## Fonctionnement disponible en production

- Création sans présélection d’identité, de classe, d’espèce ou d’historique ; choix des dés physiques, des jets explicites de l’application ou des valeurs standard.
- Choix des paliers 4, 8, 12 et 16, puis don ou faveur épique au niveau 19. Prérequis évalués à leur palier et plafonds de caractéristiques propres à chaque don.
- Sorts et emplacements jusqu’au rang 9 ; ressources actualisées ; Frappe consacrée améliorée au niveau 14 ; aptitudes des domaines au niveau 17 ; Grâce divine suprême au niveau 20.
- Choix structurés et sauvegardés des dons et faveurs : compétences, expertise, éléments, résistances, rituels et sort supplémentaire. Les bonus permanents sont intégrés à la fiche ; les effets conditionnels restent détaillés et chiffrés, sans lancer de dés automatique.
- Fiche en six rubriques, impression, brouillons locaux, sauvegarde dans le compte, réouverture et isolation entre comptes.
- Moteur commun de progression : paliers lus depuis la BDD, prérequis au niveau d’acquisition, formations et augmentations permanentes. Le module du clerc conserve les particularités de ses domaines.
- Barbare : bottes, compétence supplémentaire, Rage, défense sans armure, attaques et augmentation FOR/CON du niveau 20. Rôdeur : style, expertises, langues, options du Chasseur et compagnon. Barde : instruments, expertises, Polyvalence et sorts par CHA. Druide : vocation, formes connues et profils, terrain et Élan élémentaire.
- Guerrier : bottes, styles, manœuvres, liens d’armes et progression des attaques. Paladin : serments, aura conditionnelle, réserve de soins et sorts par CHA. Roublard : expertises, frappe sournoise, Frappe rusée et magie du Filou.
- Moine : énergie, défense, vitesse, arts martiaux et vocations. Magicien : grimoire distinct des sorts préparés, maîtrise et signatures. Ensorceleur : métamagies, ascendance draconique et points de sorcellerie. Occultiste : invocations, pactes, sorts élargis et arcanums distincts des emplacements de pacte.
- Les choix pendant le combat restent décrits avec leurs conditions. Les ambiguïtés du compagnon exigent une précision du joueur avec le MJ ; aucun paramètre de règle manquant n’est inventé.

## Vérifications de la version déployée avant stabilisation

Trois vérifications distinctes sont suivies : les calculs et validations à chaque niveau, les parcours réels dans le navigateur à des paliers représentatifs, puis la sauvegarde/relecture MongoDB avant mise en ligne. Une classe intégrée n’est pas annoncée comme entièrement vérifiée avant la réussite de ces contrôles.

Commande portable : `node refonte/e2e/verify.mjs`. Les **2 360 tests de calcul, validation et stockage passent**, couvrant les douze classes, leurs quatre sous-classes et les vingt niveaux. Voir le [rapport d’intégration](audit/CLASSES-PRIORITAIRES.md) et le [dernier rapport de parcours](audit/E2E-PC.md) pour les résultats d’exécution.

L’[audit du clerc 1–20](audit/CLERC-1-20.md) couvre 80 lignes et 160 scénarios domaine/niveau/vocation. Régénération et Résurrection sont affichées au rang réel 7 de leurs fiches, malgré la rubrique 5 de la liste brute du domaine Vie ; le palier BDD 17 est conservé.

Les **1 094 parcours navigateur sont couverts par deux exécutions réussies sur la même application**, sans échec, test ignoré ni résultat instable. Le parcours PC a été vérifié jusqu’à une fiche complète niveau 20 : paliers 12/16/19, faveur avec deux résistances, conservation après actualisation, six sorts mineurs et vingt-deux sorts préparés dont un de rang 9. Les contrôles serveur ont sauvegardé et relu les quatre domaines du clerc niveau 20 avec les deux vocations, les résistances et le sort de faveur, puis les 44 sous-classes des onze autres classes niveau 20, les 30 origines et les onze dons humains, dans une collection temporaire nettoyée après usage.

Youpi matin a été vérifié avant et après déploiement : **niveau 3, révision 1, inchangé**.

Les [tests de parcours navigateur](e2e/README.md) automatisent 160 créations clerc/domaine/niveau/vocation, 880 créations des onze autres classes, avec leurs quatre sous-classes à chaque niveau de 1 à 20, 50 parcours d’origines et de dons, et quatre scénarios de régression. Ils couvrent l’enregistrement, l’actualisation, l’ouverture sans brouillon local, les erreurs réseau et l’isolation entre comptes. Le script de préparation d’un déploiement lance les suites avant de créer le paquet ; les rapports et traces d’échec sont conservés localement et publiés comme artefacts par le workflow GitHub une fois ces changements envoyés dans le dépôt.

## Organisation

- `maquette/character-rules.mjs` : caractéristiques, PV, sorts et validation du parcours.
- `maquette/progression.mjs` : moteur commun de progression, paliers, prérequis et formations.
- `maquette/cleric-progression.mjs` : compatibilité et particularités des domaines du clerc.
- `maquette/class-profiles.mjs` et `extra-classes.mjs` : choix et ressources des classes.
- `maquette/class-magic.mjs` et `warlock-options.mjs` : incantation, pacte et invocations.
- `maquette/origin-rules.mjs` et `feat-effects.mjs` : origines et dons.
- `maquette/sheet-model.mjs` / `sheet-view.mjs` : calcul et rendu de la fiche.
- `maquette/character-storage.mjs` : contrat de sauvegarde partagé avec le serveur.
- `access/` : accès authentifié, stockage, sauvegarde et déploiement.
- `audit/` et `tests/` : rapports et vérifications. Les anciens noms de fichiers 1–10 sont conservés pour compatibilité ; le rapport 1–20 est la référence du périmètre courant.

## Production

Version active : `/var/www/myrpgtable/refonte-access/20261028T145508Z`.

Service PM2 : `myrpgtable-refonte`. Une sauvegarde complète de MongoDB précède chaque déploiement, avec retour à la version précédente prévu par le script. L’ancienne application reste inaccessible. Les sessions en mémoire peuvent nécessiter une reconnexion après redémarrage ; leur persistance reste à traiter avant une ouverture publique plus large.

Le serveur local se lance avec `node refonte/serve.mjs` (port 4178 par défaut). Le test PC isolé utilise `REFONTE_PREVIEW_PORT=4188`. Pour relire les règles distantes, définir `MYRPGTABLE_SSH` puis exécuter `refonte/read-rules.ps1` ; aucun secret ne doit être exporté dans le projet.

## Suite

Vérifier les personnages de la table, puis compléter les données encore ambiguës de la BDD avec leur source. Le DD psionique, les disciplines élémentaires et six noms de sorts restent explicitement signalés dans l’[audit des douze classes](audit/TOUTES-CLASSES.md). Le téléphone reste hors périmètre. L’historique est conservé dans [HISTORIQUE.md](HISTORIQUE.md).

## Contrôles des origines et des dons

Les corrections et la couverture des espèces, historiques et dons sont détaillées dans [ORIGINES-DONS.md](audit/ORIGINES-DONS.md). L’extension est déployée : 7 200 scénarios d’origine, 780 contrôles de dons, 332 combinaisons légales de don humain/historique/taille, les styles de combat et les répartitions de bonus sont vérifiés. Les nouveaux choix du goliath et du tieffelin sont conservés à la sauvegarde ; PV et formations naines, liens de sorts, résistances et interactions de dons sont corrigés. Deux sorts du gnome restent non identifiés, en plus des six noms de sorts de classes déjà signalés.

## Couverture navigateur uniforme — terminée

Les 48 sous-classes sont couvertes à chaque niveau de 1 à 20. Les 652 paliers manquants ont réussi ; les 442 parcours et 2 360 tests de règles déjà réussis ont été conservés sans relance, sur une application et un catalogue identiques. Le clerc est exclu de cette exécution complémentaire, mais reste dans la suite de régression. Les deux preuves sont distinguées dans le rapport. Cette étape n’a modifié que les tests, leur configuration et la documentation ; la version en ligne reste 20261028T145508Z.
