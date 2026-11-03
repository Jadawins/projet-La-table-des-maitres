# Objets ajoutés et pop-ups du MJ — 3 novembre 2026

## Objets sur la fiche

Dans **Équipement → Objets ajoutés en partie → Ajouter un objet**, renseigner un nom, une quantité et une description facultative. L’administrateur peut le faire depuis **Administration → Toutes les fiches** ; le joueur peut également gérer sa propre fiche. L’ajout, la modification ou le retrait enregistre la fiche dans le compte propriétaire. Sans connexion, l’objet reste dans le brouillon local.

Les objets acquis sont séparés du matériel de départ. Ils apparaissent sur la fiche et leurs noms/quantités figurent dans l’équipement du PDF. La description reste consultable sur le site ; les textes très longs du PDF peuvent être abrégés selon le comportement existant. Ajouter un objet ne l’équipe pas automatiquement, ne retire pas d’argent et ne change pas ses bonus, armes ou calculs de défense : ses effets particuliers se vérifient à la table.

Le champ facultatif `inventoryItems` est validé, conservé pendant l’évolution et le multiclassage, et préservé lorsqu’un ancien client l’omet. Un retrait explicite utilise une liste vide ou un identifiant d’objet précis. Le contrôle de révision empêche une ancienne fiche d’écraser une modification récente. Limites : 100 objets, nom de 120 caractères, quantité entière de 1 à 9 999, description de 2 000 caractères, liste sérialisée de 32 Kio maximum. Les limites globales de sauvegarde restent applicables.

## Envoyer un pop-up

Dans **Mes groupes → Ouvrir le groupe → Messages privés du MJ**, un MJ coche un ou plusieurs autres membres, écrit son message puis clique **Envoyer le message**. Aucun destinataire n’est coché par défaut. Un créateur ayant choisi le rôle Joueur n’obtient pas le droit d’envoyer ; l’administration globale ne remplace pas le rôle MJ dans un groupe.

Les destinataires reçoivent un pop-up au centre de l’atelier, même s’ils consultent une fiche ou le grimoire. Le site vérifie les nouveaux messages environ toutes les trois secondes pendant que sa page est visible, et au retour du focus. Il attend la fermeture d’une autre fenêtre du site plutôt que de superposer les dialogues. Les joueurs absents retrouveront les messages à leur prochaine ouverture de l’atelier. Il n’y a ni notification du système d’exploitation, ni e-mail, ni SMS.

**J’ai lu** confirme la lecture pour ce destinataire uniquement. **Relire plus tard** ou Échap ferme le pop-up sans confirmer sa lecture et évite de le réafficher automatiquement pendant cette visite. Les suivants peuvent toujours apparaître. Le bouton **Messages du MJ** permet de retrouver un message non lu ; l’historique se consulte dans le groupe. Le MJ voit les confirmations de ses propres envois. L’envoi à plusieurs personnes ne révèle pas la liste des autres destinataires aux lecteurs.

Les messages sont persistés dans `messages_groupes_refonte`. L’identifiant d’envoi unique permet de reprendre une réponse réseau perdue sans créer une seconde copie. Les confirmations simultanées sont protégées par une révision du document. L’expéditeur et les destinataires choisis peuvent consulter le message ; les autres membres et les autres MJ non choisis ne le peuvent pas. Chaque accès vérifie l’appartenance actuelle à un groupe actif : départ, exclusion, archivage et suppression révoquent l’accès par API et la réception des nouveaux pop-ups. Un message déjà reçu ne peut pas être retiré de la mémoire de son lecteur.

Les messages sont du texte, jamais du HTML exécutable. Le corps est limité à 6 000 caractères ; l’envoi est limité à 30 demandes par minute et compte/adresse. L’historique est paginé par 50 messages. Le fil global fournit vingt messages non lus à la fois et parcourt les pages si les précédents sont différés. Il utilise les groupes accessibles dans la liste courante, limitée à 200 groupes comme l’espace de groupes existant.

Les vérifications utilisent des comptes simulés et des collections MongoDB isolées. Aucun message de contrôle n’est envoyé à une personne réelle et aucun personnage existant n’est enrichi automatiquement.
