# Suppression des personnages

Depuis « Mes personnages », chaque personnage enregistré et chaque brouillon local possède un bouton Supprimer. Le dialogue nomme le personnage, précise la portée de l'action et permet d'annuler. Supprimer un brouillon local n'efface pas sa version enregistrée dans le compte.

`DELETE /atelier/api/personnages/:id` exige la session, la bonne origine et la révision actuellement affichée. Le propriétaire provient de la session. Une révision périmée est refusée afin de ne pas supprimer des changements récents faits ailleurs.

La suppression dans MongoDB est logique : `deleted_at` et une nouvelle révision sont enregistrés. Les documents supprimés sont exclus des listes et refusés à la lecture. Toute sauvegarde d'un ancien onglet vers le même identifiant est refusée, pour empêcher leur réapparition. Répéter la suppression après une coupure réseau est sans effet supplémentaire. Le contenu est conservé pour un éventuel rétablissement administratif ; cette fonction n'est pas une purge définitive de données.

Après succès, les copies locales du même identifiant sont retirées sur cet appareil. En cas d'échec réseau, la fiche reste accessible et l'utilisateur peut réessayer. Les essais de livraison utilisent seulement `refonte_controles` et vérifient que les vrais personnages sont inchangés.
