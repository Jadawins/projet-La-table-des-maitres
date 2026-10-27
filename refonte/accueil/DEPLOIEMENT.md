# Accueil de refonte en production

**Mise à jour :** l’accès connecté à la refonte a ensuite été ajouté. La configuration active et les nouveaux chemins sont documentés dans `../access/README.md`. Les informations ci-dessous décrivent la première mise en maintenance et son retour arrière.

Publié le 27 octobre 2026 sur https://myrpgtable.fr/ à la demande de l’utilisateur : conserver l’existant mais le rendre inaccessible publiquement, avec une page d’accueil annonçant la refonte et ses étapes.

## Emplacements

- Accueil actif : `/var/www/myrpgtable/maintenance/20261027T131706Z`.
- Configuration active : `/etc/nginx/sites-enabled/myrpgtable.fr` (fichier ordinaire, distinct de celui de sites-available).
- Configuration précédente et preuves de vérification : `/root/backups/myrpgtable-accueil-20261027T131706Z`.
- Ancien site conservé sans déplacement ni modification : `/var/www/myrpgtable/app`.
- API conservée : `/var/www/myrpgtable/api-server`. Aucun arrêt de processus, aucune écriture MongoDB, aucune modification de Supabase.

Seuls `/`, `/index.html`, `/refonte.css`, `/refonte.js` et `/service-worker.js` sont servis. Tout autre chemin renvoie l’accueil avec un statut 503. L’accès public à l’API et aux uploads est donc fermé. Les redirections HTTP → HTTPS et www → domaine principal restent actives. Le webhook `/api/deploy` est également fermé : ne pas supposer qu’un push Git publie pendant cette phase. La page de refonte est indépendante du dépôt de l’ancienne application.

Le service worker de transition retire le cache nommé `myrpgtable-*` et son enregistrement. Il ne modifie pas localStorage, les personnages ou les sessions. Un navigateur ayant déjà l’ancienne page en mémoire peut demander une actualisation.

## Vérification réalisée

- Accueil, CSS, JS et service worker : HTTP 200.
- Anciennes pages home, login et création : HTTP 503, contenu de refonte.
- API publique et uploads : HTTP 503.
- HTTP et www : redirections 301 conservées.
- Configuration Nginx vérifiée avant rechargement et requêtes locales vérifiées après. Retour arrière automatique prévu en cas d’échec de cette vérification.
- Empreintes SHA-256 des anciens index.html, home.html et creer-personnage.html inchangées.
- Affichage de l’accueil public vérifié dans le navigateur.

## Retour arrière

À exécuter uniquement lorsque la réouverture de l’ancien site est souhaitée. Le fichier de sites-available n’est pas la sauvegarde active.

```sh
cp -a /root/backups/myrpgtable-accueil-20261027T131706Z/nginx.previous.conf /etc/nginx/sites-enabled/myrpgtable.fr
nginx -t && systemctl reload nginx
```

La page publique ne donne pas accès à la maquette locale. Les développements du créateur continuent séparément.
