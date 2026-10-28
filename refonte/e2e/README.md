# Tests automatiques de parcours

Cette suite pilote Chromium et utilise les pages, le serveur d’accès, la validation et le service de personnages du projet. Elle crée et remplit les personnages par les formulaires ; elle n’injecte pas de fiche prédéfinie dans le navigateur.

## Installation

Prérequis : Node.js 22.13 ou supérieur et pnpm 11.25.0.

Depuis la racine du projet :

```sh
pnpm --dir refonte/e2e install --frozen-lockfile
pnpm --dir refonte/e2e exec playwright install chromium
```

Sur un agent Linux neuf, utiliser `playwright install --with-deps chromium`.

## Commandes

```sh
# Les 244 parcours navigateur
pnpm --dir refonte/e2e test

# Contrôles rapides, dont les seize nouvelles sous-classes niveau 20
pnpm --dir refonte/e2e test:quick

# Vérification complète : 531 tests de règles puis les parcours navigateur
node refonte/e2e/verify.mjs

# Consulter le rapport interactif de la dernière exécution
pnpm --dir refonte/e2e report
```

Les comptes de test sont créés uniquement dans le serveur local de test. Aucun identifiant réel n’est requis. Ne pas ajouter de secret dans ces fichiers.

## Couverture

- 160 créations : quatre domaines de clerc × vingt niveaux × deux vocations.
- 80 créations : barbare, rôdeur, barde et druide × quatre sous-classes × niveaux 1, 3, 6, 10 et 20. Les 320 combinaisons de ces classes, sous-classes et vingt niveaux sont vérifiées par les tests de calcul et sauvegarde.
- Identité, origines, résultats physiques, bonus, améliorations, faveur, compétences, sorts et équipement saisis par l’interface.
- Contrôle des valeurs affichées avec un calcul attendu indépendant, des paliers et de l’absence de choix incomplets.
- Enregistrement, liste du compte, reprise après actualisation et ouverture dans un contexte de navigateur neuf sans brouillon local.
- Quatre régressions : choix obligatoires et absence de jets automatiques ; faveur avec résistances et modification d’histoire sans doublon ; erreur réseau puis nouvelle tentative ; isolation entre deux comptes.

Les identités Supabase et l’adaptateur de collection MongoDB sont simulés localement ; les vraies routes, les cookies, la vérification du propriétaire, les révisions et le contrat de sauvegarde sont utilisés. Le contrôle MongoDB réel reste séparé dans `access/check-persistence.mjs`, exécuté sur le serveur avant la bascule de production. Ces tests n’attestent pas le fonctionnement d’un fournisseur OAuth externe.

## Rapports et isolation

Le serveur écoute exclusivement sur `127.0.0.1:4199`. Un service déjà présent sur ce port provoque un échec : les tests ne se rabattent pas sur un site existant. Les données et copies statiques de chaque exécution sont dans `.runtime/`, les captures et traces d’échec dans `test-results/`, et le rapport interactif dans `playwright-report/`. Ces dossiers sont exclus de Git et du paquet de production.

Le test ne lit ni fichier `.env` de production ni clé SSH. Le serveur simulé n’est jamais copié par le script de préparation du déploiement. Les versions des dépendances sont verrouillées par `pnpm-lock.yaml`.

## Avant déploiement

`access/package.mjs` appelle obligatoirement `verify.mjs` avant de créer le dossier du paquet. Un test en échec, un parcours navigateur ignoré ou marqué seul, ou une modification des sources pendant la vérification bloque la préparation. La vérification réussie produit `test-results/verification.json` avec l’empreinte des sources, la date et le nombre de parcours.

Le workflow GitHub `refonte-tests.yml` prépare les dépendances, exécute les deux suites et conserve les rapports pendant quatorze jours. Le workflow de déploiement attend sa réussite. Ces contrôles GitHub s’activeront après l’envoi des fichiers dans le dépôt ; leur configuration locale ne constitue pas une exécution sur GitHub.
