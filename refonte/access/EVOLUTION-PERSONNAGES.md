# Montée de niveau et multiclassage

Lot distinct autorisé le 1er novembre 2026. Référence conservée : `phb2024-2026-10-28`, catalogue MongoDB `phb2024-2026-10-28-textes-final-20261031`. Le catalogue documentaire, les descriptions et les fiches existantes ne sont pas migrés. Livraison en ligne : `20261101T095447Z`. Résultats : `audit/advancement-result-20261101.json`.

## Parcours joueur

Ouvrir une fiche complète puis **Passer au niveau…**. Choisir la classe qui reçoit le prochain niveau : une classe existante ou une nouvelle classe. Un seul niveau est ajouté et le total reste limité à 20. Les conditions d’accès d’un multiclassage sont affichées ; les classes non accessibles sont désactivées.

Le parcours reprend les choix de classe déjà enregistrés. Les caractéristiques de départ, origines, équipements initiaux, améliorations passées et sous-classes précédentes sont conservés. Le joueur complète les nouvelles aptitudes, choisit sa sous-classe au niveau de classe approprié, ses dons, augmentations et sorts. Les choix déjà acquis restent sélectionnés ; une option devenue indisponible reste visible pour être retirée explicitement. Les aptitudes autorisant des remplacements restent soumises à leur texte. Un grimoire de Magicien ne perd pas ses sorts antérieurs ; le remplacement de sorts précédents est limité lorsque la classe le demande.

Les PV des niveaux précédents gardent leur méthode et leurs jets. Un nouveau résultat physique doit être saisi ; les dés de l’application ne sont lancés que par le bouton correspondant. La Constitution finale est appliquée rétroactivement à tous les niveaux. Au premier niveau d’une classe secondaire, le dé n’est pas maximisé.

Le récapitulatif présente le niveau, les PV maximum, la maîtrise et les nouvelles aptitudes avant validation. Le joueur choisit de conserver ses PV actuels ou d’y ajouter le gain du maximum. Aucun de ces choix ne relève un personnage à zéro PV ou déclaré mort. Les PV temporaires, dépenses, états, Épuisement et jets de mort sont conservés ; aucun repos n’est appliqué.

**Valider la montée de niveau** conserve la progression sur la fiche puis l’enregistre dans le compte si une session est disponible. Un échec de sauvegarde laisse la progression locale récupérable et conserve la dernière version du compte. **Annuler** rétablit la fiche précédente, sans écriture en ligne. Un rechargement permet de reprendre le travail local en cours. Le compteur de révision empêche un ancien onglet d’écraser une autre modification.

Pour commencer une aventure directement avec plusieurs classes, créer d’abord la fiche au niveau souhaité de la classe de départ, puis ajouter les niveaux des autres classes par ce parcours. Il ne réattribue pas rétroactivement des niveaux déjà enregistrés.

## Calculs multiclassés

- Le niveau total détermine la maîtrise et la progression générale des sorts mineurs. Chaque classe conserve son propre niveau pour ses aptitudes, sa sous-classe, ses améliorations, ses ressources et sa préparation de sorts.
- Les prérequis de toutes les classes sont vérifiés, avec l’alternative Force ou Dextérité du Guerrier et les deux valeurs exigées pour Moine, Paladin et Rôdeur. L’ordre d’acquisition des classes est conservé.
- La nouvelle classe n’accorde que les maîtrises de son entrée de multiclassage. Aucun équipement de départ supplémentaire ni sauvegarde de base supplémentaire n’est accordé. Les formations et maîtrises issues d’aptitudes restent disponibles.
- Les améliorations sont traitées dans l’ordre des niveaux de personnage. Les caractéristiques et prérequis des dons tiennent compte des autres classes déjà acquises ; les mêmes dons non répétables ne sont pas repris silencieusement.
- Les dés de vie sont regroupés par type. Le suivi en partie conserve leurs dépenses séparées, permet de choisir les dés dépensés au repos court et restitue tous les dés au repos long.
- Les emplacements ordinaires sont communs : niveaux complets des incantateurs, moitié arrondie au supérieur pour chaque Paladin/Rôdeur, tiers arrondi à l’inférieur pour chaque Chevalier occulte/Arnaqueur arcanique. Si une seule classe accorde Sorts, sa table propre s’applique. Les emplacements de pacte restent séparés et récupèrent au repos court ou long. Un emplacement supérieur ne débloque pas de préparation de sorts de ce rang.
- Chaque sort affiche sa classe ou son origine et sa propre caractéristique, son DD et son attaque. Les valeurs de préparation restent celles de chaque classe prise séparément.
- Attaque supplémentaire ne s’additionne pas entre les classes. Les formules de classe d’armure ne s’additionnent pas non plus : une méthode est sélectionnée sur la fiche. Les attaques, maîtrises et conséquences numériques communes utilisent les caractéristiques et la maîtrise du personnage.

Le PDF réunit les classes, aptitudes et sorts. Les dés de vie de types différents y sont indiqués, ainsi que la réserve de pacte et les repères magiques propres aux classes.

## Conservation et limites

Le champ facultatif `multiclass` version 1 conserve la séquence des classes acquises, leurs choix propres et la méthode de CA retenue. Le niveau racine reste le niveau total et la classe racine reste celle de départ. Les champs racine de cette classe sont conservés pour compatibilité. Les projections internes de calcul ne sont pas envoyées au serveur ni stockées dans les brouillons.

Les anciennes fiches sans ce champ conservent leur format. Un ancien client qui omet les données multiclassées ne peut pas remplacer une fiche multiclassée. Le suivi facultatif `hitDiceUsedByType` conserve les dépenses par type ; une ancienne interface ne peut pas les effacer ou les remettre à zéro par omission. La validation serveur, l’isolation par compte, les révisions et les attributions administrateur s’appliquent à la fiche complète.

Le niveau est décidé avec le MJ ; ce lot ne suit pas automatiquement les PX, les conditions de repos, les entraînements ou les décisions de campagne. Le module MJ, les combats, la concentration et les durées d’effets restent une étape distincte. Aucun support téléphone ni nouveau livre n’est introduit.

## Sources

- [SRD français 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf), pages 24–27 et paragraphes de multiclassage de chaque classe. PDF déjà utilisé par le gel du catalogue, empreinte `480604d949a3bb77f639cf31c1e9e1e7ebb04ae481d943db662ba546828d94bf`.
- [Basic Rules 2024, création et multiclassage](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character#Multiclassing), notamment la contribution des deux sous-classes à un tiers.
- [PHB 2024 distribué sur Roll20, multiclassage](https://roll20.net/compendium/dnd5e/Rules:Multiclassing?expansion=32231).

Les tables de progression, sorts et descriptions proviennent du catalogue MongoDB figé. Le moteur applique les règles communes de combinaison ; il ne recherche pas une nouvelle édition ni des modifications postérieures au gel. Les attributions du SRD restent accessibles dans le Grimoire et la page Sources.

## Vérifications et publication

- Campagne complète de **4 292 tests unitaires réussis**, suivie de **16 contrôles supplémentaires réussis** sur les progressions multiclassées jusqu’au total 20 et les cas particuliers corrigés : **4 308 tests distincts**. Les 48 sous-classes parcourent successivement les niveaux 1 à 20 (912 transitions), les douze progressions mixtes parcourent 228 transitions et les 132 couples ordonnés de classes sont testés.
- **229 parcours navigateur distincts validés** : douze classes au niveau 1, 48 sous-classes aux niveaux 3 et 20, dix-sept parcours de progression et contrôles de stockage, compte, PDF, origines, inscription et sauvegarde. La campagne principale donne 227 réussites et deux échecs de test : attente incorrecte d’un champ vide facultatif et capture lancée pendant le dernier rendu de sauvegarde. Les attentes sont corrigées ; les dix-sept progressions et trois parcours de repos sont repris sur les modules finaux, tous réussis. Ces vingt reprises ne sont pas ajoutées au nombre de parcours distincts. La campagne exploratoire interrompue n’est pas présentée comme achevée.
- Les contrôles supplémentaires couvrent Érudition sans compétence éligible, la conservation de cette éligibilité à la date d’acquisition, les identifiants de classe invalides et le cumul de bonus de compétences distincts avec Expertise ou demi-maîtrise.
- **22 parcours MongoDB avant et après bascule** dans les seules collections de contrôle : dix reprises du suivi existant et douze séquences de montée puis multiclassage, une par classe de départ. Sont également contrôlés les anciens clients, révisions, autres comptes, suppression et copie/transfert administrateur. Les empreintes des personnages réels sont identiques, dont Youpi matin au niveau 3, révision 2.
- **Quinze accès HTTP vérifiés**. Sauvegarde de **3 280 documents**, livraison précédente et retour arrière : `/root/backups/myrpgtable-persistence-20261101T095447Z/`. Le service charge toujours le même catalogue MongoDB et son empreinte.

Preuve reproductible : `audit/verify-advancement.mjs`. Les rapports volumineux et captures restent locaux, les résultats et scripts sont versionnés. Le bilan distingue les vérifications effectuées et ne prétend pas tester chaque combinaison théorique de plusieurs classes.
