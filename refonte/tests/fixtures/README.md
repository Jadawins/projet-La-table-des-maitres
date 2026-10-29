# Références de régression

`rules-2024.json` est la référence historique des règles utilisée par les tests et les outils d'audit. Elle ne contient ni compte, ni personnage, ni identifiant MongoDB. Sa présence permet de reproduire les comparaisons et les 3 948 tests historiques sans accès à une BDD de production.

Elle n'est ni importée par le serveur de production ni incluse dans le paquet déployé. Les règles actives sont chargées uniquement dans MongoDB, collection `regles_catalogues`, à la version et l'empreinte indiquées par `access/rules-release.json`. Les autres références de tests documentent les attentes ; elles ne constituent pas des sauvegardes de production.
