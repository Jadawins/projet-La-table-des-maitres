import {renderHomeContent} from '../maquette/home-content.mjs';

export function publicHome() {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#131019">
  <meta name="description" content="Créez vos personnages D&D 2024, rassemblez votre groupe et préparez vos combats. Découvrez les nouveautés et les prochains chapitres de La Table du Maître.">
  <title>Accueil · La Table du Maître</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="stylesheet" href="/refonte.css">
  <link rel="stylesheet" href="/home.css">
  <script src="/refonte.js" defer></script>
</head>
<body>
  <a class="skip" href="#main">Aller au contenu</a>
  <div class="page">
    <header><a class="brand" href="/" aria-label="La Table du Maître, accueil"><span class="brand-mark" aria-hidden="true">✧</span><span>La Table<br><b>du Maître</b></span></a><div class="header-actions"><a class="login-link" href="/inscription.html">Créer un compte</a><a class="login-link" href="/connexion.html">Se connecter <span aria-hidden="true">→</span></a></div></header>
    <nav class="home-public-nav" aria-label="Découvrir le site"><a href="#nouveautes">Les nouveautés</a><a href="#disponible">Les outils disponibles</a><a href="#avenir">Les prochains chapitres</a></nav>
    <main id="main">${renderHomeContent({publicPage:true})}</main>
    <footer><span>LA TABLE DU MAÎTRE</span><p>Votre table. Vos histoires.</p><a href="/sources.html">Sources et licences</a></footer>
  </div>
</body>
</html>
`;
}
