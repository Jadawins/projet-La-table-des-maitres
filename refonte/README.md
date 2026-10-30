# La Table du Maître — état actuel

Mise à jour : 30 octobre 2026.

La refonte couvre la création et la fiche sur ordinateur : douze classes, 48 sous-classes, niveaux1–20, espèces, historiques, dons, sorts et équipement. Le téléphone, le multiclasse, les nouveaux livres et la gestion du combat restent hors périmètre. Les dés physiques sont conservés et aucun lancer ne se déclenche automatiquement.

## Version locale stabilisée

Référence fixe : PHB2024 et errata officiels disponibles au28 octobre2026, identifiant phb2024-2026-10-28. Les conditions de gel sont dans [REGLES-FIGEES.md](REGLES-FIGEES.md).

Les comparaisons et corrections regroupées sont préparées : classes/sous-classes, manifestations, profils, dons, sorts, armes, armures, outils et compétences. Le registre contient814 entrées documentaires ; cinq variantes héritées sans référence restent explicitement exclues de la création. Un alias de sort est conservé en archive pour éviter deux choix du même sort. Les données Mongo sources restent récupérables et ne sont pas réécrites par la construction du catalogue.

Les fiches nouvelles portent une version de règles. Une ancienne fiche ne se recalcule pas silencieusement : sa mise à niveau passe par une copie volontaire avec un nouvel identifiant. Le serveur refuse de remplacer l’original par une autre version de règles.

Les preuves finales couvrent 3 948 tests unitaires distincts et 1 298 parcours navigateur. Une dernière campagne complète avant publication a réussi sans échec ni test ignoré. Le registre compte 809 entrées vérifiées et cinq exclusions documentées. Le gel effectif, les empreintes et l'archive sont consignés dans le manifeste final ; la publication est documentée séparément dans audit/deployment-20261029-result.json.

- [Suivi local des résultats réels](http://127.0.0.1:9335/rules-progress.html)
- [Registre des règles](audit/rules-2024-ledger.json)
- [Journal des valeurs avant/après](data/rules-2024-corrections.json)
- [Point de reprise](audit/POINT-DE-REPRISE.md)
- [État détaillé de la stabilisation](audit/STABILISATION-2024.md)
- [Bilan final et réserves](audit/BILAN-FINAL-2024.md)
- [Provenance des descriptions](audit/DESCRIPTIONS-PROVENANCE.md) et [classement SRD des 48 sous-classes](audit/SOUS-CLASSES-SRD.md) : 12 présentes dans le SRD 5.2.1, 36 absentes. Ce contrôle ne vaut pas validation des droits sur les textes hors SRD. Le [classement des sorts](audit/SORTS-SRD.md) confirme 339 sorts SRD et 51 hors SRD ; les 110 champs des 51 sont examinés. Six retouches éditoriales sont préparées et non appliquées.
- [Manifeste du gel](audit/final-freeze-manifest.json)

## Production

L’atelier en ligne utilise la livraison `20261030T131634Z`, publiée le 30 octobre 2026. Les règles corrigées sont dans MongoDB, collection `regles_catalogues`, version `phb2024-2026-10-28`. Le serveur les charge et vérifie leur empreinte au démarrage ; aucun catalogue JSON n'est livré sur disque. Les comptes et personnages existants sont conservés. Voir [le fonctionnement MongoDB](access/REGLES-MONGODB.md).

La livraison `20261030T131634Z` ajoute sur l’accueil public et celui de l’atelier un encadré « Un complément à vos livres » : l’application accompagne les parties, ne remplace pas les livres et recommande d’acheter les ouvrages officiels pour soutenir leurs créateurs. Le même texte est contrôlé sur les deux pages ; trois tests ciblés et trois parcours navigateur passent. Les contrôles MongoDB avant/après réussissent et les personnages restent inchangés. Sauvegarde de 3 275 documents et retour arrière dans `/root/backups/myrpgtable-persistence-20261030T131634Z/`. Cette mention d’accueil ne constitue pas une autorisation de réutilisation des textes hors SRD.

La livraison `20261030T130341Z` ajoute l’attribution officielle du SRD 5.2.1 au Grimoire et une page publique [Sources et licences](https://myrpgtable.fr/sources.html), avec les liens de licence et l’indication des adaptations. L’attribution SRD 5.1 est conservée. Les trois tests ciblés, trois parcours navigateur et contrôles visuels de la page publique et des vues du Grimoire passent ; les 637 entrées conservent leur attribution. Les contrôles MongoDB avant/après réussissent et les personnages restent inchangés ; sauvegarde de 3 275 documents dans `/root/backups/myrpgtable-persistence-20261030T130341Z/`. Le [bilan de provenance des descriptions](audit/DESCRIPTIONS-PROVENANCE.md) inventorie les champs et signale les cas à examiner ; il ne vaut pas validation des droits sur les textes hors SRD. Aucune description ni règle du catalogue n’est modifiée dans ce lot.

La livraison `20261030T120610Z` présente le grimoire comme des fiches de lecture : repères compacts, description visible, composantes résumées, progression des classes à déplier par niveau, effets des dons et traits d’espèce structurés. Les précisions restent accessibles sans encombrer la lecture principale. Les données et règles ne sont pas modifiées. Les 637 entrées sont rendues sans erreur ; trois tests ciblés et trois parcours navigateur passent, avec contrôle visuel de quatre catégories. Contrôles MongoDB avant/après réussis et personnages inchangés ; sauvegarde de 3 275 documents dans `/root/backups/myrpgtable-persistence-20261030T120610Z/`.

La livraison `20261030T115700Z` restaure le fond bibliothèque existant sur les pages publiques et dans l’atelier, avec un voile sombre pour garder les textes lisibles. Le favicon existant est déclaré dans les pages ; `/favicon.ico` redirige vers `/favicon.png`, servi publiquement, ce qui supprime les erreurs 503 de l’icône. Les quatre vues (accueil, connexion, inscription, atelier) ont été contrôlées visuellement, ainsi que les deux images et la redirection ; aucune erreur JavaScript sur ces parcours. Les contrôles MongoDB avant/après préservent les personnages. Sauvegarde de 3 275 documents et retour arrière dans `/root/backups/myrpgtable-persistence-20261030T115700Z/`.

L’inscription est accessible depuis l’accueil public et la connexion, sur `/inscription.html` (ancienne URL `/signup.html` redirigée). Elle propose pseudo, e-mail, mot de passe et confirmation, puis validation de l’adresse par e-mail ; Google et Discord restent disponibles. Aucune session n’est ouverte avant confirmation et les nouveaux comptes n’obtiennent aucun droit administrateur. Les 27 tests ciblés et 11 parcours navigateur passent avec un fournisseur et une boîte mail simulés ; la réception réelle du mail reste à vérifier à la première inscription. Huit contrôles MongoDB et les essais d’attribution ont réussi avant/après déploiement sans modifier les personnages existants. Sauvegarde de 3 274 documents et retour arrière dans `/root/backups/myrpgtable-persistence-20261030T090515Z/`. Voir [le parcours d’inscription](access/INSCRIPTION.md).

L’accueil est distinct de Mes personnages, avec le mot du créateur adressé à « vos aventures » et « vos personnages ». Le Grimoire recherche dans le catalogue MongoDB. Le bouton de fiche remplit le PDF fourni, conservé modifiable, sans les longues descriptions ; des pages identiques supplémentaires accueillent les sorts qui dépassent le formulaire. L’administration donne des métriques et permet une copie ou un transfert confirmé vers un compte existant. Ses droits reposent sur une adresse confirmée par Supabase et configurée sur le serveur. Voir [accueil, grimoire, administration et PDF](access/ACCUEIL-GRIMOIRE-ADMIN-PDF.md).

La livraison initiale `20261030T074820Z` avait passé 3 981 tests unitaires, 24 parcours navigateur et les contrôles de formulaire PDF. Huit contrôles de personnages et les essais d’attribution MongoDB ont réussi avant/après bascule dans des collections de test ; les personnages existants sont inchangés. La sauvegarde de 3 272 documents, la livraison précédente et le retour arrière sont dans `/root/backups/myrpgtable-persistence-20261030T074820Z/`.

Le correctif `20261030T084500Z` réduit la police des lignes d’armes du PDF à 8 points maximum avec ajustement jusqu’à 6 points. Les noms sont sur une ligne pour éviter les problèmes de hauteur dans les lecteurs PDF. Les propriétés structurées affichent notamment la portée de lancer au lieu de « [object Object] ». Quatre tests PDF et trois parcours de téléchargement passent ; le rendu du barbare a été contrôlé visuellement. Sauvegarde de 3 274 documents et retour arrière dans `/root/backups/myrpgtable-persistence-20261030T084500Z/` ; personnages existants inchangés après les contrôles MongoDB.

Depuis la livraison précédente, chaque personnage enregistré et chaque brouillon local disposent d'un bouton Supprimer avec confirmation. Les contrôles d'appartenance, de révision et le refus des sauvegardes d'anciens onglets évitent la suppression d'une autre fiche ou sa réapparition. Voir [la suppression des personnages](access/SUPPRESSION-PERSONNAGES.md). La livraison `20261030T064920Z` avait passé 41 tests ciblés, neuf parcours navigateur et huit contrôles MongoDB avant/après bascule, uniquement sur des personnages de test. La sauvegarde de 3 272 documents et le retour arrière sont dans `/root/backups/myrpgtable-persistence-20261030T064920Z/`.

La sauvegarde avant import de 3 270 documents, la livraison précédente et le retour arrière sont dans `/root/backups/myrpgtable-persistence-20261029T190451Z/`. L'import est idempotent et conserve le catalogue validé à l'identique. Les 81 contrôles ciblés et huit parcours navigateur de la transition ont réussi, ainsi que les contrôles de sauvegarde/réouverture sur MongoDB avant/après bascule pour barbare, rôdeur, barde et druide, niveaux 3 et 20. Le redémarrage demande une reconnexion ; les sessions en mémoire restent un chantier distinct avant une ouverture publique plus large.

## Organisation et vérifications

Les règles applicatives, le modèle de fiche, son rendu et le contrat de sauvegarde sont séparés dans maquette/. La production charge son catalogue dans MongoDB. Les outils d'audit et tests peuvent reconstruire les corrections sur la référence de régression de tests/fixtures/, indépendamment du serveur. Les profils et comparaisons sont dans audit/ ; le journal versionné est dans data/.

Commande de vérification complète : node refonte/e2e/verify.mjs. Le navigateur utilise des comptes et un stockage isolés, sans VPS ni personnages réels. La publication est bloquée tant que les conditions de gel ne sont pas remplies.

Les rapports précédents restent disponibles dans [E2E-PC.md](audit/E2E-PC.md), [HISTORIQUE.md](HISTORIQUE.md) et l’[ancien état détaillé](audit/README-AVANT-STABILISATION-20261029.md). Leurs nombres de tests appartiennent à leurs versions respectives.
