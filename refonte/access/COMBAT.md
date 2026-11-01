# Combat de groupe — premier lot

Depuis **Mes groupes**, ouvrir un groupe puis **Ouvrir le combat**. Le MJ crée un affrontement, ajoute les personnages rattachés et les adversaires saisis manuellement. Un seul combat peut être ouvert par groupe. Un groupe peut avoir un MJ différent des autres groupes ; l’administration du site n’accorde aucun droit sur une table dont on n’est pas membre.

## Préparation et déroulement

Les personnages actuellement rattachés sont importés par référence, sans copie ni changement de fiche. Les adversaires sont initialement cachés. Le MJ saisit leur nom, leurs PV maximum et leur CA, puis les révèle lorsqu’il le souhaite. Le premier lot proposait uniquement cette saisie manuelle. Depuis la livraison `20261101T160457Z`, le panneau [Ajouter depuis le bestiaire](BESTIAIRE.md) permet également de choisir un profil et d’en ajouter plusieurs exemplaires, sans lancer de dés automatiquement.

Chaque initiative est saisie explicitement : le joueur peut renseigner celle de son personnage, le MJ celles de tous les participants. Le bonus calculé de la fiche est indiqué. Les totaux sont triés par ordre décroissant ; les égalités restent dans un ordre stable et le MJ peut faire passer un participant avant l’autre à égalité. Aucun lancer n’est effectué et aucun échange d’initiative propre à une aptitude n’est décidé automatiquement.

Le démarrage exige au moins un participant et toutes les initiatives. Le MJ avance ou recule les tours, met en pause, reprend ou termine avec confirmation. Un retour avant le tout premier tour est refusé. Les rounds sont conservés, et une correction d’initiative en pause ne change pas silencieusement le participant actif. L’ajout ou le retrait d’un participant pendant le combat exige une pause. Les participants à zéro PV ne sont pas sautés automatiquement : les exceptions et les décisions de la table restent explicites.

## PV, états et confidentialité

Les PJ utilisent leur fiche enregistrée comme seule source de PV et d’états. Le premier démarrage du suivi demande les PV actuels ; l’import dans le combat n’initialise et ne soigne rien. Les dégâts, soins, PV temporaires, corrections, états, stabilisation et jets de mort réutilisent le moteur existant. Les résultats des dés sont saisis manuellement. Une révision de fiche périmée est refusée, sans appliquer les dégâts une seconde fois. Le combat demande une vérification stricte de la révision : deux dégâts identiques simultanés ne sont pas fusionnés comme une sauvegarde répétée ; un seul est accepté et le second reçoit un conflit explicite. Les réserves et emplacements continuent de se gérer dans la fiche.

Le MJ peut suivre tous les participants ; chaque joueur ne modifie que son personnage. Pour les autres participants visibles, les PV et CA ne sont pas envoyés au navigateur du joueur. Les adversaires cachés et le journal MJ sont entièrement absents de sa réponse. Un personnage détaché, supprimé ou transféré devient indisponible ; un membre exclu perd l’accès au combat. La fiche complète, ses détails privés et le catalogue de sorts du personnage ne sont jamais envoyés à un autre joueur.

La concentration est un **repère manuel par participant** : nom du sort ou champ vide pour arrêter. Les interruptions, sauvegardes de concentration, durées, attaques, résistances et effets de sorts ne sont pas automatisés. Une neutralisation rappelle l’interruption nécessaire ; le marqueur ne constitue pas une validation de conformité du sort maintenu. La concentration n’est pas encore synchronisée comme ressource de la fiche.

## Persistance et limites du lot

Les affrontements sont enregistrés dans `combats_refonte`. Une révision protège les opérations de tour et de participant ; la révision propre à la fiche protège les PV des PJ. Les PV des PJ sont écrits uniquement dans leur document de personnage, sans second compteur à synchroniser. Le journal du combat concerne ses commandes ; il ne prétend pas tracer les écritures de PV des PJ. La fin ne restaure ni les PV ni les états. Le dernier combat reste consultable et un nouveau peut être préparé ; l’historique complet des combats sera un lot séparé.

La page se rafraîchit toutes les cinq secondes lorsqu’elle est visible. La saisie en cours est respectée, les commandes dépliées sont conservées et quitter la page arrête les requêtes. Une panne d’actualisation est signalée sans présenter les valeurs comme fraîchement récupérées.

Les tests couvrent stockage, accès HTTP, suivi de fiche, visibilité et trois parcours navigateur à deux comptes. Les parcours existants de groupe, accueil, administration et PDF restent contrôlés. Les essais MongoDB écrivent exclusivement dans des collections de contrôle ; les groupes et personnages réels sont comparés avant et après publication. Référence : `audit/verify-combat.mjs` et `audit/check-combat-persistence.mjs`.

Une première livraison candidate `20261101T153518Z` a été retirée après identification du cas de deux dégâts identiques concurrents. Le service a été remis sur la livraison des groupes avant correction et nouvelle vérification. Les contrôles de cette candidate n’ont modifié aucun groupe ou personnage réel.

Livraison finale : `20261101T154027Z`, publiée le 1er novembre 2026. Les 101 tests ciblés passent. Douze parcours existants ont réussi dans la campagne initiale, puis les trois parcours de combat ont été repris avec succès après les corrections : quinze parcours distincts, sans résultat ignoré ou instable. Onze contrôles MongoDB de combat (dont les dégâts simultanés identiques), huit contrôles de groupes et 22 parcours de personnages passent avant puis après bascule, ainsi que dix-neuf accès HTTP. Les groupes et personnages réels sont identiques avant/après. Sauvegarde de 3 281 documents et retour arrière : `/root/backups/myrpgtable-persistence-20261101T154027Z/`. [Relevé de publication](../audit/combat-publication-20261101.json). La connexion interactive en production n’a pas été automatisée ; les parcours utilisent deux comptes de test isolés.
