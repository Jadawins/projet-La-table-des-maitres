export const welcomeText = 'Bienvenue à ma table ! J’ai créé cet espace pour préparer vos aventures et garder vos personnages à portée de main. Le site évolue petit à petit : explorez le grimoire, créez votre héros et faites-moi vos retours. À bientôt autour des dés !';
export const booksNotice = 'Cette application accompagne vos parties et ne remplace pas les livres de règles. Pour profiter de l’ensemble des règles et de leurs explications, nous vous recommandons d’acheter les ouvrages officiels et de soutenir leurs créateurs.';

const features = [
  ['01', 'Personnages', 'Un héros qui vous ressemble', 'Douze classes, 48 sous-classes, espèces, historiques, dons, équipement et choix de sorts. Créez votre personnage du niveau 1 au niveau 20.'],
  ['02', 'Fiches & impression', 'Du compte à la table', 'Enregistrez et retrouvez vos personnages en ligne. Consultez leur fiche par rubriques et téléchargez la feuille de personnage PDF remplie.'],
  ['03', 'Évolution', 'Le prochain niveau vous attend', 'Faites évoluer une fiche existante : points de vie, aptitudes, dons et sorts. Le multiclassage est disponible, jusqu’au niveau total 20.'],
  ['04', 'Suivi en partie', 'Gardez le fil de l’aventure', 'Suivez les PV, les PV temporaires, les réserves prises en charge, les emplacements de sorts, les repos, les états et les sauvegardes contre la mort.'],
  ['05', 'Groupes', 'Une place pour chaque rôle', 'Créez ou rejoignez une table comme joueur ou MJ, rattachez votre personnage et partagez les codes d’invitation adaptés. Le créateur gère les membres et peut supprimer le groupe.'],
  ['06', 'Combat & bestiaire', 'La rencontre prend vie', 'Bestiaire, initiatives, tours, attaques et sorts : choisissez vos dés physiques ou ceux de l’application. Le MJ confirme les cibles, dégâts, soins et états. Retrouvez aussi la concentration et les durées déclarées.'],
  ['07', 'Grimoire', 'La bonne information, au bon moment', 'Recherchez un sort, une classe, une sous-classe, une espèce, un historique, un don ou une pièce d’équipement dans le catalogue utilisé par vos fiches.'],
  ['08', 'Comptes & administration', 'Vos personnages trouvent leur place', 'Inscription et connexion, fiches rattachées à leur compte et espace d’administration : métriques, copie ou transfert d’une fiche vers un compte existant.']
];

export function renderHomeContent({publicPage = false} = {}) {
  const primary = publicPage ? '/inscription.html' : '#nouveau';
  const secondary = publicPage ? '/connexion.html' : '#groupes';
  return `<div class="home-hub${publicPage ? ' home-public' : ''}">
    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-hero-copy">
        <p class="home-kicker"><span aria-hidden="true">✦</span> VOTRE TABLE. VOS HISTOIRES.</p>
        <h1 id="home-title">Vos aventures<br>commencent <em>ici.</em></h1>
        <p class="home-lead">Des premiers dés aux grandes batailles, donnez une place à vos personnages et à votre table.</p>
        <div class="home-actions"><a class="home-button home-button-gold" href="${primary}">${publicPage ? 'Créer mon compte' : 'Créer un personnage'} <span aria-hidden="true">↗</span></a><a class="home-button home-button-outline" href="${secondary}">${publicPage ? 'Ouvrir mon espace' : 'Retrouver mes groupes'} <span aria-hidden="true">→</span></a></div>
        <p class="home-hero-note">Pensé pour vos parties sur ordinateur · D&D 2024</p>
      </div>
      <aside class="home-chapter" aria-label="Le carnet de votre table">
        <div class="home-chapter-top"><span>LE CARNET DE VOTRE TABLE</span><span aria-hidden="true">✧</span></div>
        <p class="home-chapter-number" aria-hidden="true">I</p>
        <p class="home-chapter-title">Un personnage.<br>Une table.<br><em>Mille histoires.</em></p>
        <div class="home-chapter-bottom"><span>CRÉER · RASSEMBLER · JOUER</span><span aria-hidden="true">✦</span></div>
      </aside>
    </section>
    <div class="home-facts" aria-label="La création en quelques chiffres"><p><strong>12</strong><span>classes</span></p><p><strong>48</strong><span>sous-classes</span></p><p><strong>1–20</strong><span>niveaux de personnage</span></p><p class="home-fact-dice"><strong>Vos dés.</strong><span>Votre façon de jouer.</span></p></div>

    <section class="home-section" id="nouveautes" aria-labelledby="home-news-title">
      <div class="home-section-heading"><div><p class="home-kicker">LE JOURNAL DE LA TABLE</p><h2 id="home-news-title">Tout juste dans le grimoire.</h2></div><p>Mise à jour du 2 novembre 2026</p></div>
      <div class="home-news-grid">
        <article class="home-news home-news-featured"><p class="home-badge">NOUVEAU · GROUPES</p><h3>Joueur ou MJ,<br>choisissez votre place.</h3><p>Le rôle se choisit à la création et à l’adhésion, avec un code joueur et un code MJ distincts. La suppression du groupe est aussi disponible, sans supprimer les fiches des membres.</p><span class="home-news-foot">Une table, plusieurs façons de participer.</span></article>
        <article class="home-news"><p class="home-badge">NOUVEAU · SORTS EN COMBAT</p><h3>Vos sorts,<br>le dernier mot au MJ.</h3><p>Proposez un sort depuis votre fiche. Le MJ vérifie sa résolution, les cibles et la dépense. Dés au choix, soins, dégâts, états, concentration et durées : les effets attendent sa confirmation.</p><span class="home-news-foot">Zones et alliés : les cibles sont choisies par le MJ.</span></article>
        <article class="home-news"><p class="home-badge">DÉJÀ DISPONIBLE · ÉVOLUTION</p><h3>Votre héros<br>ne s’arrête pas là.</h3><p>Montez de niveau depuis votre fiche et choisissez, si vous le souhaitez, une autre classe. Retrouvez aussi vos repos, états et ressources dans le suivi en partie.</p><span class="home-news-foot">Jusqu’au niveau total 20.</span></article>
      </div>
    </section>

    <section class="home-section" id="disponible" aria-labelledby="home-features-title">
      <div class="home-section-heading"><div><p class="home-kicker">DÈS MAINTENANT</p><h2 id="home-features-title">De quoi préparer votre prochaine partie.</h2></div><p>Les outils disponibles aujourd’hui.</p></div>
      <div class="home-feature-grid">${features.map(([number,category,title,text]) => `<article class="home-feature"><div class="home-feature-top"><span>${number}</span><p>${category}</p></div><h3>${title}</h3><p>${text}</p></article>`).join('')}</div>
      <aside class="home-dice-note"><span aria-hidden="true">✧</span><div><h3>La main reste autour de la table.</h3><p>Aucun dé ne se lance automatiquement. Pour les attaques et les sorts, vous pouvez changer de méthode à chaque jet. Le MJ confirme les effets et vérifie les règles particulières, les zones et les exceptions.</p></div></aside>
    </section>

    <section class="home-section home-roadmap" id="avenir" aria-labelledby="home-roadmap-title">
      <div class="home-section-heading"><div><p class="home-kicker">LES PROCHAINS CHAPITRES</p><h2 id="home-roadmap-title">L’aventure continue.</h2></div><p>Une direction, pas une date de livraison.<br>Ces outils ne sont pas encore disponibles.</p></div>
      <ol class="home-roadmap-list">
        <li><span class="home-roadmap-step" aria-hidden="true">01</span><div><p class="home-badge">PROCHAINE ÉTAPE</p><h3>Plus de place pour les maîtres du jeu.</h3><p>Enrichir les outils de campagne : préparation des aventures, organisation des séances et suivi de la table au fil des parties.</p></div></li>
        <li><span class="home-roadmap-step" aria-hidden="true">02</span><div><p class="home-badge">À ÉTUDIER</p><h3>Une carte pour vos rencontres.</h3><p>Une carte illustrée et des pions pour vos personnages, alliés et adversaires restent une piste à concevoir ensemble. Le placement des zones est actuellement vérifié à la table.</p></div></li>
        <li><span class="home-roadmap-step" aria-hidden="true">03</span><div><p class="home-badge">PLUS TARD</p><h3>Votre table vous suivra aussi sur téléphone.</h3><p>Une application mobile reste envisagée après la consolidation de l’expérience sur ordinateur. Aucune date ni publication sur les boutiques n’est annoncée.</p></div></li>
      </ol>
    </section>

    <section class="home-creator portal-welcome" aria-labelledby="home-creator-title"><p class="home-kicker">LE MOT DU CRÉATEUR</p><h2 id="home-creator-title">Bienvenue à ma table.</h2><blockquote>${welcomeText}</blockquote><p class="home-signature">Wiwi <span>· Créateur de La Table du Maître</span></p></section>
    <aside class="home-books" aria-labelledby="books-title"><span aria-hidden="true">✦</span><div><h2 id="books-title">Un complément à vos livres.</h2><p>${booksNotice}</p><a href="/sources.html">Consulter les sources et les licences <span aria-hidden="true">↗</span></a></div></aside>
  </div>`;
}
