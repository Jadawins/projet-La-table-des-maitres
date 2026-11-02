# Sorts en combat — 2 novembre 2026

Lot applicatif distinct du catalogue figé `phb2024-2026-10-28`. Les textes et calculs de création restent inchangés.

## Parcours

Dans **Mes groupes → Combat → Sorts et concentration**, choisir le lanceur puis afficher ses sorts, sans lancer de dés. Les sorts d’un personnage proviennent de sa fiche : préparation, sorts accordés, caractéristique d’incantation, DD et bonus d’attaque. La ressource est choisie explicitement parmi les emplacements disponibles, y compris ceux du Pacte. Les sorts mineurs ne dépensent pas d’emplacement ; une autre dépense doit être expliquée et validée par le MJ.

Le joueur propose les cibles. Le MJ lit le sort et ses particularités, vérifie l’incantation et confirme le plan : attaque, sauvegarde ou effet direct ; dégâts, soins, PV temporaires, état ou rappel. Il vérifie la formule au niveau choisi, les cibles réellement concernées, les exceptions et la durée. La proposition seule ne consomme rien. La validation d’une incantation terminée enregistre sa dépense une seule fois. Une annulation ultérieure ne restitue pas les ressources.

Chaque jet propose **Mes dés physiques** ou **Les dés de l’application**. Les préférences sont propres au compte et modifiables. Rien n’est tiré lors de l’ouverture, de l’actualisation, du passage de tour ou d’une reprise. Les dés individuels, le dé retenu et les ajustements sont visibles aux personnes autorisées. Les sauvegardes ordinaires comparent le total au DD ; un 1 ou un 20 naturel n’impose pas à lui seul le résultat. Certains états imposent un échec de sauvegarde FOR/DEX, sans dé.

Le MJ confirme séparément les effets sur chaque cible, avec les résistances, immunités, vulnérabilités, corrections, exceptions, échecs de mort et remplacements de PV temporaires nécessaires. Les PV ne changent pas avant cette confirmation. Une confirmation répétée n’applique pas deux fois l’effet. Une défense modifiée demande une nouvelle vérification des mêmes dés ; une décision particulière du MJ exige un motif. Un changement de critique invalide le précédent jet de dégâts.

## Zones, impacts et effets persistants

Les alliés et le lanceur sont sélectionnables. Sans carte ni calcul de distance, le MJ choisit les participants réellement dans la zone et les exemptions prévues par les règles. Un jet commun peut servir avec des sauvegardes et traitements différents par cible.

Pour plusieurs rayons ou projectiles, le MJ déclare le budget total d’impacts. Les impacts suivants sont préparés explicitement pendant le même tour, sans nouvelle dépense. Ils peuvent viser plusieurs fois la même créature, chacun dans une résolution distincte. Un jet commun n’est partagé que si le MJ le déclare pour un effet direct ; un rayon avec attaque possède ses propres jets.

Un effet persistant demande un déclenchement explicite du MJ : entrée dans une zone, début ou fin de tour, ou autre condition du texte. Le déclenchement identifie ses cibles et son motif, sans nouvelle dépense. Les conditions exactes et limites de fréquence restent vérifiées à la table. Une nouvelle sauvegarde réussie peut retirer l’état provenant de ce sort lorsque le plan le prévoit.

Les états sont rattachés à leur sort source. Terminer un sort retire ses effets, sans supprimer un état manuel identique ni une autre source. Un effet de restauration peut explicitement retirer un état, y compris de plusieurs sources. Les rappels permettent le suivi des mécanismes sans application numérique directe.

## Concentration et durée

Une seule concentration est enregistrée sur la fiche. Son remplacement demande confirmation et retire les effets de la précédente. Les dégâts préparent une sauvegarde de Constitution, sans lancer le dé ; un échec, la mort ou un état neutralisant termine la concentration. Les dégâts absorbés par les PV temporaires comptent également. Le DD suit la règle commune, plafonnée à 30.

La durée en rounds déclarée par le MJ diminue au retour du tour d’ancrage ; zéro dans le plan signifie un suivi manuel. Le MJ peut ajuster le temps restant ou terminer le sort. Un effet durable peut survivre à une rencontre : la durée narrative écoulée et les nouveaux déclenchements sont vérifiés à la table. Les résolutions inachevées doivent être terminées ou annulées avant de clôturer le combat.

La fiche montre la concentration et les effets reçus et permet de les arrêter explicitement. Si une fiche est détachée, transférée ou devient inaccessible, le service ne l’écrit pas sous un autre propriétaire. Les cibles accessibles sont nettoyées ; l’effet restant sur une fiche devenue inaccessible doit être vérifié depuis son compte.

## Persistance et accès

Les résolutions sont conservées dans `sorts_combats_refonte`. Une opération en attente est persistée avant l’écriture des PV ou ressources. Chaque écriture possède un reçu atomique dans le document personnage ou le participant PNJ. Après une coupure, **Reprendre l’enregistrement sans relancer** recherche ce reçu et termine la résolution sans nouvelle dépense ni second effet. Un conflit de défense bloque l’application ; une nouvelle concentration ne peut pas être remplacée silencieusement lors d’une reprise.

Un joueur lance pour son personnage ou ses propres sauvegardes. Le MJ approuve les incantations, traite les PNJ et confirme les effets. Un PNJ caché et ses sorts restent cachés aux joueurs. Les réponses n’exposent pas les reçus internes ni les snapshots d’autres fiches. L’authentification et la vérification d’origine sont conservées.

MongoDB reste autonome : les opérations interdocuments utilisent des reçus et une reprise explicite, pas une transaction globale. Le service reste une instance PM2 unique. Limites de protection : 200 résolutions actives par groupe, 500 résolutions par combat, 20 résolutions actives par auteur dans le combat, 100 cibles et 100 impacts par plan.

## Limites assumées

Les formules proposées couvrent un petit ensemble explicite de sorts courants et certains sorts mineurs simples. Elles sont une base, pas une déclaration de conformité de toutes les interactions. Pour les autres sorts, dons, aptitudes, immunités conditionnelles, dégâts de plusieurs types, invocations ou effets spéciaux, le MJ déclare et motive le plan après lecture. Portée, visibilité, composants, actions, réactions et incantations longues sont vérifiés à la table ; la dépense attend l’achèvement déclaré de l’incantation.

Le catalogue présenté au MJ pour les PNJ ne constitue pas leur liste de sorts autorisés. Le MJ vérifie le profil, renseigne les bonus/DD manquants et contrôle les limites ; l’application note les usages sans inventer de quota. Aucune carte, géométrie de zone ou gestion automatique de l’économie des actions n’est ajoutée.

Références communes : [sorts, règles gratuites 2024](https://www.dndbeyond.com/sources/dnd/br-2024/spells) et [glossaire 2024](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary). Ce lot ne modifie pas le gel du catalogue.
