# Emplacements et repos — 1er novembre 2026

Livraison `20261101T075917Z`, à la suite du [suivi des PV et ressources](SUIVI-EN-PARTIE.md). Catalogue conservé : `phb2024-2026-10-28-textes-final-20261031`. Les règles restent arrêtées au 28 octobre 2026.

## Utilisation

Dans **En partie**, chaque niveau d’emplacement affiche son maximum et son disponible. **Dépenser** retire la quantité saisie ; **Rendre** permet une correction ou une récupération particulière décidée à la table. Un compteur ne lance pas de sort et ne choisit pas d’emplacement à votre place. Les sorts gratuits, rituels et Secrets arcaniques ne sont pas assimilés à des emplacements ordinaires.

La Magie de pacte possède son propre compteur. Il conserve les dépenses lorsque le rang des emplacements de l’Occultiste augmente. Les quotas proviennent de la fiche calculée, sans nouvelle table de progression dupliquée.

Pour un repos court, indiquer les dés de vie dépensés et le total des soins obtenus avec vos propres jets, Constitution comprise, au minimum 1 PV par dé. L’application ne lance aucun dé. Le nombre de dés disponibles et les soins au-delà du maximum sont contrôlés. Les dépenses antérieures de dés de vie peuvent être corrigées explicitement.

**Préparer le repos court/long** ouvre un récapitulatif des valeurs avant/après. **Annuler** ne change rien. **Terminer le repos** confirme que les conditions sont remplies à votre table, puis applique les récupérations annoncées. Les deux repos nécessitent au moins 1 PV pour commencer ; leurs durées, interruptions et conditions de validité ne sont pas déduites d’une horloge réelle. Le dernier repos enregistré affiche l’heure de l’action sur le site.

Après modification, **Enregistrer les modifications** conserve le suivi dans le compte. La protection des révisions reste active ; un conflit ne remplace pas silencieusement la version d’un autre appareil.

## Récupérations appliquées

| Élément suivi | Repos court | Repos long |
| --- | --- | --- |
| PV | Seulement les soins saisis pour les dés dépensés, plafonnés au maximum | Tous les PV manquants |
| PV temporaires | Conservés | Retirés |
| Dés de vie | Dépense saisie | Tous récupérés |
| Emplacements ordinaires | Aucun retour automatique | Tous récupérés |
| Emplacements de pacte | Tous récupérés | Tous récupérés |
| Rage, Forme animale, Souffle vital, Canal divin | Une utilisation, sans dépasser le maximum | Réserve complète |
| Inspiration bardique | Complète dès le niveau 5, aucune récupération avant | Complète |
| Énergie martiale, Élan guerrier, Prêtre de la guerre | Complète | Complète |
| Flash protecteur | Complète dès le niveau 6 | Complète |
| Autres quotas pris en charge avec récupération au repos long | Aucun retour automatique | Réserve complète |

Les règles de récupération sont explicites dans `play-state.mjs` ; elles ne sont pas déduites par recherche de mots dans une description. Une réserve future sans politique connue reste manuelle et apparaît comme telle dans le récapitulatif.

Les récupérations nécessitant un choix ou l’activation d’une aptitude ne sont pas exécutées automatiquement : Récupération magique du Magicien, restauration de sorcellerie, conversions d’emplacements/ressources, Astuce mystique, etc. Elles se règlent avec les contrôles manuels et les aptitudes de la fiche. Les états, l’Épuisement, les réductions temporaires de maximum et autres effets non suivis restent à gérer à la table.

Le compteur **Astuce mystique** est corrigé : il représente une utilisation du rite par repos long, et non le nombre d’emplacements que ce rite pourrait restaurer. Les dépenses déjà enregistrées sont conservées ; aucune fiche existante n’est réécrite pour cette correction d’affichage.

## Références et conservation

Référence officielle conservée : [SRD français 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf), pages 19 et 198–199 pour PV temporaires/repos, sections des classes pour leurs réserves. Empreinte du PDF utilisé : `480604d949a3bb77f639cf31c1e9e1e7ebb04ae481d943db662ba546828d94bf`. Les quotas propres aux sous-classes reprennent les descriptions et paliers du catalogue figé et de son journal `rules-2024-corrections.json`, notamment le palier de Flash protecteur. Ce lot ne modifie aucune règle documentaire ni description du catalogue.

Les champs `slotUsed`, `hitDiceUsed` et `lastRest` étendent facultativement le suivi version 1. Une ancienne fiche reste valide sans eux et leur simple affichage ne déclenche pas de migration. Un ancien client limité aux PV ne les efface pas en enregistrant : le serveur conserve les champs omis. La copie et le transfert administrateur conservent le suivi.

## Vérifications et publication

- **4 039 tests unitaires réussis**, sans échec ni test ignoré ; onze nouveaux tests d’emplacements/repos et un nouveau test de compatibilité des anciens clients.
- **13 parcours navigateur réussis**, puis le parcours Druide repris pour inspecter visuellement le récapitulatif. Couverture : dépenses, dés physiques saisis, annulation, récupérations différenciées, repos à zéro PV refusés, sauvegarde sur un autre appareil, anciens clients et données invalides. Les parcours PV/concurrence, administration, catalogue et PDF restent valides.
- **Dix parcours réels MongoDB** avant et après publication : barbare, rôdeur, barde, druide et occultiste aux niveaux 3 et 20. Ils testent sauvegarde et relecture des emplacements/repos, récupération courte/longue, anciens clients, conflits, isolation, suppression et attribution. Les données de contrôle sont nettoyées ; les empreintes des personnages réels sont comparées.

Preuve : `audit/verify-spell-rest.mjs`. Résultats : `audit/spell-rest-result-20261101.json`. Sauvegarde complète et retour arrière : `/root/backups/myrpgtable-persistence-20261101T075917Z/`.

Prochaine étape possible : états, Épuisement et sauvegardes contre la mort, avec leurs effets explicitement suivis. Ils ne sont pas annoncés comme automatisés par cette livraison.
