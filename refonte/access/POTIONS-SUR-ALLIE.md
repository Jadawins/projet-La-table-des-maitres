# Administrer une potion à une autre créature — 3 novembre 2026

Dans **Mes groupes → Combat → Potions sur une autre créature**, un joueur propose une potion de guérison de son propre inventaire à une autre créature visible du combat. Un MJ peut proposer celles des personnages de la table. Le module utilise les quatre puissances déjà reconnues dans l’inventaire ; les objets libres simplement nommés « potion » ne sont pas interprétés automatiquement.

## Parcours

1. Démarrer le combat et le suivi des PV du personnage qui administre la potion et de la cible.
2. Choisir explicitement le personnage, la potion disponible et la créature qui la reçoit. La préparation ne retire aucun objet et ne change aucun PV.
3. Choisir les dés physiques et saisir chaque face, ou déclencher les dés de l’application. Le jet est enregistré, sans consommation. Aucun dé n’est lancé à l’affichage.
4. Le MJ vérifie la portée, l’action et les conditions, puis confirme **Consommer la potion et appliquer les soins**. Une unité quitte l’inventaire source et les soins concernent seulement la cible, plafonnés à ses PV maximum. Ses PV temporaires sont conservés ; une remontée de zéro PV réinitialise le suivi des jets contre la mort selon les règles de suivi existantes.

La potion se consomme en étant administrée : elle n’est pas ajoutée à l’inventaire de la cible. Boire soi-même reste disponible depuis sa propre fiche. Les personnages et les PNJ visibles sont sélectionnables ; le MJ arbitre les alliances et exceptions. Aucune position de carte n’est inventée.

Références de la version figée : [SRD 5.2.1 français, p.105](https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf#page=105) pour la portée de 1,50 m et l’action Bonus ; [p.215](https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf#page=215) pour l’usage des potions ; les quatre formules de soins déjà intégrées proviennent de la p.254. Aucun nouveau livre, errata ni changement au catalogue n’est introduit. Les bonus de sorts et de caractéristique ne sont pas ajoutés aux potions par déduction.

## Contrôles

Le joueur ne propose que sa propre potion et ne valide pas les soins. Le propriétaire de la potion ou le MJ peut saisir ses dés. Seul le MJ du groupe confirme, révise ou reprend les écritures. Les personnes concernées et le MJ voient la proposition ; les autres joueurs et les personnes extérieures n’en reçoivent pas le détail. Les PNJ cachés ne sont pas proposés aux joueurs. Les snapshots des fiches, les reçus et les données internes ne sont pas exposés par les réponses publiques.

Les personnages morts ou ne pouvant pas agir ne peuvent pas administrer une nouvelle potion. La cible doit avoir un suivi commencé et ne pas être déclarée morte. Une fiche ou un combat modifié depuis le récapitulatif fait refuser la validation avant la dépense : actualiser puis vérifier de nouveau. Une référence de potion supprimée, modifiée ou épuisée est refusée.

Les résultats des dés sont persistés. Une requête répétée avec la même référence retrouve le résultat ; elle ne relance pas les dés. Pour corriger une proposition avant son utilisation, l’annuler explicitement et en préparer une nouvelle. L’annulation avant tentative d’utilisation ne coûte aucun objet ni PV.

## Reprise durable

La consommation et les soins touchent deux documents distincts : ils ne constituent pas une transaction globale. La résolution enregistre d’abord les deux opérations et leurs références, puis effectue chaque écriture avec son reçu atomique.

Si l’enregistrement s’interrompt, le suivi indique ce qui reste à faire. Une potion déjà consommée n’est pas retirée une deuxième fois ; un soin déjà écrit n’est pas appliqué de nouveau. Les reçus restent identifiables après transfert ou suppression logique d’une fiche, sans recréer ni modifier le mauvais propriétaire.

**Confirmer la reprise sans relancer** vérifie les reçus et reprend les opérations restantes. Si une fiche a changé, **Revérifier les fiches avant reprise**, puis confirmer la reprise : les snapshots sont recalculés depuis les fiches actuelles, avec le même résultat de dés. Le MJ ne perd donc pas les changements d’inventaire, d’histoire ou de suivi intervenus entre-temps.

Une résolution en cours bloque les commandes concurrentes pendant son enregistrement. Après une interruption brutale du processus, une reprise est possible après expiration d’un délai d’une minute. Le retrait d’un participant concerné par une utilisation déjà commencée reste bloqué tant que sa résolution n’est pas terminée.

Une utilisation commencée ne peut pas être annulée ni remboursée automatiquement : l’état d’une écriture dont l’accusé a été perdu doit d’abord être vérifié. Si une cible est devenue indisponible ou ne peut plus recevoir de soins, le suivi reste en attente ; la fiche d’origine et les conditions doivent être rétablies ou la situation arbitrée à la table. Aucun renvoi vers une autre cible, retour à la vie ni compensation automatique n’est effectué. Les reprises d’actions déjà consommées peuvent être terminées pendant une pause ou après le combat ; une nouvelle consommation exige un combat en cours. Les utilisations en attente d’un combat précédent restent visibles dans le suivi du groupe.

## Vérification et recette

Les tests couvrent les dés et leur rejeu, les permissions, les soins plafonnés, les états vitaux, les conflits avant et entre les écritures, les accusés perdus, le redémarrage entre fiche et suivi, les transferts/suppressions, les PNJ et la confidentialité. Les contrôles MongoDB utilisent des comptes et collections synthétiques isolés. Les essais manuels sont regroupés dans [la recette finale PC](RECETTE-FINALE-PC.md), sans cases cochées par les tests automatiques.
