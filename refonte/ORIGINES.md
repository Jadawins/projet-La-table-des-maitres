# Origines et dons — base MongoDB actuelle

## Choix intégrés

- Humain : taille M/P, une compétence supplémentaire, un don de catégorie `origine` parmi les fiches présentes, sans présélection.
- Historique : don fixe conservé sous son nom d'origine et outils accordés. Choix d'outil si la donnée indique « au choix », en utilisant les catégories et variantes de la collection `outils`.
- Lignages/héritages structurés : sélection parmi `especes.variantes`, affichage des traits source et des sorts débloqués selon `niveau_personnage_requis`.
- Compétences d'espèce : interprétation des marqueurs `au_choix` et `au_choix_intuition_perception_survie`. Les maîtrises déjà données par l'historique sont exclues.
- Doué : trois maîtrises parmi les compétences et outils disponibles. Façonneur : trois outils d'artisan. Musicien : trois instruments. Les options proviennent des fiches MongoDB, sans liste de règles externe.
- Initié à la magie : liste fixée par le libellé d'historique ou choisie pour le don humain, deux sorts mineurs distincts et un sort de niveau 1. Chaque prise a sa propre sélection. Une seconde prise doit utiliser une autre liste, comme indiqué dans la fiche du don.
- Dons répétables : détectés à partir de la mention « Répétable » dans leurs effets. Les autres ne peuvent pas être repris comme don humain s'ils viennent déjà de l'historique.
- Robuste : bonus de PV égal au niveau, d'après le texte **actuel** de cette BDD. Ne pas remplacer par un coefficient d'une autre publication.
- Vigilant : bonus de maîtrise ajouté à l'initiative, d'après cette BDD.
- Autres effets : descriptions reprises dans la fiche et le récapitulatif ; aucune action de combat ou consommation de ressource n'est exécutée automatiquement.

Les sorts d'origine restent séparés des quotas de classe. Les maîtrises d'origine ne consomment pas les choix de compétences de classe. Une modification d'origine qui crée une collision retire la sélection de classe devenue incompatible : elle doit être complétée à l'étape Aptitudes.

## Source et données non reliées

Lecture du VPS renouvelée pour ajouter les 25 fiches de la collection `outils`. Aucune écriture dans MongoDB. `catalogue.mjs` ne remplace pas les aptitudes ou descriptions des données sources.

Les liens non résolus restent visibles sans substitution. Exemple : « Habitué des tavernes » de l'historique Marin ne correspond pas exactement à une fiche de don ; son nom est conservé et aucun autre don n'est appliqué à sa place. Les sorts innés dont le nom n'est pas relié gardent aussi leur libellé source.

La caractéristique d'incantation d'Initié à la magie est lue dans les données de la liste de classe choisie. Le catalogue utilise actuellement INT pour Magicien et SAG pour Clerc/Druide ; pas d'option inventée à partir d'une autre édition.

## Limites

- Le premier parcours contrôlé dans l'interface est Humain / Charlatan / Clerc 3. Les lignages sont pris en charge quand les choix et seuils existent dans les champs structurés ; cela ne valide pas intégralement toutes les espèces.
- Les choix d'espèce uniquement décrits dans du texte, les contradictions internes entre un trait et sa variante, et certains effets chiffrés d'espèce restent à traiter. Par exemple, les bonus de PV de Ténacité naine et de Vitalité collinaire ne sont pas encore interprétés automatiquement ; ne pas supposer leur cumul.
- Les langues n'ont pas de quota ni de liste structurés dans l'extrait utilisé. Aucun quota externe n'est ajouté.
- Il reste des liaisons de libellés à compléter, la CA, les actions en partie et la sauvegarde en ligne.

## Vérifications

`node --test refonte/tests/origin-rules.test.mjs refonte/tests/character-rules.test.mjs refonte/tests/audit.test.mjs`

18 tests d'origine ajoutés, 44 tests au total : choix obligatoires, doublons, répétabilité, maîtrises mélangées, catégories d'outils, listes magiques distinctes, seuils de lignage, changement d'espèce, conservation de la BDD, PV et initiative. Les comparaisons documentaires historiques restent isolées du mode BDD.

Contrôle navigateur : Youpi Matin conserve ses choix de classe et ses dés. Taille M, Perception, don humain Robuste ; les maîtrises d'origine deviennent Escamotage/Tromperie/Perception, et les PV passent de 24 à 27. Le brouillon conserve ces choix après rechargement.
