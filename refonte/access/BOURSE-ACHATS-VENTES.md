# Bourse, achats et ventes — 3 novembre 2026

Dans **Fiche → Équipement → Bourse et achats**, le solde affiche PC, PA, PE, PO et PP. Il utilise l’argent de départ tant qu’aucun mouvement n’a été enregistré. Le premier mouvement initialise une bourse suivie ; modifier ensuite les choix de départ ou monter de niveau ne réinjecte pas cet argent.

## Actions disponibles

- **Recevoir ou dépenser de l’argent** : saisir un montant, une monnaie et éventuellement un motif. Aucune dette n’est autorisée. Le paiement utilise d’abord l’appoint dans la monnaie choisie. Si l’appoint manque, **Faire la monnaie si nécessaire** doit être coché : les autres pièces peuvent alors être utilisées et la monnaie rendue apparaît dans l’aperçu. Les pièces d’électrum existantes gardent leur valeur ; aucune pièce d’électrum n’est créée par le rendu automatique de monnaie.
- **Acheter un objet** : choisir une référence du catalogue ou un objet libre, sa quantité et le prix unitaire convenu. Le prix d’une arme ou armure du catalogue est proposé lorsqu’il existe. Il reste modifiable pour un accord à la table. Aucun prix de potion ni d’objet libre n’est inventé. L’achat ajoute un nouvel objet sans l’équiper et débite le prix multiplié par la quantité.
- **Vendre un objet** : choisir un objet possédé, une quantité disponible et le prix unitaire convenu. La moitié du prix du catalogue est proposée pour une arme ou armure reconnue ; aucun tarif n’est imposé aux objets libres, objets de valeur ou objets magiques. Le stock et les pièces sont modifiés ensemble. Vendre la dernière unité d’un objet porté le déséquipe. Les ventes du matériel de départ diminuent sa quantité restante sans réécrire les choix de création ; ses attaques et sa CA cessent d’en profiter lorsque l’objet n’est plus possédé. Revenir sur les mêmes choix de départ conserve le décompte des objets déjà vendus.
- **Corriger le solde de la bourse** : saisir les cinq comptes réels et un motif obligatoire, pour reprendre une feuille papier ou corriger une saisie. Le changement est également présenté avant confirmation.

**Préparer** ouvre un aperçu du solde avant/après et des quantités modifiées. **Annuler** ne modifie ni la fiche, ni le solde, ni le stock. **Confirmer** enregistre l’ensemble dans une seule révision de la fiche. Les vingt derniers mouvements restent consultables, avec motif, date, différence de valeur et solde après l’opération. Le PDF utilise les cinq soldes courants.

## Exactitude et conservation

Les montants sont calculés en nombres entiers de pièces de cuivre. Une fraction de PC est refusée ; deux décimales au maximum sont acceptées dans la monnaie choisie, avec point ou virgule. Les valeurs sont celles du [SRD 5.2.1 français, page 95](https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf#page=95) : PC 1, PA 10, PE 50, PO 100, PP 1 000 en équivalent cuivre. La même page fournit le demi-prix usuel de vente de l’équipement. Aucun errata ultérieur ni nouveau catalogue n’est introduit.

La bourse est un champ facultatif `wallet` : anciennes fiches inchangées, ajout seulement par une action explicite. Elle est validée dans les snapshots, conservée par les anciens clients qui l’omettent, par les montées de niveau, les multiclasses et les écritures de combat. Les écritures réservées conservent le propriétaire et leur journal habituel.

Un achat, une vente et leur solde sont une seule sauvegarde MongoDB, sans écriture séparée susceptible de débiter sans donner l’objet. Un conflit de révision refuse l’ensemble. Une réponse perdue à une sauvegarde personnelle se récupère en retentant le même snapshot, sans deuxième mouvement ni deuxième objet. Les mouvements sont bloqués tant que les changements précédents restent non enregistrés. Les éditions réservées gardent leur révision stricte : rouvrir la version en ligne après une réponse perdue pour vérifier son état.

Limites : un milliard de pièces par type ; montant d’une opération limité à un milliard de PC ; quantité par objet de 1 à 9 999 ; limites d’inventaire existantes conservées. L’historique comporte vingt mouvements, pas une comptabilité externe certifiée. L’ajout gratuit et la modification manuelle d’un objet restent disponibles pour les dons, trouvailles et corrections ; ils ne déclenchent pas de prix caché. Aucun marchand partagé, transfert entre fiches, distribution de butin, validation obligatoire du MJ, poids des pièces ou simulation de commerce n’est ajouté dans ce lot.

## Vérifications

`tests/wallet.test.mjs` vérifie les conversions exactes, les limites, les achats/ventes, le matériel de départ, le déséquipement, le PDF, la compatibilité, les conflits et la reprise d’une sauvegarde. `e2e/specs/wallet.spec.mjs` parcourt les formulaires, les annulations, les prix convenus, le rendu de monnaie volontaire et l’édition réservée dans le bon compte. Les autres régressions restent distinctes de la recette manuelle finale.

`audit/check-wallet-persistence.mjs` utilise uniquement une collection de contrôle et vérifie les empreintes des collections réelles. Le déploiement impose sauvegarde, contrôles avant/après et retour arrière. Les résultats publiés sont consignés dans le rapport du lot.
