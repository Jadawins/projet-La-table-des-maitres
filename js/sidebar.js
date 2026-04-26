const SIDEBAR_HTML = `
<div class="sidebar-header sidebar-header-flex">
  <button class="toggle-glow" onclick="toggleSidebar()" aria-label="Menu">
    <img id="book-icon" src="assets/icone/livremagie.png" alt="Icône Livre" class="icon-book" />
  </button>
  <a href="param.html" class="sidebar-settings-button" aria-label="Paramètres">⚙️</a>
</div>
<div class="sidebar-content">
  <div class="sidebar-nav-area">
    <h2><span class="sidebar-label">Menu MJ</span></h2>
    <ul class="sidebar-menu">
      <li><a href="dashboard-mj.html"><i class="fa-solid fa-gauge-high"></i><span class="sidebar-label"> Tableau de bord MJ</span></a></li>
      <li><a href="sessions.html?role=mj"><i class="fa-solid fa-scroll"></i><span class="sidebar-label"> Mes Sessions (MJ)</span></a></li>
      <li><a href="sessions.html?statut=terminee"><i class="fa-solid fa-clock-rotate-left"></i><span class="sidebar-label"> Historique</span></a></li>
      <li><a href="campagne.html"><i class="fa-solid fa-book-skull"></i><span class="sidebar-label"> Mes Campagnes</span></a></li>
      <li><a href="creer-objet-magique.html"><i class="fa-solid fa-hat-wizard"></i><span class="sidebar-label"> Créer un objet magique</span></a></li>
      <li><a href="creer-monstre.html"><i class="fa-solid fa-skull-crossbones"></i><span class="sidebar-label"> Mes Monstres</span></a></li>
      <li><a href="createrace.html"><i class="fa-solid fa-dna"></i><span class="sidebar-label"> Créer une Race</span></a></li>
    </ul>
    <h2><span class="sidebar-label">Menu Joueurs</span></h2>
    <ul class="sidebar-menu">
      <li><a href="mes-personnages.html"><i class="fa-solid fa-user-shield"></i><span class="sidebar-label"> Mes Personnages</span></a></li>
      <li><a href="sessions.html?role=joueur"><i class="fa-solid fa-dice-d20"></i><span class="sidebar-label"> Mes Sessions (Joueur)</span></a></li>
      <li><a href="bibliotheque.html"><i class="fa-solid fa-book-open"></i><span class="sidebar-label"> Bibliothèque</span></a></li>
      <li><a href="tutoriel.html"><i class="fa-solid fa-graduation-cap"></i><span class="sidebar-label"> Tutoriel</span></a></li>
    </ul>
  </div>
  <div class="sidebar-footer">
    <a href="home.html"><i class="fa-solid fa-house"></i><span class="sidebar-label"> Page d'accueil site</span></a>
  </div>
</div>`;

// Injecte le HTML dans l'élément #sidebar si vide
(function injectSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar && !sidebar.innerHTML.trim()) sidebar.innerHTML = SIDEBAR_HTML;
  // Si le DOM n'est pas encore prêt
  if (!sidebar) {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.getElementById('sidebar');
      if (s && !s.innerHTML.trim()) s.innerHTML = SIDEBAR_HTML;
    });
  }
})();

function _getSidebarOverlay() {
  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:999;display:none;';
    overlay.addEventListener('click', () => toggleSidebar());
    document.body.appendChild(overlay);
  }
  return overlay;
}

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const openBookIcon = document.getElementById('book-icon');
  const closedBookButton = document.getElementById('closed-book-button');
  const isMobile = window.innerWidth <= 768;
  const overlay = _getSidebarOverlay();

  if (sidebar.classList.contains('hidden')) {
    sidebar.classList.remove('hidden');
    if (closedBookButton) closedBookButton.classList.add('hidden');
    if (openBookIcon) openBookIcon.src = 'assets/icone/livremagie.png';
    if (isMobile) overlay.style.display = 'block';
  } else {
    sidebar.classList.add('hidden');
    if (closedBookButton) closedBookButton.classList.remove('hidden');
    if (openBookIcon) openBookIcon.src = 'assets/icone/livrefermer.png';
    overlay.style.display = 'none';
  }
}

// Sur mobile, la sidebar démarre fermée
document.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    const closedBookButton = document.getElementById('closed-book-button');
    if (sidebar) sidebar.classList.add('hidden');
    if (closedBookButton) closedBookButton.classList.remove('hidden');
  }
});
  