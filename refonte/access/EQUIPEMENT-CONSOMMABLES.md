# Équipement porté et consommables — 3 novembre 2026

Dans la fiche, onglet **Équipement** :

- **Équipement porté** choisit une armure, un bouclier et les armes prêtes. Enregistrer applique ces choix à la CA, aux restrictions d’armure, aux défenses sans armure et aux attaques. Posséder une armure ne suffit plus à la porter après activation de ce choix explicite. Le matériel reste dans le sac lorsqu’on le déséquipe.
- **Objets ajoutés en partie** permet de relier un objet aux armes, armures et boucliers du catalogue. Son nom personnel n’ajoute aucun bonus magique. Un objet libre reste descriptif.
- Cocher **Consommable** permet de retirer une unité après confirmation, sans interpréter automatiquement sa description. La dernière unité disparaît de la liste.
- Les quatre puissances de potion de guérison proposent des soins sur la fiche ouverte. Commencer d’abord le suivi des PV dans **En partie**. Choisir les dés physiques et saisir chaque face, ou déclencher explicitement les dés de l’application. L’aperçu ne consomme rien ; **Annuler** conserve l’objet. **Confirmer l’utilisation** retire une unité et applique les soins dans une seule sauvegarde, plafonnés aux PV maximum. Les PV temporaires restent inchangés. Une mort déclarée ne peut pas être annulée par une potion.

## Conservation et sauvegarde

Aucune fiche existante n’est migrée ni réécrite. En l’absence d’`equipmentState`, les calculs historiques du matériel de départ restent en vigueur. Un premier enregistrement de l’équipement rend la sélection explicite. Les objets libres précédemment créés ne sont pas reconnus uniquement par leur nom : choisir leur référence dans **Modifier cet objet**.

Les ajouts, changements d’équipement et utilisations enregistrent la fiche dans le compte de son propriétaire. Les éditions autorisées dans l’espace de gestion gardent leur propriétaire et leur journal d’édition habituels. Les brouillons personnels restent sur cet appareil en cas d’indisponibilité de la sauvegarde en ligne. L’éditeur de gestion reste en mémoire, comme auparavant.

Quantité et soins partagent un snapshot et une révision MongoDB. Un conflit refuse l’ensemble de l’écriture ; aucune écriture séparée des PV n’est effectuée. Une sauvegarde personnelle dont seule la réponse a été perdue peut être retentée avec le même contenu, sans seconde dépense. Tant que la modification reste non enregistrée, une nouvelle utilisation est bloquée. En cas de conflit, rouvrir la fiche enregistrée et revoir les changements ; ne pas écraser l’autre onglet. Les écritures administratives gardent leur contrôle strict de révision : après une réponse perdue, rouvrir la fiche pour vérifier l’enregistrement.

Les anciens clients qui omettent les nouveaux champs conservent simultanément objets, équipement porté, décomptes de matériel et dernier usage. Les montées de niveau, multiclasses et résolutions de combat les conservent aussi. Le PDF affiche la CA, les armes prêtes, le bouclier porté et les quantités restantes.

## Limites explicites

Les armes prêtes sont une liste d’attaques disponibles, pas une affectation aux mains : Duel, Polyvalente, attaque à deux mains et changement d’arme restent conditionnels au jet. Enfiler ou retirer une armure respecte le temps indiqué dans le grimoire ; aucun temps de combat n’est avancé automatiquement. Poids/Encombrement, achats et monnaies courantes, harmonisation, charges rechargeables et bonus magiques personnalisés ne sont pas automatisés dans ce lot. Les soins de potion concernent la fiche ouverte ; administrer un objet à une autre fiche reste arbitré à la table. Les autres consommables diminuent le stock et laissent leurs effets manuels.

Les formules des potions proviennent du [SRD 5.2.1 français, page 254](https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf#page=254) : 2d4+2, 4d4+4, 8d4+8 et 10d4+20. Ce complément applicatif ne rouvre pas l’errata ni le catalogue figé. L’attribution CC BY du site reste applicable. Les armes et armures utilisent les valeurs du catalogue MongoDB existant.

## Vérification et publication

Tests du lot : `tests/equipment.test.mjs` et `e2e/specs/equipment.spec.mjs`, avec les régressions de fiches, de dons, de combat, de sauvegarde et de permissions. La preuve `audit/verify-equipment.mjs` compare aussi les 48 sous-classes aux niveaux 3 et 20 avec le modèle précédemment publié, sans nouvel équipement explicite. Elle ne prétend pas revalider les règles documentaires gelées.

`audit/check-equipment-persistence.mjs` écrit uniquement dans une collection de contrôle et compare les empreintes des collections réelles avant/après. `audit/deploy-equipment.sh` exige sauvegarde complète, contrôles avant bascule, retour arrière et contrôles après bascule. Le rapport de publication est conservé dans l’audit.

Ce lot est complété le 3 novembre 2026 par [la bourse, les achats et les ventes](BOURSE-ACHATS-VENTES.md). Les limites d’argent courant citées ci-dessus décrivent le périmètre de la livraison initiale, avant ce complément.
