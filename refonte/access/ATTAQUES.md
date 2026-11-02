# Attaques et jets — 2 novembre 2026

Dans **Mes groupes → groupe → Combat**, démarrer le combat puis ouvrir **Attaques et jets**. Chaque joueur prépare les attaques de son personnage ; le MJ peut utiliser tous les participants, les attaques du bestiaire et une attaque personnalisée.

Choisir l'attaquant et préparer sa liste ne lance rien. Choisir ensuite l'attaque, la cible, les dés physiques ou ceux de l'application et la situation : normale, avantage ou désavantage. Le bonus vient de la fiche ou du profil conservé dans le combat. Les résultats naturels de chaque dé sont affichés, avec le dé écarté. Le joueur peut choisir une autre méthode pour les dégâts. Les deux préférences sont conservées séparément dans ce navigateur, par compte, et restent modifiables à chaque jet.

Les dés physiques sont renseignés individuellement. Les dés de l'application sont générés sur le serveur avec node:crypto.randomInt, uniquement après un clic explicite. Aucun lancer, changement de PV ou consommation de ressource n'est déclenché par l'ouverture ou l'actualisation de la page.

## Validation du MJ

Les dégâts proposés n'affectent aucun PV avant **Confirmer et appliquer**, accessible uniquement au MJ du groupe. Le MJ peut corriger touche/échec/critique avec un motif, appliquer une résistance, vulnérabilité ou immunité, puis ajouter une correction finale motivée. La CA et les indications de défense restent réservées au MJ. Les échecs de sauvegarde contre la mort éventuels sont choisis explicitement.

Le critique double les dés de la formule ; les bonus fixes sont ajoutés une fois. Les exceptions conditionnelles, effets de dons, dégâts supplémentaires, attaques par tour, ressources et effets de sorts restent arbitrés à la table. Pour une formule à plusieurs types de dégâts, le traitement global ne remplace pas l'arbitrage par type : le MJ calcule et renseigne la correction finale nécessaire. Les effets autres que les PV se suivent avec les commandes existantes.

La défense et les droits sont relus avant application. Si la défense a changé, **Revérifier sans relancer** conserve les d20 ; un changement de critique peut nécessiter de ressaisir ou relancer explicitement les dégâts. Deux confirmations simultanées ou répétées du même résultat ne l'appliquent qu'une fois. Les écritures concurrentes sur une fiche utilisent sa révision stricte ; un conflit demande une nouvelle confirmation sans relancer. Une écriture dont l'accusé est perdu produit un résultat **à vérifier**, bloqué contre toute seconde application : le MJ vérifie les PV avant une éventuelle correction manuelle.

## Durée des propositions

Les propositions restent en mémoire du serveur cinq minutes, avec vingt propositions actives par auteur et cinq cents conservées globalement. Elles disparaissent au redémarrage ; les PV déjà confirmés restent enregistrés dans MongoDB. Les propositions ne constituent pas un historique durable des attaques. Annuler ne retire jamais des dégâts déjà appliqués. Terminer un combat ne soigne pas les personnages.

Les joueurs ne voient que leurs propositions et les adversaires révélés. Ils ne reçoivent ni la CA, ni les PV, ni les profils privés des adversaires. Le MJ voit les propositions de son groupe.

## Vérification

85 tests ciblés et 21 parcours navigateur passent, dont trois nouveaux parcours d'attaques à deux comptes. Les contrôles couvrent les droits, les dés, les critiques, l'absence de dégâts avant confirmation, les préférences séparées, les confirmations concurrentes, les conflits et l'accusé de sauvegarde perdu. Les contrôles MongoDB utilisent des collections temporaires et comparent les données réelles avant et après publication. Le catalogue et les personnages existants ne sont pas migrés.

Références de calcul consultées : [glossaire officiel des règles gratuites 2024](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary) et [règles de jeu officielles](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game). Cette intégration ne rouvre pas la campagne de conformité du catalogue figé.
