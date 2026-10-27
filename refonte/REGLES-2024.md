# Première intégration des règles — 27 octobre 2026

> **Décision courante : utiliser la BDD telle qu'elle existe.** La vérification documentaire externe et les errata sont différés. Les modifications de contenu décrites historiquement ci-dessous ont été retirées : le domaine de la Vie et les trois autres domaines reprennent leurs aptitudes et listes depuis la BDD. Aucun ajout de compétence n'est injecté dans le catalogue. Les normalisations techniques sont conservées. Les noms de sorts non reliés ne sont pas remplacés par supposition. Le suivi courant se trouve dans `audit/SUIVI.md` ; les comparaisons antérieures sont archivées séparément.

## Source et périmètre

`data/rules-mongodb.json` est une lecture des seules collections de règles du VPS : aucune donnée de compte ou de personnage, aucun identifiant de connexion. La base de production n'a pas été modifiée. Le navigateur consulte un catalogue local dérivé de cet extrait. Rafraîchir avec `./refonte/read-rules.ps1` depuis une session SSH autorisée, puis relancer le serveur local.

Les choix détaillés couvrent le **clerc des niveaux 1 à 3**, d'abord avec le **domaine de la Vie**. Les autres domaines sont visibles mais désactivés jusqu'à vérification. Les autres classes restent explorables sans être présentées comme des personnages complets. Le guerrier sans magie saute l'étape Sorts.

## Choix et calculs implémentés

- Historique : normalisation STR/FOR, choix de la répartition des bonus et calcul des scores finaux sans modifier les résultats des dés.
- Vocation divine : Protecteur ou Thaumaturge ; sélection et compteur des sorts mineurs adaptés.
- Domaine de la Vie : sélection à partir du niveau 3, aptitudes corrigées dans le catalogue local, sorts de domaine automatiques séparés du quota de préparation.
- Compétences : quota de classe et exclusion des compétences déjà accordées par l'historique ; Intuition/Perspicacité normalisé.
- PV : maximum du dé au niveau 1, puis valeur fixe, dés physiques saisis ou dés dans l'application déclenchés individuellement. Constitution finale appliquée à chaque niveau, gain minimum de 1. Les dons et traits d'espèce influençant les PV ne sont pas encore appliqués.
- Sorts : catalogue réel, filtrage par classe et rang accessible, recherche, descriptions dépliables, compteurs et validation des quotas, DD et attaque magique. Changement de niveau ou vocation : retrait des sélections devenues invalides ; aucun sort sélectionné automatiquement en remplacement.
- Migration du brouillon initial de 6 sections vers le nouveau parcours, conservation des choix, récapitulatif enrichi et reprise après rechargement.

## Corrections locales et vérifications

Référence primaire consultée : [règles officielles 2024 — classes, section Cleric](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes).

La table de progression de clerc présente dans MongoDB correspond aux compteurs utilisés. Le domaine de la Vie contient en revanche des aptitudes héritées d'une autre version : le catalogue dérivé remplace ses aptitudes de niveau 3 par Disciple de la Vie et Préservation de la vie. La base et l'extrait brut restent intacts. Le nom du sort de domaine « soin des blessures » est rapproché de l'identifiant `soins` du catalogue ; ne pas déduire l'identité d'un sort par simple ressemblance pour les autres domaines.

Escamotage manque dans la collection `competences` : il est ajouté explicitement dans le catalogue local, associé à DEX. Pas de correction silencieuse de MongoDB.

## Limites à traiter avant sauvegarde réelle

- Auditer les autres domaines et les descriptions de sorts. Le contenu de la BDD n'est pas intégralement conforme aux règles 2024 ; une étiquette PHB2024 ne suffit pas.
- Valider les dons d'origine de chaque historique et leurs effets. Par exemple le champ « Truand » du Charlatan doit être revu ; ne pas le transformer automatiquement en un don valide sans source.
- Ajouter les choix d'espèce : humain (compétence et don supplémentaires, taille), lignages et sorts innés. Appliquer les effets éventuels aux calculs.
- Ajouter langues, outils et autres maîtrises, en gérant les doublons et les remplacements autorisés.
- Calculer la CA à partir de l'équipement réellement porté et les effets des dons/espèces. Ne pas confondre un bouclier avec une armure donnant une CA de base.
- Les autres classes et niveaux ne disposent pas encore de parcours détaillés ; pas de multiclassage.
- Authentification, validation serveur, sauvegarde réelle et migrations de personnages existants restent à réaliser.

## Vérification

`node --test refonte/tests/character-rules.test.mjs`

14 tests : quotas de clerc 1–3, Thaumaturge, sorts automatiques et doublons, changements de niveau et domaine, bonus STR/FOR, scores de base préservés, PV fixes et physiques, limites des dés de vie, compétences automatiques, navigation du guerrier, intégrité de l'extrait MongoDB.

Vérification navigateur : reprise de Youpi Matin (Clerc 3), bonus du Charlatan, vocation Thaumaturge, domaine de la Vie, deux compétences, 24 PV sur les valeurs présentes ; affichage des quatre sorts automatiques, des emplacements 4/2, du DD 14 et de l'attaque +6, sélection d'un sort mineur et blocage si les quotas ne sont pas remplis.
