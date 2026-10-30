# Accueil, grimoire, administration et fiche PDF

L’accueil est la page d’entrée de l’atelier. Le texte du créateur s’adresse à « vos aventures » et « vos personnages ». Les fiches restent dans Mes personnages. Le grimoire recherche sans distinction d’accents dans le catalogue chargé depuis MongoDB et propose dix catégories, dont les sorts, classes, sous-classes, dons, espèces et équipements.

## Fiche PDF

Le bouton « Télécharger la fiche PDF » remplit le formulaire fourni par le propriétaire du site, `eFeuillePersoDD2024.pdf`. Le modèle et ses crédits sont conservés. Les données sont calculées par le même modèle que la fiche à l’écran ; aucun dé n’est lancé et aucune sauvegarde du personnage n’est déclenchée.

Le PDF contient les valeurs, noms d’aptitudes et ressources utiles pour jouer. Les longues explications restent sur le site. Les cases de suivi de partie restent libres : PV actuels, PV temporaires, dés dépensés, jets contre la mort, inspiration et emplacements dépensés. Les cases de maîtrise, concentration, rituel et matériel sont remplies.

Le formulaire reste modifiable après téléchargement. Le fichier d’origine possède 381 champs. Le champ combinant incantation et portée est séparé pour respecter les deux colonnes du dessin. Au-delà de six armes/sorts mineurs ou de trente sorts, le générateur réutilise la page correspondante avec des noms de champs distincts, inscrits dans l’AcroForm. Les champs longs qui ne tiennent pas à taille lisible sont abrégés avec des points de suspension et un message le signale. Tous les noms de sorts sont contrôlés dans le fichier exporté.

Les lignes d’armes utilisent des champs sur une ligne, avec une police de 8 points maximum ajustée jusqu’à 6 points selon la largeur. Les propriétés structurées sont converties en libellés et portées lisibles.

La génération se fait dans le navigateur. La bibliothèque pdf-lib 1.17.1 est livrée localement avec sa licence MIT : aucune donnée de personnage n’est envoyée à un prestataire PDF externe.

## Administration

Configurer `REFONTE_ADMIN_EMAILS` dans l’environnement du serveur : adresses séparées par des virgules. Aucune adresse réelle n’est inscrite dans le code. Les droits proviennent exclusivement de l’adresse confirmée retournée par Supabase après vérification du jeton. Les métadonnées du navigateur ne donnent aucun droit. Une reconnexion est nécessaire après modification de la configuration ou redémarrage.

Les API `/atelier/api/admin/metrics`, `/directory` et `/assign` vérifient la session et le rôle sur le serveur. Les écritures exigent aussi l’origine du site. Le menu est caché pour les autres comptes. Le répertoire utilise les comptes existants de `users` et les fiches actives de `personnages_refonte` ; les connexions vérifiées actualisent le répertoire du site. Les listes sont limitées à 500 entrées.

Les métriques comptent les comptes connus du site, les personnages actifs, finalisés, brouillons, supprimés et créés sur sept jours, et leur répartition par classe. Elles ne comptent pas les brouillons locaux ni les comptes Supabase qui n’ont jamais été enregistrés par le site.

L’attribution propose par défaut une copie, ou un transfert explicite, avec confirmation du personnage et du destinataire. Le contenu est conservé sans recalcul. Les contrôles de révision empêchent d’attribuer une version périmée ou supprimée. Une copie reçoit un nouvel identifiant et une révision 1 ; un transfert change le propriétaire et incrémente la révision. Un événement d’attribution est enregistré avec l’opération. Le transfert ne remplace jamais une fiche portant déjà cet identifiant chez le destinataire.

## Vérification et livraison

Les tests ciblés vérifient l’identité administrateur, les refus d’accès, les conflits, les copies, transferts et répertoires. Les parcours navigateur couvrent aussi l’accueil, la recherche, le téléchargement du vrai PDF, les sauvegardes, suppressions et profils de compagnon. Le PDF est rouvert pour contrôler ses valeurs canoniques, apparences, champs modifiables et pages supplémentaires, puis rendu visuellement.

Le déploiement sauvegarde la base, la livraison précédente, la configuration Nginx et l’environnement privé. Les essais MongoDB utilisent uniquement `refonte_controles` et `refonte_comptes_controles`, avec nettoyage. Les personnages réels sont comparés avant/après sans écriture de contrôle sur leur collection. Le retour arrière restaure le service et sa configuration, sans restaurer inutilement une ancienne base par-dessus des créations plus récentes.
