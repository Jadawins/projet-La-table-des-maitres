# Connexion et atelier de refonte

**État actuel :** sauvegarde active dans `personnages_refonte`, clerc PC 1–10 et quatre domaines intégrés. Livraison `/var/www/myrpgtable/refonte-access/20261027T150406Z`. Les sections plus anciennes décrivent les étapes précédentes.

L’extension 1–10 ajoute `cleric-progression.mjs`, les choix `advancements` des niveaux 4/8 et `sacredStrike`, ainsi que les emplacements de dons `originGrants.level4/level8`. Le navigateur et le serveur utilisent les mêmes contrôles ; les champs absents des anciennes fiches sont normalisés sans écrire de migration en BDD. Les comparaisons de brouillon ignorent le simple changement d’étape et normalisent les anciens snapshots, pour éviter un faux bandeau « En cours ».

Cette livraison a été précédée d’une sauvegarde EJSON compressée de 3 267 documents et des index, dans `/root/backups/myrpgtable-persistence-20261027T150406Z/`. Le contrôle réel a sauvegardé/relu les quatre domaines au niveau 10, avec leurs améliorations et Frappe consacrée, dans `refonte_controles` ; seul son document temporaire a ensuite été supprimé. 125 tests passent. Les noms de sorts absents du catalogue restent signalés ; certains paramètres et effets de dons sont décrits plutôt qu’automatisés. Le périmètre utilisateur est désormais PC uniquement.

La configuration Nginx antérieure est conservée dans ce dossier de sauvegarde. Pour revenir au service précédent, son script est `/var/www/myrpgtable/refonte-access/20261027T141513Z/start.mjs` ; utiliser son dossier comme cwd, le même fichier d’environnement, vérifier Nginx puis recharger et sauvegarder PM2. Conserver tous les personnages en BDD. La procédure initiale plus bas n’est pas une commande de mise à jour à réexécuter aveuglément.

## Enregistrer et retrouver un personnage — 27 octobre 2026

Un bouton « Enregistrer le personnage » est disponible dans le résumé de création, dans le récapitulatif et sur la fiche. Après une première sauvegarde, il devient « Enregistrer les modifications ». Les indicateurs distinguent le brouillon sur l’appareil, les changements locaux et la version enregistrée dans le compte. Les fiches incomplètes peuvent être conservées en ligne avec un statut distinct ; l’enregistrement ne prétend pas valider un parcours non implémenté.

« Mes personnages » affiche les vraies fiches du compte, avec leur niveau, leur classe et leur date d’enregistrement. Les exemples fictifs restent uniquement dans la maquette locale. La réouverture relit le personnage depuis MongoDB. Les brouillons locaux sont aussi gardés dans un index séparé ; commencer un autre personnage ne supprime plus le brouillon précédent. Si une version distante est ouverte alors qu’il existe des modifications locales différentes, une copie locale est conservée.

L’API privée `/atelier/api/personnages` exige la session vérifiée existante. GET liste les personnages du compte ; GET `/:id` relit une fiche ; PUT `/:id` crée ou met à jour un personnage. Le propriétaire est fourni exclusivement par la session serveur. Identifiants et types sont contrôlés, et seuls les champs de création autorisés sont conservés : les valeurs dérivées envoyées par le navigateur ne font pas autorité. Une version empêche l’écrasement silencieux de modifications faites ailleurs. Un identifiant client stable et un index unique `(user_id, client_id)` évitent les doublons après une répétition de requête.

Le service utilise le pilote MongoDB déjà installé dans l’ancienne application, sans modification de cette dernière. Les personnages de la refonte sont isolés des anciennes collections `personnages` et `characters`. Chaque sauvegarde conserve l’empreinte du catalogue utilisé.

Avant activation : sauvegarde complète de 3 266 documents de la BDD, avec métadonnées des collections et index, en EJSON compressé, sur le serveur uniquement. Archive `/root/backups/myrpgtable-persistence-20261027T141513Z/database.ejsonl.gz`, intégrité gzip vérifiée, dossier 700 et fichier 600. L’archive contient des données privées et ne doit pas être publiée. `backup-db.mjs` en précise le format par lignes.

Validation : 74 tests passent, couvrant notamment les comptes distincts, les répétitions, les conflits, la conservation des choix et des notes, la validation et les statuts d’affichage. Un contrôle MongoDB réel a créé, relu et mis à jour un document temporaire, puis supprimé uniquement ce document, dans la collection dédiée `refonte_controles`. Aucun personnage existant ni règle n’a été modifié par ce contrôle. Les statuts publics 200, atelier protégé 302 et API privée sans session 401 sont vérifiés après publication. Les anciens chemins d’API et de création restent fermés.

Le redémarrage de l’authentification nécessite une reconnexion, sans effacement des brouillons du navigateur. Sauvegarde de configuration avant bascule : `/root/backups/myrpgtable-persistence-20261027T141513Z/nginx.previous.conf`. `deploy-persistence.sh` décrit les contrôles et le retour automatique à la livraison précédente en cas d’échec ; un retour arrière du code ne doit jamais supprimer la nouvelle collection.

Pour un retour manuel au code précédent, remettre cette configuration, redémarrer PM2 sur `/var/www/myrpgtable/refonte-access/20261027T132811Z/start.mjs` avec son dossier courant et le même fichier d’environnement, puis vérifier Nginx et recharger. Conserver tous les documents de `personnages_refonte` même si l’ancienne interface ne les affiche pas.

Publié le 27 octobre 2026 après clarification de l’utilisateur : garder l’accueil public de refonte, permettre la connexion avec le compte existant et accéder au nouveau créateur sans rouvrir l’ancienne application.

## Production

- Source déployée : `/var/www/myrpgtable/refonte-access/20261027T132811Z`.
- Accueil statique : sous-dossier `public/`.
- Nouveau créateur : `/atelier/`, servi uniquement après contrôle de session, y compris pour ses scripts et son catalogue.
- Connexion : `/connexion.html` ; `/login.html` redirige vers cette page.
- Ancienne URL OAuth `/home.html` conservée comme redirection vers la nouvelle connexion, avec les paramètres du retour.
- Service local : PM2 `myrpgtable-refonte`, `start.mjs`, `127.0.0.1:4181`. Le fichier d’environnement existant est lu au démarrage ; aucun secret n’est embarqué dans les sources ou dans le paquet de publication.
- Sauvegarde Nginx avant activation : `/root/backups/myrpgtable-access-20261027T132811Z/nginx.previous.conf` (retour à l’accueil de maintenance sans connexion).
- L’ancienne application, son API, MongoDB et Supabase ne sont pas modifiés. Les anciens chemins de création, API et uploads restent fermés publiquement.

## Connexion

Les comptes existants sont vérifiés par Supabase. E-mail/mot de passe et fournisseurs Google/Discord (activés dans la configuration Supabase vérifiée) sont proposés. OAuth utilise PKCE avec un vérificateur conservé côté serveur et lié au navigateur par cookie ; un code de retour ne peut être utilisé qu’une fois. Référence du protocole : https://supabase.com/docs/guides/auth/sessions/pkce-flow.

Chaque session n’est créée qu’après validation du jeton auprès de Supabase. Aucun repli par simple décodage. Le navigateur reçoit un identifiant aléatoire dans un cookie Secure, HttpOnly, SameSite=Lax. Les jetons restent en mémoire serveur. Les opérations POST vérifient l’origine ; les tentatives de connexion sont limitées. Durée maximale de session : huit heures, avec renouvellement du jeton si nécessaire. Un redémarrage du service demande de se reconnecter.

La déconnexion invalide la session serveur. Les brouillons locaux sont séparés par identifiant de compte ; ils ne sont pas encore sauvegardés en ligne. Les brouillons de localhost restent sur localhost, sans migration automatique vers le domaine public.

## Vérifications

`node --test refonte/tests/access.test.mjs` couvre l’absence de session, les cookies inventés, le refus de jetons par Supabase, la panne du service de validation, les origines interdites, la déconnexion, PKCE et les fichiers hors liste autorisée. Les scénarios authentifiés utilisent un service d’authentification simulé, sans créer de compte réel ni récupérer d’identifiants utilisateur.

En production : accueil et connexion HTTP 200 ; atelier et catalogue sans connexion redirigés vers la connexion ; statut sans session HTTP 401 ; anciens API/créateur HTTP 503. Configuration Supabase accessible et trois méthodes de connexion activées. Bouton d’accueil et formulaire vérifiés visuellement. La connexion de bout en bout avec le compte humain reste à faire par l’utilisateur dans le navigateur.

## Retour à l’accueil seul

```sh
cp -a /root/backups/myrpgtable-access-20261027T132811Z/nginx.previous.conf /etc/nginx/sites-enabled/myrpgtable.fr
nginx -t && systemctl reload nginx
pm2 stop myrpgtable-refonte
pm2 save
```

Pour rouvrir l’ancienne application, utiliser la sauvegarde antérieure documentée dans `../accueil/DEPLOIEMENT.md`, uniquement si cette réouverture est souhaitée.

## Actualiser le créateur

### Fiche à onglets — 27 octobre 2026

La fiche utilise six onglets : Vue d’ensemble, Combat, Aptitudes, Sorts, Équipement, Histoire. PV, CA et initiative restent au-dessus de la navigation. Les panneaux inactifs restent dans le document et sont affichés à l’impression ; changer d’onglet ne détruit pas les champs du personnage. Navigation au clavier par flèches, Début et Fin. Sur téléphone, les onglets tiennent sur deux rangées.

Les trois fichiers `atelier/app.js`, `atelier/sheet-view.mjs` et `atelier/style.css` ont été actualisés sans redémarrage du service, donc sans suppression des sessions en mémoire. Leurs empreintes de livraison ont été vérifiées après copie. Sauvegarde précédente : `/root/backups/myrpgtable-sheet-tabs-20261027T134402Z/`. `update-sheet-ui.sh` conserve cette procédure ciblée ; il vérifie la livraison active et refuse d’écraser une sauvegarde existante. Les autres fichiers, les règles et les brouillons ne sont pas modifiés.

Onze tests de fiche passent, dont le regroupement en six rubriques et la conservation de l’histoire et des informations sous les panneaux masqués. Navigation souris/clavier et format 390 px vérifiés dans l’aperçu local. Le contrôle d’accès sans session reste actif en production.

`package.mjs` prépare un paquet explicite de fichiers publics et privés depuis les sources locales ; `deploy.sh` décrit l’installation initiale. Pour une mise à jour du service déjà présent, préparer une nouvelle livraison, sauvegarder la configuration active, mettre à jour le chemin PM2 puis vérifier avant bascule. Ne pas exécuter aveuglément le déploiement initial : il refuse volontairement d’écraser un service existant. Les sessions en mémoire sont perdues lors d’un redémarrage.
