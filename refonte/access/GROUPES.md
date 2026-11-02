# Groupes de jeu — premier module MJ

Un compte choisit son rôle, Maître du jeu ou Joueur, en créant ou rejoignant une table. Aucun droit d’administration du site n’est nécessaire. Le menu **Mes groupes** rassemble les deux rôles, affichés pour chaque groupe. Un groupe représente une table persistante ; les séances datées, la préparation de campagne et les combats seront des modules suivants.

## Parcours

Le créateur renseigne un nom, son nom à la table et une présentation facultative. Il reçoit un code qu’il partage lui-même : aucun e-mail ni message n’est envoyé automatiquement. Le joueur connecté saisit ce code et son nom à la table dans **Rejoindre un groupe**.

Le créateur gère deux invitations distinctes : une pour les joueurs et une pour les MJ. Le rôle choisi lors de l’adhésion doit correspondre au code utilisé. Un code joueur ne donne jamais les commandes MJ. Les codes comportent 16 caractères hexadécimaux aléatoires et expirent après sept jours. La base conserve leur empreinte, jamais le code brut. Le code est affiché uniquement lors de sa création. Le créateur peut renouveler ou fermer chaque type d’invitation séparément ; cela préserve les membres actuels. Retirer un membre ferme également les invitations, afin que l’ancien code ne lui permette pas de revenir immédiatement. Un groupe est limité à 50 membres ; les tentatives de code et créations répétées sont limitées côté serveur.

Chaque membre peut rattacher une de ses fiches terminées et enregistrées, changer ce choix ou le retirer. Le groupe partage seulement le nom, la classe et le niveau du personnage. Aucun déplacement, copie, changement de propriétaire ou modification des statistiques n’est effectué. Une fiche supprimée, transférée ou redevenue brouillon n’est plus exposée comme disponible. La lecture complète des fiches par le MJ reste un lot suivant.

Le créateur gère les invitations, le retrait des membres et la suppression, même s’il joue comme joueur. Les MJ invités ont les commandes de combat et l’accès au bestiaire privé ; ils ne peuvent pas supprimer le groupe ni gérer ses invitations. Plusieurs MJ peuvent être invités avec le code MJ. Un membre invité peut quitter le groupe. Le créateur ne peut pas se retirer lui-même.

**Supprimer le groupe**, en bas de sa page, demande une confirmation qui nomme le groupe. La suppression le retire des listes de tous ses membres, ferme les deux invitations et l’accès à ses combats, y compris aux propositions de dégâts encore en attente. Les fiches restent dans leurs comptes, avec leurs PV inchangés. Une révision périmée empêche la suppression et demande d’actualiser. Comme pour les personnages, le document est marqué supprimé dans MongoDB plutôt que purgé ; les combats sont conservés en interne mais inaccessibles. Aucune restauration n’est proposée dans l’interface. L’ancien archivage reste compatible via l’API.

Les anciens groupes gardent leur MJ créateur et leurs joueurs sans migration ni écriture automatique. Les anciens codes restent des codes joueur. Les nouveaux formulaires demandent explicitement le rôle ; les appels plus anciens conservent leur comportement par défaut. Un membre déjà inscrit ne peut pas changer son rôle en réutilisant une invitation.

## Adaptation de l’ancien code

Les notions de groupe MJ/joueurs, d’adhésion et de choix d’un personnage reprennent les parcours de `api/Sessions/index.js` et `js/session-detail.js`. L’ancien module n’est pas réactivé : ses identifiants de fiches, sessions par mot de passe et accès ne correspondent pas à l’atelier actuel. Le nouveau stockage est isolé dans `groupes_refonte`.

L’identité vient de la session vérifiée du serveur. La lecture d’un groupe exige d’en être membre ; les commandes de combat vérifient le rôle MJ et la gestion du groupe vérifie son créateur. Un utilisateur extérieur reçoit « Groupe introuvable ». Le choix d’une fiche vérifie son propriétaire dans le stockage actuel. Les écritures vérifient la révision pour éviter les pertes lors d’actions concurrentes. Les notes privées, courriels, données de compte et fiches complètes ne sont pas envoyés aux membres.

## Vérification et publication

Le lot couvre les tests unitaires de stockage et d’accès, quatre parcours navigateur à deux comptes, puis les huit parcours existants d’accueil, grimoire, administration et PDF. Les premiers essais navigateur ont corrigé un démarrage manquant dans le test et un statut d’erreur 403 que le serveur transformait en indisponibilité.

La publication nécessite une preuve courante produite par `audit/verify-groups.mjs`, une sauvegarde et un retour arrière. `audit/check-group-persistence.mjs` vérifie les opérations sur MongoDB dans `refonte_groupes_controles` uniquement ; les fiches réelles ne sont jamais modifiées. Le contrôle existant de persistance et de conservation des personnages reste exécuté avant et après bascule.

Publié le 1er novembre 2026, livraison `20261101T143701Z`. Les 48 tests ciblés et douze parcours navigateur réussissent sans échec ni test ignoré. Huit contrôles MongoDB des groupes et 22 parcours de persistance des personnages réussissent avant puis après bascule ; les cinq documents de personnages réels restent identiques, dont Youpi matin au niveau 3, révision 2. Les dix-sept accès HTTP attendus sont vérifiés et le compteur Supabase reste fonctionnel (deux comptes au déploiement). Sauvegarde de 3 280 documents et retour arrière dans `/root/backups/myrpgtable-persistence-20261101T143701Z/`. [Relevé de publication](../audit/groups-publication-20261101.json). Aucune connexion interactive en production n’est simulée avec un compte réel.

## Suppression et choix du rôle — 2 novembre 2026

92 tests ciblés et 23 parcours navigateur passent, dont la suppression avec annulation/confirmation et conservation de fiche, ainsi que la création comme joueur et l’adhésion d’un MJ invité. Le contrôle MongoDB isolé compare aussi les groupes, combats, personnages et profils réels. Le catalogue figé et l’authentification restent inchangés. Publication et résultats : [relevé](../audit/group-options-publication-20261102.json).
