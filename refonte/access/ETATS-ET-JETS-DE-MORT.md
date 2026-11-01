# États, Épuisement et sauvegardes contre la mort

Livraison `20261101T083829Z`, 1er novembre 2026. Elle complète [les emplacements et repos](EMPLACEMENTS-ET-REPOS.md). Le catalogue reste `phb2024-2026-10-28-textes-final-20261031`, sans nouvelle version de règles ni migration des personnages existants.

## Utilisation

Dans **En partie**, commencer le suivi des PV si nécessaire, puis ouvrir **Ajouter ou retirer un état**. Les quatorze états ont une case et un rappel de leurs conséquences. Un état induit reste présent tant que sa cause existe : retirer Neutralisé ne contourne pas Paralysé. À zéro PV, Inconscient est déduit sauf exception explicitement déclarée ; un état Inconscient ajouté manuellement garde sa propre cause. À terre reste après le réveil et se retire séparément.

Le niveau d’Épuisement va de zéro à six. Le malus aux Tests d20 et la Vitesse en partie sont affichés, avec prise en compte des états fixant la Vitesse à zéro. Étourdi ne suffit pas à immobiliser en 2024. Les valeurs de base des attaques, sauvegardes et caractéristiques de la fiche ne sont pas réécrites : les effets contextuels et les immunités s’appliquent à votre table. Un bandeau rappelle les états et l’Épuisement dans les autres rubriques.

Un repos long confirmé réduit l’Épuisement suivi de un. Le rôdeur de niveau 10 ou plus bénéficie aussi de cette réduction au repos court. Les autres états restent présents jusqu’à leur retrait explicite. Le repos ne vérifie pas une durée réelle ni les conditions particulières de la table.

## Zéro PV et mort

- La première chute depuis des PV positifs réinitialise les compteurs et laisse le personnage À terre. À zéro PV, saisir le **d20 naturel** et les éventuels autres modificateurs ; le malus d’Épuisement est déjà appliqué par le suivi.
- Un 1 naturel produit deux échecs. Un 20 naturel rend 1 PV et réinitialise les compteurs, quel que soit le modificateur. Sinon, un total d’au moins 10 produit une réussite.
- Trois réussites stabilisent à zéro PV et remettent les deux compteurs à zéro. **Stabiliser** permet également de déclarer une stabilisation obtenue à la table. Aucun soin de 1d4 heures n’est déclenché par une horloge.
- Les dégâts déjà reçus à zéro PV demandent de déclarer un échec, deux pour un critique, ou zéro pour une exception de table. Ils font perdre la stabilisation. Les PV temporaires restent gérés avant les PV actuels ; les exceptions doivent être décidées par le joueur.
- Trois échecs déclarent la mort. Une mort instantanée, une aptitude de survie ou un autre cas particulier ne sont pas déduits du montant des dégâts : utiliser **Déclarer la mort** si le résultat retenu à la table le demande.
- La mort déclarée, le niveau six d’Épuisement, les corrections de compteurs et le retour à la vie passent par un récapitulatif et une confirmation. Annuler ne modifie rien.
- Un soin ordinaire ne ressuscite pas. Réduire un Épuisement de six à cinq ne ressuscite pas non plus. Après résolution du retour à la vie à la table, utiliser sa commande explicite avec les PV rendus, après avoir corrigé l’Épuisement si nécessaire.

Les jets restent physiques ou décidés par le joueur ; aucun dé n’est lancé automatiquement. Les durées d’effets, cibles, sources de concentration, résistances et aptitudes particulières ne constituent pas un moteur de combat automatisé.

## Sauvegarde et compatibilité

Les changements sont d’abord conservés sur cet appareil. **Enregistrer les modifications** les conserve dans le compte. Les protections de propriétaire et de révision restent actives ; la copie et le transfert administrateur conservent ce suivi.

Les champs facultatifs `conditions`, `exhaustion`, `deathSaves` et `zeroHpConscious` complètent `playState` version 1. Les anciens documents restent valides et leur simple ouverture n’ajoute aucun champ. Un ancien client ne peut pas effacer ces données par omission, ni modifier silencieusement les PV d’un personnage déclaré mort. Des PV réellement positifs normalisent les anciens compteurs non mortels lors d’une sauvegarde explicite, sans modifier le document d’entrée.

Le PDF reste la fiche de personnage de création. Le suivi interactif est sur le site et exclu de l’impression HTML.

## Références et vérifications

Référence : [SRD français 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf), pages 18–19 pour zéro PV et sauvegardes contre la mort, pages 187–197 pour les états, page 192 pour l’Épuisement, et aptitude du rôdeur dans le catalogue figé. Empreinte du PDF : `480604d949a3bb77f639cf31c1e9e1e7ebb04ae481d943db662ba546828d94bf`. Les résumés techniques des états sont rédigés pour cette interface ; le catalogue documentaire et les calculs de création sont conservés.

- **4 053 tests unitaires réussis**, sans échec ni test ignoré : quatorze nouveaux tests, avec conservation des tests précédents.
- **15 parcours navigateur réussis** : états liés, affichage dans les autres rubriques, Épuisement et repos, dés saisis, stabilisation, dégâts à zéro PV, confirmations et annulations, sauvegarde et réouverture sur un autre appareil. Deux captures inspectées.
- **Dix parcours MongoDB avant et après publication** : barbare, rôdeur, barde, druide et occultiste aux niveaux 3 et 20. Également contrôlés : anciens clients, révisions, isolation, suppression, copie et transfert administrateur. Les collections de contrôle sont nettoyées et les empreintes des personnages réels sont inchangées.
- **Quinze accès HTTP contrôlés** après la bascule. Sauvegarde préalable de **3 280 documents**, livraison précédente et retour arrière dans `/root/backups/myrpgtable-persistence-20261101T083829Z/`.

Preuve locale : `audit/verify-conditions.mjs`. Résultat de publication : `audit/conditions-result-20261101.json`.
