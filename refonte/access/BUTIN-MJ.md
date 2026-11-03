# Distribution de butin par le MJ — 3 novembre 2026

Dans **Mes groupes → Ouvrir le groupe → Distribuer du butin**, un MJ peut préparer une attribution aux personnages associés au groupe. Aucun destinataire n’est coché par défaut. Un membre sans fiche complète associée ne peut pas être sélectionné.

## Préparation et confirmation

1. Donner un nom au butin, puis choisir un ou plusieurs personnages.
2. Indiquer les pièces de chaque monnaie et, facultativement, un objet libre ou du catalogue avec sa quantité et sa description.
3. Vérifier le récapitulatif : **chaque personnage sélectionné reçoit les quantités indiquées**. Le montant n’est pas partagé ou divisé automatiquement. Il n’est pas prélevé sur la fiche ou la bourse du MJ.
4. Confirmer les attributions. Les objets reçus restent dans le sac sans être équipés. Les pièces augmentent la bourse suivie, avec un mouvement « Butin du groupe ». Une attribution d’objet seul ne crée pas de bourse.

Préparer n’écrit rien dans les personnages. **Annuler** abandonne une préparation non confirmée. Elle reste repérable par les MJ et n’apparaît pas comme butin reçu chez les joueurs. Après confirmation, l’application ne retire pas automatiquement un butin déjà attribué : toute correction ultérieure de fiche reste explicite.

Une préparation ajoute un seul type d’objet, en une ou plusieurs unités, ainsi que les pièces facultatives. Préparer plusieurs attributions pour plusieurs objets différents ou pour des récompenses différentes selon les personnages. Les limites habituelles de l’inventaire et de la bourse s’appliquent.

## Suivi, interruptions et changements de fiches

Le suivi distingue les personnages ayant reçu le butin de ceux encore en attente. Les actions **Reprendre les attributions restantes** et **Revoir les fiches restantes** gardent la même attribution ; elles ne créent pas une seconde récompense.

Chaque fiche reçoit, dans une écriture atomique MongoDB, son nouvel inventaire, sa bourse et un reçu interne. Une réponse réseau perdue ou un redémarrage ne redonne donc pas le butin déjà écrit. Le reçu est conservé par les sauvegardes ultérieures et reste identifiable après transfert ou suppression logique de la fiche. Il n’est pas accepté depuis un snapshot utilisateur et n’est jamais exposé par l’API des personnages.

Le lot entier n’est pas une transaction globale : si un destinataire ne peut plus recevoir, les autres peuvent être servis et le suivi affiche **Attribution incomplète**. Si une fiche a été modifiée depuis l’aperçu, elle n’est pas écrasée : **Revoir les fiches restantes**, puis vérifier et confirmer de nouveau. Une fiche détachée, transférée, supprimée ou devenue indisponible ne reçoit aucune nouvelle écriture. L’application ne redirige jamais silencieusement le butin vers une autre fiche récemment associée.

Une attribution en cours est protégée contre deux commandes concurrentes. Après une interruption brutale du processus, une reprise est possible après expiration d’un délai d’une minute ; les reçus des fiches sont alors vérifiés avant chaque nouvel envoi. Les autorisations du MJ et le rattachement du destinataire sont recontrôlés avant les écritures. La perte du rôle MJ ou de l’accès au groupe bloque les commandes suivantes. Un autre MJ actuel du même groupe peut vérifier et reprendre le suivi.

## Confidentialité

Les MJ actuels du groupe voient les préparations et leur suivi. Un joueur voit uniquement ses propres attributions confirmées, sans la liste des autres destinataires ni leurs soldes, histoires ou inventaires. Le module n’ouvre pas au MJ la consultation générale des fiches privées. Un administrateur qui n’est pas MJ du groupe n’obtient pas de droit de distribution. L’exclusion, le départ et la suppression du groupe révoquent l’accès au suivi.

Les joueurs retrouvent le butin dans leur fiche enregistrée et dans le suivi du groupe. Les modifications locales non enregistrées ne sont pas remplacées automatiquement ; rouvrir la fiche en ligne permet de récupérer l’attribution, et une sauvegarde d’un ancien onglet est protégée par le contrôle de révision.

Le suivi est rafraîchi périodiquement sur la page du groupe, sans effacer le formulaire en cours. Aucun e-mail ni message privé automatique n’est envoyé par ce module. L’historique est paginé par cinquante attributions. Les envois sont limités à trente commandes par minute et compte/adresse, cent destinataires au maximum et cinq mille reçus par fiche.

## Vérifications et recette

Les tests couvrent les droits, la confidentialité, les préparations sans écriture, les confirmations répétées/concurrentes, les conflits, les réponses perdues, le redémarrage entre la fiche et le suivi, le changement de personnage, la révocation des accès et le transfert/suppression après réception. Les contrôles de publication utilisent des collections et comptes synthétiques isolés, sans attribuer de butin aux personnes réelles.

Les essais manuels utilisateur restent regroupés dans [la recette finale PC](RECETTE-FINALE-PC.md). Les tests automatisés ne cochent pas ces cases.
