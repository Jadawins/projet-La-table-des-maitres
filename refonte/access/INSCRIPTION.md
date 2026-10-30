# Inscription des joueurs

Les liens « Créer un compte » sont présents sur l’accueil public et sur la page de connexion. `/inscription.html` propose un pseudo, une adresse e-mail, un mot de passe de 12 à 128 caractères et sa confirmation. Google et Discord utilisent les mêmes parcours OAuth que la connexion. L’ancienne URL `/signup.html` redirige vers ce formulaire.

`POST /auth/signup` valide les champs sur le serveur et appelle uniquement Supabase Auth avec la clé publique déjà configurée. Seul le pseudo est transmis comme métadonnée ; les champs de rôle reçus du navigateur ne sont jamais repris. Aucun compte administrateur ne peut être obtenu par une inscription.

Lorsque la confirmation d’adresse est activée, aucune session du site n’est ouverte avant celle-ci. Un cookie `__Host-` HttpOnly/Secure/SameSite=Lax conserve pendant 24 heures le vérificateur PKCE aléatoire, sans mot de passe ni jeton de session. La preuve est contrôlée par Supabase à l’échange du code ; elle ne dépend pas de la mémoire du serveur et survit à son redémarrage. Une tentative OAuth abandonnée est invalidée lorsqu’une inscription commence. Les cookies temporaires sont supprimés à l’ouverture de la session.

Le lien de confirmation reprend `/home.html`, déjà utilisé par les retours OAuth, puis la page de connexion échange le code côté serveur. Le jeton obtenu doit encore être vérifié auprès de Supabase avant de créer le cookie de session. Si le lien est ouvert dans un autre navigateur, le joueur peut confirmer son adresse puis se connecter par e-mail et mot de passe, sans transfert du vérificateur entre appareils.

Les erreurs restent lisibles et permettent un nouvel essai. Les mots de passe ne sont pas conservés dans le stockage du navigateur et sont effacés du formulaire après réussite. Les réponses d’inscription ne révèlent pas si une adresse est déjà membre. Les inscriptions exigent l’origine du site et disposent d’un quota distinct de trois demandes par heure et par adresse IP ; les limites du fournisseur restent également applicables.

Les comptes MongoDB du répertoire sont alimentés lors de la première connexion vérifiée, et non pendant l’attente de confirmation. Les identités existantes et les personnages restent inchangés.

## Configuration et contrôles

Le contrôle en lecture seule de `/auth/v1/settings` le 30 octobre 2026 confirme que les inscriptions par e-mail, Google et Discord sont activées et que l’e-mail doit être confirmé. L’URL de retour reprend celle de la connexion existante. Aucune clé de service ni modification du projet Supabase n’est nécessaire pour le formulaire.

Les tests automatisés utilisent un fournisseur d’identité et une boîte mail simulés, sans création de compte réel ni envoi d’e-mail externe. Ils couvrent la preuve PKCE, le redémarrage, les cookies, les refus d’origine et de privilège, les doublons, les validations et limitations, les erreurs, la confirmation et la connexion depuis un autre navigateur. La réception d’un véritable mail de confirmation doit être vérifiée lors d’une première inscription réelle ; elle dépend de la configuration d’envoi du projet Supabase.

Références : [authentification par mot de passe](https://supabase.com/docs/guides/auth/passwords), [flux PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [paramètres de l’inscription dans Supabase Auth](https://github.com/supabase/auth/blob/master/internal/api/signup.go).
