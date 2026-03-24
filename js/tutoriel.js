/* ================================================================
   TUTORIEL.JS — Guide interactif & recherche
   ================================================================ */

'use strict';

// ─── SÉLECTEURS PAR PAGE (éléments des vraies pages) ─────────
const GUIDES = {
  'creer-personnage': [
    { title: 'Menu Mes Personnages', selector: 'a[href="mes-personnages.html"]',  tip: 'Cliquez sur "Mes Personnages" dans la barre latérale gauche.' },
    { title: 'Bouton Créer',         selector: '.btn-creer, .btn-nouveau-perso',  tip: 'Cliquez sur "Créer un personnage" pour démarrer l\'assistant.' },
    { title: 'Étape 1 — Infos',      selector: '.wizard-step-1, #etape-1',        tip: 'Remplissez le nom, le niveau et l\'alignement de votre personnage.' },
    { title: 'Choix espèce',         selector: '.wizard-step-2, .species-grid',   tip: 'Parcourez les espèces disponibles et cliquez pour sélectionner.' },
    { title: 'Choix classe',         selector: '.wizard-step-3, .class-grid',     tip: 'Choisissez votre classe — chaque classe définit vos capacités de combat et de magie.' },
    { title: 'Caractéristiques',     selector: '.wizard-step-5, .stats-section',  tip: 'Répartissez vos 6 caractéristiques (FOR, DEX, CON, INT, SAG, CHA).' },
    { title: 'Récapitulatif',        selector: '.wizard-step-10, .recap-section', tip: 'Vérifiez toutes vos informations avant de confirmer la création.' },
  ],
  'rejoindre-session': [
    { title: 'Menu Sessions',        selector: 'a[href*="sessions.html?role=joueur"]', tip: 'Cliquez sur "Mes Sessions (Joueur)" dans le menu de gauche.' },
    { title: 'Liste sessions',       selector: '.sessions-grid, #sessions-list',       tip: 'Parcourez les sessions disponibles au recrutement.' },
    { title: 'Filtres',              selector: '.session-filters, .filter-bar',        tip: 'Filtrez par statut : Recrutement, En cours, Terminée.' },
    { title: 'Bouton Rejoindre',     selector: '.btn-rejoindre, .btn-join',            tip: 'Cliquez "Rejoindre" sur une session publique, ou entrez le mot de passe.' },
    { title: 'Associer personnage',  selector: '.select-perso, #perso-select',         tip: 'Choisissez quel personnage vous utilisez pour cette session.' },
  ],
  'bibliotheque': [
    { title: 'Menu Bibliothèque',    selector: 'a[href="bibliotheque.html"]',       tip: 'Cliquez sur "Bibliothèque" dans le menu joueur.' },
    { title: 'Onglets',              selector: '.biblio-tabs, .tab-bar',            tip: 'Naviguez entre Sorts, Classes, Espèces, Historiques, Dons, Équipement.' },
    { title: 'Recherche',            selector: '#search-input, .biblio-search',    tip: 'Tapez un mot-clé pour filtrer le contenu instantanément.' },
    { title: 'Filtres avancés',      selector: '.filter-panel, .filters-section',  tip: 'Filtrez par niveau, école de magie, classe compatible…' },
    { title: 'Fiche détail',         selector: '.card-detail, .biblio-modal',      tip: 'Cliquez sur n\'importe quelle carte pour afficher la fiche complète.' },
  ],
  'combat-joueur': [
    { title: 'Panneau combat',       selector: '#combat-panel, .combat-section',   tip: 'Le panneau Combat apparaît automatiquement quand le MJ lance un combat.' },
    { title: 'Badge tour actif',     selector: '.tour-actif-badge, .tour-badge',   tip: 'Ce badge doré clignotant indique que c\'est votre tour d\'agir.' },
    { title: 'Boutons attaque',      selector: '.btn-attaque, .attack-btn',        tip: 'Cliquez sur une attaque, sélectionnez la cible, entrez votre d20.' },
    { title: 'Gestion des sorts',    selector: '.sorts-section, .spell-panel',     tip: 'Lancez un sort depuis l\'onglet Sorts — les emplacements se consomment automatiquement.' },
    { title: 'Jets de mort',         selector: '.death-saves, .jets-mort',         tip: 'Quand vos PV tombent à 0, utilisez ces dés pour tenter de survivre.' },
  ],
  'combat-mj': [
    { title: 'Nouveau combat',       selector: '.btn-nouveau-combat, #btn-combat', tip: 'Depuis la page session, lancez un nouveau combat.' },
    { title: 'Tracker initiative',   selector: '#initiative-list, .initiative-col',tip: 'L\'initiative est triée automatiquement du plus haut au plus bas.' },
    { title: 'Ajouter monstre',      selector: '.btn-add-participant',             tip: 'Ajoutez des monstres manuellement avec nom, PV, CA et initiative.' },
    { title: 'Tour suivant',         selector: '.btn-tour-suivant',               tip: 'Passez au participant suivant — le joueur est notifié automatiquement.' },
    { title: 'Menu actions ···',     selector: '.btn-menu-actions',               tip: 'Cliquez ··· pour tuer, faire fuir, neutraliser ou modifier les PV.' },
    { title: 'Terminer le combat',   selector: '#btn-terminer',                   tip: 'Choisissez l\'issue du combat et distribuez les XP en un clic.' },
  ],
  'campagne': [
    { title: 'Dashboard MJ',         selector: 'a[href="dashboard-mj.html"]',     tip: 'Accédez au Dashboard MJ depuis la barre latérale.' },
    { title: 'Nouvelle campagne',    selector: '.db-btn-new',                     tip: 'Cliquez + pour créer une nouvelle campagne.' },
    { title: 'Éditeur de blocs',     selector: '#editeur-blocs, .db-editeur',     tip: 'Utilisez les blocs (Rencontre, PNJ, Lieu…) pour structurer votre contenu.' },
    { title: 'Barre d\'outils',      selector: '.db-toolbar',                     tip: 'Choisissez le type de bloc à ajouter depuis la barre d\'outils.' },
    { title: 'Enregistrer',          selector: 'button[onclick*="enregistrerCampagne"]', tip: 'Sauvegardez manuellement ou attendez l\'auto-save de 30s.' },
  ],
  'niveau': [
    { title: 'Barre XP',             selector: '#xp-section, .xp-bar-track',      tip: 'La barre dorée sur votre fiche montre votre progression vers le niveau suivant.' },
    { title: 'Badge level up',       selector: '#levelup-badge',                  tip: 'Ce badge apparaît quand vous pouvez monter de niveau. Cliquez dessus !' },
    { title: 'Wizard niveau',        selector: '#modal-levelup, .niv-wizard',     tip: 'L\'assistant vous guide étape par étape dans la montée de niveau.' },
    { title: 'Distribution XP (MJ)',  selector: '.mj-xp-panel, #mj-xp-joueurs-list', tip: 'Le MJ utilise ce panneau pour distribuer les XP après chaque rencontre.' },
  ],
  'repos': [
    { title: 'Boutons repos',        selector: '.btn-repos-court, .btn-repos-long', tip: 'Proposez un repos depuis votre fiche personnage.' },
    { title: 'Panneau de vote',      selector: '.repos-vote-panel, #vote-repos',    tip: 'Tous les joueurs votent en temps réel pour accepter ou refuser le repos.' },
    { title: 'Panneau MJ',           selector: '.mj-repos-section',                tip: 'Le MJ voit les votes et peut valider, refuser, ou imposer le repos.' },
    { title: 'Résultats repos',      selector: '.repos-result, #mj-repos-result',   tip: 'Les effets du repos (PV, ressources, sorts) sont appliqués automatiquement.' },
  ],
};

// ─── CLASSE GUIDE INTERACTIF ──────────────────────────────────
class TutoGuide {
  constructor(steps) {
    this.steps  = steps;
    this.idx    = 0;
    this._overlay = null;
    this._tooltip = null;
    this._prevEl  = null;
  }

  launch() {
    this._buildUI();
    this._showStep(0);
    document.addEventListener('keydown', this._onKey.bind(this));
  }

  _buildUI() {
    // Overlay
    this._overlay = document.createElement('div');
    this._overlay.className = 'tuto-guide-overlay';
    this._overlay.addEventListener('click', e => {
      if (e.target === this._overlay) this.close();
    });

    // Tooltip
    this._tooltip = document.createElement('div');
    this._tooltip.className = 'tuto-guide-tooltip';
    this._tooltip.innerHTML = `
      <div class="tuto-guide-step-count" id="tg-count"></div>
      <h4 id="tg-title"></h4>
      <p id="tg-tip"></p>
      <div class="tuto-guide-controls">
        <button class="tuto-gc-btn" id="tg-prev">← Préc.</button>
        <button class="tuto-gc-btn next-btn" id="tg-next">Suivant →</button>
        <button class="tuto-gc-close" id="tg-close" title="Fermer">✕</button>
      </div>`;

    document.body.appendChild(this._overlay);
    document.body.appendChild(this._tooltip);

    document.getElementById('tg-prev').addEventListener('click',  () => this.prev());
    document.getElementById('tg-next').addEventListener('click',  () => this.next());
    document.getElementById('tg-close').addEventListener('click', () => this.close());
  }

  _showStep(n) {
    const step = this.steps[n];
    this.idx = n;

    // Retirer spotlight précédent
    if (this._prevEl) {
      this._prevEl.classList.remove('tuto-spotlight');
      this._prevEl = null;
    }

    // Trouver l'élément
    const el = document.querySelector(step.selector);

    // Mettre à jour le tooltip
    document.getElementById('tg-count').textContent = `Étape ${n + 1} / ${this.steps.length}`;
    document.getElementById('tg-title').textContent = step.title || `Étape ${n + 1}`;
    document.getElementById('tg-tip').textContent   = step.tip || '';

    // Boutons nav
    document.getElementById('tg-prev').disabled = (n === 0);
    document.getElementById('tg-next').textContent = n === this.steps.length - 1 ? '✓ Terminer' : 'Suivant →';

    if (el) {
      // Spotlight sur l'élément réel
      el.classList.add('tuto-spotlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this._prevEl = el;
      this._positionTooltip(el);
    } else {
      // Élément non trouvé — tooltip centré
      this._centerTooltip();
    }
  }

  _positionTooltip(el) {
    const rect = el.getBoundingClientRect();
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    const tip  = this._tooltip;

    // Tenter de placer sous l'élément
    let top  = rect.bottom + 12;
    let left = rect.left;

    // Déborder à droite ?
    if (left + 330 > vw - 16) left = vw - 330 - 16;
    if (left < 16) left = 16;

    // Déborder en bas ?
    if (top + 160 > vh - 16) top = rect.top - 160 - 12;
    if (top < 16) top = 16;

    tip.style.top    = `${top}px`;
    tip.style.left   = `${left}px`;
    tip.style.transform = 'none';
  }

  _centerTooltip() {
    const tip = this._tooltip;
    tip.style.top       = '50%';
    tip.style.left      = '50%';
    tip.style.transform = 'translate(-50%, -50%)';
  }

  next() {
    if (this.idx < this.steps.length - 1) this._showStep(this.idx + 1);
    else this.close();
  }

  prev() {
    if (this.idx > 0) this._showStep(this.idx - 1);
  }

  close() {
    if (this._prevEl) {
      this._prevEl.classList.remove('tuto-spotlight');
      this._prevEl = null;
    }
    this._overlay?.remove();
    this._tooltip?.remove();
    document.removeEventListener('keydown', this._onKey.bind(this));
  }

  _onKey(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.next();
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   this.prev();
    if (e.key === 'Escape')                              this.close();
  }
}

// ─── INITIALISATION PAGE ──────────────────────────────────────
function initTutorielPage(pageKey) {
  // Barre de progression
  const steps    = document.querySelectorAll('.tuto-step');
  const total    = steps.length;
  const fillEl   = document.getElementById('tuto-progress-fill');
  const labelEl  = document.getElementById('tuto-progress-label');
  if (fillEl && total > 0) {
    fillEl.style.width = '100%';
    if (labelEl) labelEl.textContent = `${total} étapes`;
  }

  // Bouton Guide interactif
  const btn = document.getElementById('btn-guide');
  if (btn) {
    const guideSteps = GUIDES[pageKey];
    if (guideSteps && guideSteps.length) {
      btn.style.display = 'inline-flex';
      btn.addEventListener('click', () => {
        // Utiliser les vrais sélecteurs si on est sur la vraie page,
        // sinon utiliser les .tuto-step de la page tuto
        const resolved = guideSteps.map((s, i) => {
          const realEl = document.querySelector(s.selector);
          if (realEl) return s;
          // Fallback : cibler les .tuto-step de la page tuto
          const fallbackSel = `.tuto-step[data-step="${i + 1}"]`;
          return { ...s, selector: fallbackSel };
        });
        new TutoGuide(resolved).launch();
      });
    }
  }
}

// ─── RECHERCHE (page index) ───────────────────────────────────
function initSearch() {
  const input = document.getElementById('tuto-search');
  if (!input) return;

  const cards = document.querySelectorAll('.tuto-card[data-search]');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      cards.forEach(c => c.classList.remove('hidden'));
      return;
    }
    cards.forEach(c => {
      const hay = c.dataset.search.toLowerCase();
      c.classList.toggle('hidden', !hay.includes(q));
    });
  });
}

// ─── LANCER LE GUIDE DEPUIS QUERY PARAM ───────────────────────
// Permet ?guide=creer-personnage sur n'importe quelle page
function checkGuideParam() {
  const params = new URLSearchParams(location.search);
  const key    = params.get('guide');
  if (!key || !GUIDES[key]) return;
  // Démarrer le guide après le chargement de la page
  setTimeout(() => {
    const stepsArr = GUIDES[key].map((s, i) => {
      const el = document.querySelector(s.selector);
      return el ? s : { ...s, selector: `.tuto-step[data-step="${i + 1}"]` };
    });
    new TutoGuide(stepsArr).launch();
  }, 800);
}

// ─── AUTO-INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSearch();
  checkGuideParam();
});

// Export pour usage inline depuis les pages tuto
window.TutoGuide         = TutoGuide;
window.initTutorielPage  = initTutorielPage;
window.GUIDES            = GUIDES;
