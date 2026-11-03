# Check-list des essais manuels finaux sur PC

À utiliser à la fin des développements retenus pour la table. Toutes les cases restent volontairement décochées : les tests automatisés ne remplacent pas ces essais utilisateur.

Version testée : __________ · Date : __________ · Navigateur : __________

Prévoir deux comptes de test et des personnages identifiables comme tels. Un compte peut être MJ dans un groupe et joueur dans un autre. Utiliser des fiches de test pour les suppressions, ventes et transferts. Pour chaque défaut, noter le parcours, le résultat observé et une capture si utile.

## Accès et navigation

- [ ] Ouvrir l’accueil sans être connecté → nouveautés, mot d’accueil et accès à l’inscription/connexion lisibles ; les fonctions privées ne sont pas accessibles.
- [ ] Créer un compte et confirmer son adresse → réception du mail et accès au compte selon le parcours annoncé.
- [ ] Se connecter, se déconnecter puis revenir → session cohérente et fiches du bon compte.
- [ ] Naviguer entre Accueil, Mes personnages, Mes groupes et Grimoire → chaque rubrique s’ouvre sans perdre une recherche ni écraser un brouillon.
- [ ] Rechercher un sort, une classe et un don dans le Grimoire → résultats pertinents et descriptions lisibles.

## Création, sauvegarde et évolution

- [ ] Commencer une création → aucune classe, espèce ou historique présélectionné.
- [ ] Saisir des dés physiques → aucun lancer automatique ; valeurs et répartition conservées.
- [ ] Choisir les dés de l’application puis les valeurs standard → chaque mode suit le choix explicite du joueur.
- [ ] Créer une fiche au niveau 3 → sous-classe, choix de niveau et sorts demandés ; informations cohérentes sur la fiche.
- [ ] Essayer les classes de la table (barbare, rôdeur, barde, druide et clerc) → choix compréhensibles, rubriques et ressources utiles présentes.
- [ ] Enregistrer puis actualiser et rouvrir depuis Mes personnages → même fiche et mêmes choix, sans doublon de brouillon « en cours ».
- [ ] Modifier l’histoire et les langues → texte conservé après enregistrement et réouverture.
- [ ] Monter de niveau sur une fiche de test → nouveaux choix disponibles, choix précédents et suivi de partie conservés selon l’aperçu.
- [ ] Faire une montée multiclassée valide puis tenter une classe sans prérequis → première acceptée, seconde expliquée et refusée.
- [ ] Modifier la même fiche dans deux onglets → l’ancienne version n’écrase pas la plus récente ; le conflit est compréhensible.
- [ ] Supprimer une fiche de test, en annulant d’abord → annulation sans effet, puis suppression effective sans toucher aux autres fiches.

## Équipement, consommables et bourse

- [ ] Ajouter un objet libre avec quantité et description → il reste descriptif, sans bonus magique déduit de son nom.
- [ ] Relier une arme ou une armure au catalogue → elle devient sélectionnable dans l’équipement porté.
- [ ] Porter puis retirer une armure et un bouclier → CA et indications de restrictions mises à jour ; les objets restent possédés.
- [ ] Choisir les armes prêtes → attaques correspondantes visibles ; bonus conditionnels présentés sans cumul automatique injustifié.
- [ ] Préparer une potion avec dés physiques puis annuler → aucun objet ni PV modifié.
- [ ] Confirmer la potion puis utiliser celle de l’application → soins plafonnés, quantité diminuée une fois, dernière unité retirée ; aucun lancer au simple affichage.
- [ ] Recevoir puis dépenser de l’argent → solde exact et mouvements consultables après réouverture.
- [ ] Tenter une dépense trop élevée → refus sans dette ni modification partielle.
- [ ] Payer sans l’appoint → rendu de monnaie proposé seulement après le choix explicite et aperçu exact des pièces restantes.
- [ ] Préparer un achat et annuler, puis confirmer → annulation sans effet ; confirmation ajoutant la bonne quantité et débitant le prix total convenu une fois.
- [ ] Vendre une partie d’un objet, puis sa dernière unité portée → bon prix crédité et objet déséquipé quand son stock atteint zéro.
- [ ] Revenir sur les mêmes choix de départ après une vente → le matériel vendu ne réapparaît pas et la bourse reste inchangée.
- [ ] Corriger les cinq soldes avec un motif → aperçu puis soldes réels conservés, sans réinjection de l’argent de départ.

## Suivi de partie

- [ ] Commencer le suivi des PV, appliquer dégâts et soins → valeurs justes et PV temporaires absorbés selon le suivi.
- [ ] Dépenser un emplacement, une ressource et un dé de vie → compteurs conservés et impossibilité de dépenser au-delà du disponible.
- [ ] Préparer un repos puis annuler, ensuite confirmer → seules les récupérations annoncées sont appliquées.
- [ ] Appliquer un état et de l’Épuisement → indications et conséquences prises en charge visibles.
- [ ] Passer à 0 PV et saisir un jet contre la mort → aucun jet automatique ; sauvegardes conservées, soins et mort déclarée traités distinctement.

## Groupes, messages et combats

- [ ] Créer un groupe comme MJ et un autre comme joueur → droits correspondant au rôle choisi.
- [ ] Rejoindre avec un code joueur puis utiliser une invitation MJ distincte → rôles corrects ; un non-membre ne voit pas le groupe privé.
- [ ] Associer une fiche au groupe → seule une fiche du compte est sélectionnable.
- [ ] Préparer un butin pour deux personnages puis annuler → aucun gain, aucun destinataire présélectionné ; le récapitulatif explique les quantités reçues par chacun.
- [ ] Confirmer un butin avec objet et pièces → bonnes quantités sur les seules fiches choisies, sans équipement automatique ni prélèvement au MJ.
- [ ] Modifier une fiche dans un autre onglet entre préparation et confirmation du butin → attribution concernée en attente ; revue puis reprise sans écraser la modification ni doubler les gains déjà reçus.
- [ ] Ouvrir le suivi du butin comme joueur → uniquement ses propres attributions, sans les autres destinataires ni les soldes privés ; accès refusé après exclusion.
- [ ] Envoyer un message MJ à une personne, puis à plusieurs → seuls les destinataires reçoivent le pop-up ; leur liste reste privée.
- [ ] Choisir « Relire plus tard », puis « J’ai lu » → premier choix sans accusé de lecture, second confirmé pour ce destinataire ; réception après retour sur le site.
- [ ] Préparer un combat avec des adversaires du bestiaire → profils présents, adversaires cachés invisibles aux joueurs tant qu’ils ne sont pas révélés.
- [ ] Saisir les initiatives, gérer une égalité, avancer les tours/rounds, mettre en pause puis reprendre → ordre et état conservés.
- [ ] Préparer une attaque avec dés physiques puis avec les dés de l’application → jets explicites ; dégâts appliqués uniquement après validation du MJ.
- [ ] Proposer une potion sur un allié, saisir les dés physiques puis attendre le MJ → ni consommation ni soin avant la confirmation ; une seule unité retirée et soins sur la cible uniquement.
- [ ] Refaire le parcours avec les dés de l’application, puis annuler une autre proposition → lancer explicite, résultat conservé et annulation sans coût avant utilisation.
- [ ] Modifier une fiche pendant la préparation d’une potion → refus de l’ancien récapitulatif, puis actualisation sans perdre le texte ; aucune seconde consommation lors d’une reprise.
- [ ] Résoudre un sort ciblé et un soin → bonne caractéristique d’incantation, dés au choix et dépense d’emplacement unique au moment prévu.
- [ ] Résoudre une zone contenant des alliés → MJ choisissant les cibles affectées, sauvegardes et effets séparés, friendly fire possible selon le sort.
- [ ] Subir des dégâts sous concentration → demande de sauvegarde sans lancer automatique ; échec terminant les effets concernés.
- [ ] Vérifier une durée de sort puis terminer le combat → traitement des effets conforme aux confirmations proposées.
- [ ] Quitter un groupe de test, exclure un membre et supprimer le groupe en annulant d’abord → accès révoqués au bon moment, personnages personnels préservés.

## Impression et gestion réservée

- [ ] Télécharger le PDF d’un personnage martial et d’un lanceur de sorts → bons champs, armes lisibles, quantités restantes et monnaies courantes.
- [ ] Imprimer ou prévisualiser ces PDF → rendu lisible sur feuille, sorts supplémentaires présents si nécessaire.
- [ ] Avec le compte de gestion, vérifier le total des comptes → nombre cohérent avec les comptes inscrits ; cette page reste inaccessible aux comptes ordinaires.
- [ ] Consulter une fiche de test et compléter son histoire ou son inventaire depuis la gestion → modification dans le compte du propriétaire, sans copie personnelle indésirable.
- [ ] Copier puis transférer une fiche de test entre comptes en suivant les confirmations → appartenance et visibilité conformes au choix.

## Bilan de recette

- [ ] Tous les défauts bloquant une partie ont un correctif vérifié.
- [ ] Les limites conservées sont connues de la table ; aucune fonction non développée n’a été considérée comme testée.
- [ ] La version acceptée et la date sont renseignées en haut du document.

Retours et réserves :

______________________________________________________________________

______________________________________________________________________
