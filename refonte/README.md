# La Table du Maître — état actuel

Mise à jour : 29 octobre 2026.

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
- [Manifeste du gel](audit/final-freeze-manifest.json)

## Production

L’atelier en ligne utilise la livraison `20261029T190451Z`, publiée le 29 octobre 2026. Les règles corrigées sont maintenant dans MongoDB, collection `regles_catalogues`, version `phb2024-2026-10-28`. Le serveur les charge et vérifie leur empreinte au démarrage ; aucun catalogue JSON n'est livré sur disque. Les comptes et personnages existants sont conservés ; le contrôle avant/après confirme notamment Youpi matin niveau 3, révision 1. Voir [le fonctionnement MongoDB](access/REGLES-MONGODB.md).

La sauvegarde avant import de 3 270 documents, la livraison précédente et le retour arrière sont dans `/root/backups/myrpgtable-persistence-20261029T190451Z/`. L'import est idempotent et conserve le catalogue validé à l'identique. Les 81 contrôles ciblés et huit parcours navigateur de la transition ont réussi, ainsi que les contrôles de sauvegarde/réouverture sur MongoDB avant/après bascule pour barbare, rôdeur, barde et druide, niveaux 3 et 20. Le redémarrage demande une reconnexion ; les sessions en mémoire restent un chantier distinct avant une ouverture publique plus large.

## Organisation et vérifications

Les règles applicatives, le modèle de fiche, son rendu et le contrat de sauvegarde sont séparés dans maquette/. La production charge son catalogue dans MongoDB. Les outils d'audit et tests peuvent reconstruire les corrections sur la référence de régression de tests/fixtures/, indépendamment du serveur. Les profils et comparaisons sont dans audit/ ; le journal versionné est dans data/.

Commande de vérification complète : node refonte/e2e/verify.mjs. Le navigateur utilise des comptes et un stockage isolés, sans VPS ni personnages réels. La publication est bloquée tant que les conditions de gel ne sont pas remplies.

Les rapports précédents restent disponibles dans [E2E-PC.md](audit/E2E-PC.md), [HISTORIQUE.md](HISTORIQUE.md) et l’[ancien état détaillé](audit/README-AVANT-STABILISATION-20261029.md). Leurs nombres de tests appartiennent à leurs versions respectives.
