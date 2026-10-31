# Suivi en partie — PV et ressources

Livraison `20261031T151138Z`, 31 octobre 2026. Le catalogue et les règles de calcul restent `phb2024-2026-10-28`, édition `phb2024-2026-10-28-textes-final-20261031`.

## Utilisation

Ouvrir sa fiche, puis **En partie**. Le suivi ne commence qu’après saisie des PV actuels et clic sur **Commencer le suivi**. Les réserves proposées commencent à leur maximum ; les utilisations déjà dépensées peuvent être saisies immédiatement.

- Les dégâts saisis sont le montant final décidé à la table, après résistances et réductions. Les PV temporaires absorbent les dégâts en premier, puis les PV actuels diminuent jusqu’à zéro.
- Les soins remontent les PV actuels, sans dépasser le maximum. Une correction directe des PV est disponible.
- Les PV temporaires sont remplacés, sans cumul ; une valeur de zéro permet de les retirer.
- Pour chaque réserve proposée, saisir une quantité puis **Dépenser** ou **Rendre**. Impossible de dépenser davantage que le disponible ou de rendre davantage que les dépenses enregistrées. Les dégâts, DD, portées et bonus ne sont pas transformés en compteurs.
- Les changements sont conservés dans le brouillon de cet appareil. Cliquer **Enregistrer les modifications** pour les conserver dans le compte et les retrouver sur un autre appareil. Un message distingue la version locale de celle enregistrée.

Les réserves comprennent notamment Rage, Inspiration bardique, Forme animale et utilisations gratuites de Marque du chasseur, ainsi que les réserves de base explicitement prises en charge pour les autres classes et les quotas de sous-classe structurés. Les aptitudes conditionnelles qui ne sont pas représentées comme réserves restent consultables dans Aptitudes. Dépenser une utilisation ne déclenche ni attaque, ni sort, ni transformation ou résistance.

Cette étape ne gère pas les repos, les emplacements de sorts, les états, les sauvegardes contre la mort, les boucliers conditionnels ou toutes les ressources particulières de don/sous-classe. Aucun lancer de dés n’est automatique. Le formulaire PDF garde son fonctionnement actuel ; le suivi est dans l’onglet du site.

## Conservation et compatibilité

Le champ facultatif `playState` est enregistré avec la fiche et soumis aux mêmes protections de propriétaire et de révision. Les anciennes fiches restent sans ce champ tant qu’aucun suivi n’est commencé. Aucun document existant n’est migré ni modifié en ouvrant sa fiche.

Le suivi conserve les PV manquants : si les choix de création modifient le maximum de PV, les PV manquants sont maintenus et les PV affichés restent au moins à zéro. Une action explicite de soin ou de correction remet le compteur à la valeur souhaitée. Les dépenses des réserves sont également conservées lorsque leur maximum change ; un maximum plus faible ne restitue pas silencieusement des utilisations.

Un ancien onglet qui omet ce nouveau champ ne l’efface pas côté serveur. Une ancienne révision ne remplace pas des modifications plus récentes. En cas de conflit, le suivi local reste conservé et la version du compte reste intacte. Copier ou transférer une fiche par l’administration conserve son suivi.

## Vérifications et publication

- Campagne de **4 026 tests unitaires réussis**. Après la dernière protection des anciens clients, **35 tests ciblés** de stockage, suivi et fiche sont repris et passent, dont un nouveau test de compatibilité. Cela couvre **4 027 tests distincts**, sans prétendre à un deuxième passage complet fictif.
- Neuf nouveaux tests de suivi : absence de modification implicite, PV temporaires, dégâts/soins, corrections, limites, quatre classes prioritaires, valeurs non consommables, changements de maximum, validation et conservation des calculs/dés.
- **Dix parcours navigateur réussis**, puis trois parcours concernés repris après l’ajustement des sept onglets sur une ligne sur PC. Ils couvrent PV/Rage, actualisation, autre appareil, conflit de révision, données invalides, navigation, administration et PDF.
- Capture du mode en partie inspectée sur PC. Le suivi interactif est exclu de l’impression HTML ; les autres rubriques restent présentes.
- Huit contrôles réels MongoDB aux niveaux 3 et 20 pour barbare, rôdeur, barde et druide avant/après bascule : sauvegarde, lecture du suivi, dépenses, ancien client, révision périmée, isolation, suppression et attributions administrateur. Ces essais utilisent uniquement des collections de contrôle nettoyées et comparent les empreintes des personnages réels.

Preuve : `audit/verify-play-state.mjs`. Résultats de publication : `audit/play-state-result-20261031.json`. Sauvegarde et retour arrière : `/root/backups/myrpgtable-persistence-20261031T151138Z/`.

Prochaine étape fonctionnelle : suivi des emplacements de sorts, puis repos explicitement demandés avec leurs récupérations propres ; elle ne fait pas partie de cette livraison.
