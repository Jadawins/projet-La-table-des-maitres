# Vérification automatique sur ordinateur

Exécution complète du 28 octobre 2026, terminée à 09 h 08 (Europe/Paris). Version déployée : 20261028T074925Z.

- 531 tests de calcul, validation et sauvegarde réussis.
- 244 parcours Chromium réussis : 160 clercs, 80 personnages des quatre nouvelles classes et quatre régressions.
- 0 échec, 0 test ignoré et 0 résultat instable.
- Durée du navigateur : 18,7 minutes, quatre exécutants locaux.
- Empreinte des sources testées : `8fecadc5b2c26e11f1813156ccd8c27b7a515d482441b84850c697e8cc39f3b4`.
- Empreinte SHA-256 de l’archive transférée, vérifiée sur le VPS : `4b60048bdd14b112ddfaf9a1636a9da4d53485b5399f6d9be40fac8bae77d208`.

## Couverture

Le clerc conserve quatre domaines × vingt niveaux × deux vocations dans le navigateur. Pour le barbare, le rôdeur, le barde et le druide, les tests de calcul et sauvegarde couvrent les 320 combinaisons classe/sous-classe/niveau. Les parcours navigateur couvrent les seize nouvelles sous-classes aux niveaux 1, 3, 6, 10 et 20.

Les personnages sont remplis par les formulaires, contrôlés sur la fiche, enregistrés, ouverts depuis la liste, actualisés puis rouverts sans brouillon local. Les PV et les DD/attaques de sorts sont comparés à des calculs attendus distincts du modèle. Les régressions vérifient les choix vides, l’absence de jets automatiques, les modifications sans doublon, une coupure réseau suivie d’une nouvelle tentative et l’isolation entre comptes.

## Vérification du serveur

Le paquet a été créé uniquement après la réussite des deux suites et la vérification que leurs sources n’avaient pas changé. Une sauvegarde complète de 3270 documents MongoDB a précédé l’activation. Les seize nouvelles sous-classes niveau 20 ont été sauvegardées et relues sur MongoDB, dans une collection temporaire nettoyée ensuite. Les anciens contrôles du clerc, des dons, des révisions et de l’isolation passent également.

Youpi matin : niveau 3, révision 1 avant et après déploiement. Aucun personnage existant n’est migré automatiquement. Les contrôles HTTP confirment l’accueil et la connexion accessibles, l’atelier protégé et les anciennes routes bloquées.

## Limites et preuves

Les identités Supabase et l’adaptateur MongoDB sont simulés pour les parcours locaux ; les modules d’accès, de validation et de stockage sont ceux du projet. Le contrôle MongoDB réel est séparé. Cette suite ne valide pas un fournisseur OAuth externe ni la conformité documentaire de toutes les règles 2024. La BDD actuelle reste la référence, avec les seuls compléments ciblés documentés.

Rapport interactif : `refonte/e2e/playwright-report/index.html`. Résultats et preuve d’exécution : `refonte/e2e/test-results/`. Ces fichiers sont exclus de Git et régénérés à chaque exécution. Les instructions sont dans [e2e/README.md](../e2e/README.md). Le workflow GitHub prendra effet après envoi des changements au dépôt.
