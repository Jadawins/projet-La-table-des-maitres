# Consulter et compléter les fiches — 2 novembre 2026

Dans **Administration → Toutes les fiches**, rechercher un personnage par nom, classe ou compte du joueur, puis choisir **Ouvrir la fiche**. L’accès global est réservé au compte administrateur configuré côté serveur ; un joueur ou un MJ de groupe ne reçoit pas cet accès.

La fiche s’ouvre avec les rubriques habituelles, le suivi et le téléchargement PDF. Le bandeau **Édition administrateur** indique le compte propriétaire. Les détails se complètent dans **Histoire → Compléter l’identité, les langues et l’histoire**. **Modifier mes choix** ouvre les formulaires existants de création ; les contraintes habituelles de progression et de multiclassage restent applicables.

Cliquer sur **Enregistrer les modifications** écrit dans le compte du joueur, sans copie ni transfert. Les ajouts narratifs libres, objets ou capacités accordés à la table peuvent être décrits dans **Histoire et notes** ; cela ne crée pas un nouvel objet structuré ni un bonus calculé automatiquement. Les choix d’équipement et autres options du catalogue restent ceux des formulaires existants. Les anciennes versions de règles restent consultables sans migration automatique.

L’espace d’édition administrateur reste en mémoire, séparé des brouillons personnels sur l’ordinateur. Les changements non enregistrés demandent confirmation avant de quitter la fiche ou de recharger la page. Le retour à l’espace personnel restaure son brouillon et ses choix temporaires. Une fiche administrée ne se retrouve pas automatiquement dans **Mes personnages**.

La révision est contrôlée à chaque enregistrement. Si le joueur, un combat ou un autre onglet a changé la fiche, l’écriture est refusée : le contenu en cours reste affiché, et il faut rouvrir la version récente pour reporter les changements utiles. Une fiche transférée, supprimée ou inexistante ne peut pas être recréée par une ancienne édition.

Chaque modification effective conserve un journal interne dans le même document : identifiant administrateur, date et révisions avant/après, limité aux cent dernières interventions. Les reçus de combat et autres métadonnées existantes sont conservés. Ce journal n’est pas transmis avec la fiche au navigateur. Les contrôles de privilège, d’origine et de validation restent côté serveur, même pour un lien direct ou une requête fabriquée.

La liste affiche au plus 500 fiches et comptes, comme le répertoire d’attribution existant. Les fiches supprimées et les brouillons uniquement présents sur l’ordinateur d’un joueur n’y figurent pas. Aucun compte réel n’est usurpé pour les vérifications : les parcours utilisent deux identités simulées et le contrôle MongoDB utilise des collections jetables.
