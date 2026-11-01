# Compteur des inscriptions — correctif du 1er novembre 2026

Correctif publié le 1er novembre 2026, livraison `20261101T141134Z`. La clé serveur renseignée dans l’environnement privé du VPS est fonctionnelle ; aucune valeur de clé n’est enregistrée dans le dépôt.

## Correction

L’ancien compteur utilisait les profils MongoDB alimentés à la connexion. Une inscription jamais connectée pouvait donc manquer. Le compteur corrigé interroge Supabase Auth côté serveur, parcourt toutes les pages, déduplique les identités et exclut les utilisateurs anonymes et les comptes supprimés. Les inscriptions en attente de confirmation restent comptées. Le plafond de 500 destinataires affichés ne tronque pas le compteur global.

Le même annuaire permet de proposer un compte inscrit qui n’a jamais ouvert l’atelier. L’attribution vérifie l’identité destinataire dans Supabase avant d’écrire la copie ou le transfert. Les profils MongoDB historiques restent conservés ; aucune migration ni modification des personnages n’est nécessaire.

La page s’actualise toutes les 30 secondes lorsqu’elle est visible, au retour sur la fenêtre et avec le bouton **Actualiser**. Les choix de fiche, destinataire et action sont conservés. Les requêtes ne sont pas mises en cache et une actualisation en cours n’est pas doublée. Quitter l’administration arrête le rafraîchissement.

Si la source des inscriptions est indisponible, le total affiche un tiret et un message explicite, sans faux zéro ni ancien total présenté comme actuel. Les autres métriques restent consultables. L’annuaire peut afficher les profils déjà connus avec un avertissement ; une attribution attend le retour de la source officielle. Une erreur réseau de rafraîchissement conserve les valeurs précédentes avec leur date et un message d’échec.

## Configuration et validation

La connexion des joueurs utilise la clé publique et la validation des jetons par Supabase ; elle reste inchangée. Lister tous les inscrits nécessite une clé serveur autorisée : `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`. Cette clé est lue uniquement sur le serveur et n’est jamais livrée à l’atelier, stockée sur Git ou incluse dans les réponses.

- 22 tests ciblés réussis : source réelle des identités, pagination, inscription sans connexion, suppression, destinataire absent de MongoDB, privilèges et erreurs.
- Huit parcours navigateur réussis : nouvelle inscription et mise à jour du compteur, actualisation automatique, conservation du formulaire, arrêt des requêtes après navigation, indisponibilité, administration, attribution et PDF.
- Publication : contrôle réel en lecture seule réussi avant et après bascule (deux comptes, administrateur présent et confirmé). Le projet Supabase et la clé publique de connexion sont identiques à ceux de la livraison précédente.
- Sauvegarde de 3 280 documents ; 22 parcours de persistance sur des fiches de test avant puis après bascule et quinze accès HTTP réussis. Les personnages réels restent identiques, dont les deux fiches Youpi matin au niveau 3, révision 2.
- Sauvegarde et retour arrière : `/root/backups/myrpgtable-persistence-20261101T141134Z/`. [Relevé de publication](../audit/deployment-admin-accounts-20261101-result.json). Aucune inscription réelle ni connexion interactive n’a été créée pour ces contrôles.

Preuve locale : `audit/verify-admin-accounts.mjs`. Contrôle réel : `audit/check-admin-accounts.mjs`.

Référence : [Supabase, liste des utilisateurs côté serveur](https://supabase.com/docs/reference/javascript/auth-admin-listusers).
