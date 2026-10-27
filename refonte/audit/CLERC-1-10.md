# Clerc 1–10 — intégration de la BDD actuelle

Périmètre : ordinateur uniquement. Quatre domaines, dix niveaux et deux vocations, soit 80 scénarios de création et de fiche. Ces contrôles ne constituent pas une validation documentaire de toutes les règles.

| Domaine | Niveau | Mineurs Protecteur / Thaumaturge | Préparés | Maîtrise | Canal divin | Sorts à relier |
|---|---:|---:|---:|---:|---:|---|
| Domaine de la Guerre | 1 | 3 / 4 | 4 | +2 | 0 | — |
| Domaine de la Guerre | 2 | 3 / 4 | 5 | +2 | 2 | — |
| Domaine de la Guerre | 3 | 3 / 4 | 6 | +2 | 2 | — |
| Domaine de la Guerre | 4 | 4 / 5 | 7 | +2 | 2 | — |
| Domaine de la Guerre | 5 | 4 / 5 | 9 | +3 | 2 | — |
| Domaine de la Guerre | 6 | 4 / 5 | 10 | +3 | 3 | — |
| Domaine de la Guerre | 7 | 4 / 5 | 11 | +3 | 3 | — |
| Domaine de la Guerre | 8 | 4 / 5 | 12 | +3 | 3 | — |
| Domaine de la Guerre | 9 | 4 / 5 | 14 | +4 | 3 | — |
| Domaine de la Guerre | 10 | 5 / 6 | 15 | +4 | 3 | — |
| Domaine de la Lumière | 1 | 3 / 4 | 4 | +2 | 0 | — |
| Domaine de la Lumière | 2 | 3 / 4 | 5 | +2 | 2 | — |
| Domaine de la Lumière | 3 | 3 / 4 | 6 | +2 | 2 | — |
| Domaine de la Lumière | 4 | 4 / 5 | 7 | +2 | 2 | — |
| Domaine de la Lumière | 5 | 4 / 5 | 9 | +3 | 2 | — |
| Domaine de la Lumière | 6 | 4 / 5 | 10 | +3 | 3 | — |
| Domaine de la Lumière | 7 | 4 / 5 | 11 | +3 | 3 | — |
| Domaine de la Lumière | 8 | 4 / 5 | 12 | +3 | 3 | — |
| Domaine de la Lumière | 9 | 4 / 5 | 14 | +4 | 3 | — |
| Domaine de la Lumière | 10 | 5 / 6 | 15 | +4 | 3 | — |
| Domaine de la Ruse | 1 | 3 / 4 | 4 | +2 | 0 | — |
| Domaine de la Ruse | 2 | 3 / 4 | 5 | +2 | 2 | — |
| Domaine de la Ruse | 3 | 3 / 4 | 6 | +2 | 2 | — |
| Domaine de la Ruse | 4 | 4 / 5 | 7 | +2 | 2 | — |
| Domaine de la Ruse | 5 | 4 / 5 | 9 | +3 | 2 | — |
| Domaine de la Ruse | 6 | 4 / 5 | 10 | +3 | 3 | — |
| Domaine de la Ruse | 7 | 4 / 5 | 11 | +3 | 3 | — |
| Domaine de la Ruse | 8 | 4 / 5 | 12 | +3 | 3 | — |
| Domaine de la Ruse | 9 | 4 / 5 | 14 | +4 | 3 | — |
| Domaine de la Ruse | 10 | 5 / 6 | 15 | +4 | 3 | — |
| Domaine de la Vie | 1 | 3 / 4 | 4 | +2 | 0 | — |
| Domaine de la Vie | 2 | 3 / 4 | 5 | +2 | 2 | — |
| Domaine de la Vie | 3 | 3 / 4 | 6 | +2 | 2 | — |
| Domaine de la Vie | 4 | 4 / 5 | 7 | +2 | 2 | — |
| Domaine de la Vie | 5 | 4 / 5 | 9 | +3 | 2 | — |
| Domaine de la Vie | 6 | 4 / 5 | 10 | +3 | 3 | — |
| Domaine de la Vie | 7 | 4 / 5 | 11 | +3 | 3 | — |
| Domaine de la Vie | 8 | 4 / 5 | 12 | +3 | 3 | — |
| Domaine de la Vie | 9 | 4 / 5 | 14 | +4 | 3 | — |
| Domaine de la Vie | 10 | 5 / 6 | 15 | +4 | 3 | — |

## Ce qui est couvert

- Quotas et emplacements lus au niveau choisi, avec héritage de la maîtrise et des ressources.
- Caractéristiques d’historique, choix des niveaux 4 et 8, maximum de 20 et prérequis des dons à leur niveau d’acquisition. La branche directe respecte le +1 à deux caractéristiques prévu par cette BDD ; le don Amélioration propose ses deux options propres.
- Option de Frappe consacrée au niveau 7 ; ressources de Canal divin et d’Éclat sacré actualisées sur la fiche ; Grâce divine au niveau 10.
- Aptitudes et sorts des domaines cumulés aux paliers présents en BDD, avec la correction ciblée du sort Soins de groupe au niveau 9 confirmée par le SRD.
- Sort mineur Lumière accordé par le domaine, maîtrises de Ruse, formations d’armures et d’armes des vocations/domaines.
- DD et attaque de sorts combinant caractéristique finale et maîtrise ; Constitution finale appliquée à tous les PV ; dégâts des sorts mineurs selon le seuil écrit dans leur fiche.
- Enregistrement et relecture des choix de progression, ainsi que compatibilité des personnages 1–3 existants.

## Limites explicites

Tous les sorts de domaine du clerc 1–10 sont reliés après les corrections ciblées autorisées, tracées dans data/spell-link-corrections.json. Les choix de compétence, expertise, élément et rituels des dons sont requis et sauvegardés. Les bonus permanents sont intégrés à la fiche ; les effets conditionnels sont décrits avec leurs paramètres calculés. Les effets conditionnels en partie ne sont pas appliqués automatiquement aux dégâts de chaque attaque. Le téléphone et une application installable sont hors périmètre à la demande de l’utilisateur.
