/* =============================================================
   BIBLIOTHÈQUE — JS principal (vanilla)
   ============================================================= */

const API = 'https://myrpgtable.fr/api';
const PER_PAGE = 24;

// État global
const state = {
  onglet: 'sorts',
  recherche: '',
  filtres: {},
  data: [],
  page: 1,
  correspondances: []
};

// ─── DEBOUNCE ────────────────────────────────────────────────
function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ─── CHARGEMENT DES CORRESPONDANCES (tooltips) ───────────────
async function chargerCorrespondances() {
  try {
    const res = await fetch(`${API}/GetCorrespondances`);
    state.correspondances = await res.json();
  } catch (e) {
    state.correspondances = [];
  }
}

function appliquerTooltips(texte) {
  if (!texte || !state.correspondances.length) return texte;
  let result = texte;
  for (const c of state.correspondances) {
    const regex = new RegExp(`\\b${c.nom_affiche.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    result = result.replace(regex, `<span data-tooltip="${c.description_courte || c.nom_officiel}">${c.nom_affiche}</span>`);
  }
  return result;
}

// ─── ONGLETS ─────────────────────────────────────────────────
const ONGLETS = ['sorts', 'classes', 'especes', 'backgrounds', 'dons', 'equipement', 'glossaire'];

function changerOnglet(onglet) {
  state.onglet = onglet;
  state.page = 1;
  state.filtres = {};
  document.querySelectorAll('.biblio-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === onglet));
  renderFiltres();
  chargerDonnees();
}

// ─── FILTRES DYNAMIQUES PAR ONGLET ───────────────────────────
function renderFiltres() {
  const zone = document.getElementById('biblio-filters');
  zone.innerHTML = '';

  if (state.onglet === 'sorts') {
    zone.innerHTML = `
      <select id="f-niveau" title="Niveau"><option value="">Tous les niveaux</option>
        ${[0,1,2,3,4,5,6,7,8,9].map(n => `<option value="${n}">${n === 0 ? 'Sort mineur' : 'Niveau ' + n}</option>`).join('')}
      </select>
      <select id="f-ecole" title="École">
        <option value="">Toutes les écoles</option>
        ${['Abjuration','Divination','Enchantement','Évocation','Illusion','Invocation','Nécromancie','Transmutation'].map(e => `<option value="${e}">${e}</option>`).join('')}
      </select>
      <select id="f-classe" title="Classe">
        <option value="">Toutes les classes</option>
        ${['Barbare','Barde','Clerc','Druide','Ensorceleur','Guerrier','Magicien','Moine','Occultiste','Paladin','Rôdeur','Roublard'].map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <div class="filter-group"><input type="checkbox" id="f-concentration"><label for="f-concentration">Concentration</label></div>
      <div class="filter-group"><input type="checkbox" id="f-rituel"><label for="f-rituel">Rituel</label></div>
    `;
    document.getElementById('f-niveau').addEventListener('change', e => { state.filtres.niveau = e.target.value; state.page = 1; chargerDonnees(); });
    document.getElementById('f-ecole').addEventListener('change', e => { state.filtres.ecole = e.target.value; state.page = 1; chargerDonnees(); });
    document.getElementById('f-classe').addEventListener('change', e => { state.filtres.classe = e.target.value; state.page = 1; chargerDonnees(); });
    document.getElementById('f-concentration').addEventListener('change', e => { state.filtres.concentration = e.target.checked ? 'true' : ''; state.page = 1; chargerDonnees(); });
    document.getElementById('f-rituel').addEventListener('change', e => { state.filtres.rituel = e.target.checked ? 'true' : ''; state.page = 1; chargerDonnees(); });
  }

  if (state.onglet === 'dons') {
    zone.innerHTML = `
      <select id="f-categorie-don" title="Catégorie">
        <option value="">Toutes catégories</option>
        ${['origine','general','competence','combat','magie'].map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    `;
    document.getElementById('f-categorie-don').addEventListener('change', e => { state.filtres.categorie = e.target.value; state.page = 1; chargerDonnees(); });
  }

  if (state.onglet === 'equipement') {
    zone.innerHTML = `
      <select id="f-type-equip" title="Type">
        <option value="armes">Armes</option>
        <option value="armures">Armures</option>
      </select>
      <select id="f-categorie-equip" title="Catégorie"><option value="">Toutes catégories</option></select>
    `;
    state.filtres.typeEquip = 'armes';
    document.getElementById('f-type-equip').addEventListener('change', e => {
      state.filtres.typeEquip = e.target.value;
      state.filtres.categorie = '';
      state.page = 1;
      chargerDonnees();
    });
    document.getElementById('f-categorie-equip').addEventListener('change', e => { state.filtres.categorie = e.target.value; state.page = 1; chargerDonnees(); });
  }

  if (state.onglet === 'glossaire') {
    zone.innerHTML = `
      <select id="f-categorie-glossaire" title="Catégorie">
        <option value="">Toutes catégories</option>
        ${['mecanique','etat','action','deplacement','combat','magie','zone_effet','danger','attitude'].map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    `;
    document.getElementById('f-categorie-glossaire').addEventListener('change', e => { state.filtres.categorie = e.target.value; state.page = 1; chargerDonnees(); });
  }
}

// ─── CHARGEMENT DES DONNÉES ───────────────────────────────────
async function chargerDonnees() {
  afficherLoading();
  try {
    let url = '';
    const params = new URLSearchParams();
    if (state.recherche) params.set('recherche', state.recherche);

    switch (state.onglet) {
      case 'sorts':
        if (state.filtres.niveau !== undefined && state.filtres.niveau !== '') params.set('niveau', state.filtres.niveau);
        if (state.filtres.ecole) params.set('ecole', state.filtres.ecole);
        if (state.filtres.classe) params.set('classe', state.filtres.classe);
        if (state.filtres.concentration) params.set('concentration', state.filtres.concentration);
        if (state.filtres.rituel) params.set('rituel', state.filtres.rituel);
        url = `${API}/GetSorts2024?${params}`;
        break;
      case 'classes':
        url = `${API}/GetClasses2024?${params}`;
        break;
      case 'especes':
        url = `${API}/GetEspeces2024?${params}`;
        break;
      case 'backgrounds':
        url = `${API}/GetBackgrounds2024?${params}`;
        break;
      case 'dons':
        if (state.filtres.categorie) params.set('categorie', state.filtres.categorie);
        url = `${API}/GetDons2024?${params}`;
        break;
      case 'equipement': {
        if (state.filtres.categorie) params.set('categorie', state.filtres.categorie);
        const endpoint = state.filtres.typeEquip === 'armures' ? 'GetArmures2024' : 'GetArmes2024';
        url = `${API}/${endpoint}?${params}`;
        break;
      }
      case 'glossaire':
        if (state.filtres.categorie) params.set('categorie', state.filtres.categorie);
        url = `${API}/GetGlossaire?${params}`;
        break;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();

    // Mettre à jour catégories armes/armures dynamiquement
    if (state.onglet === 'equipement') {
      const cats = [...new Set(state.data.map(i => i.categorie).filter(Boolean))];
      const sel = document.getElementById('f-categorie-equip');
      if (sel) {
        const current = sel.value;
        sel.innerHTML = `<option value="">Toutes catégories</option>${cats.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c.replace(/_/g, ' ')}</option>`).join('')}`;
      }
    }

    renderGrille();
  } catch (e) {
    console.error('Erreur chargement:', e);
    afficherErreur(e.message);
  }
}

// ─── AFFICHAGE GRILLE ─────────────────────────────────────────
function renderGrille() {
  const debut = (state.page - 1) * PER_PAGE;
  const pageData = state.data.slice(debut, debut + PER_PAGE);

  const grille = document.getElementById('biblio-grille');
  const count = document.getElementById('biblio-count');

  count.textContent = `${state.data.length} résultat${state.data.length > 1 ? 's' : ''}`;

  if (!state.data.length) {
    grille.innerHTML = `
      <div class="biblio-empty" style="grid-column:1/-1">
        <i class="fa-solid fa-book-open"></i>
        <p>Aucun résultat trouvé.</p>
      </div>`;
    document.getElementById('biblio-pagination').innerHTML = '';
    return;
  }

  grille.innerHTML = pageData.map((item, i) => renderCarte(item, debut + i)).join('');
  grille.querySelectorAll('.biblio-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.idx);
      ouvrirModal(state.data[idx]);
    });
  });

  renderPagination();
}

function renderCarte(item, idx) {
  switch (state.onglet) {
    case 'sorts': return carteSort(item, idx);
    case 'classes': return carteClasse(item, idx);
    case 'especes': return carteEspece(item, idx);
    case 'backgrounds': return carteBackground(item, idx);
    case 'dons': return carteDon(item, idx);
    case 'equipement': return carteEquipement(item, idx);
    case 'glossaire': return carteGlossaire(item, idx);
    default: return '';
  }
}

function carteSort(s, idx) {
  const niveauLabel = s.niveau === 0 ? 'Sort mineur' : `Niveau ${s.niveau}`;
  const tags = [];
  if (s.concentration) tags.push('<span class="card-tag">Concentration</span>');
  if (s.rituel) tags.push('<span class="card-tag">Rituel</span>');
  if (Array.isArray(s.classes)) s.classes.slice(0, 3).forEach(c => tags.push(`<span class="card-tag gold">${c}</span>`));
  return `<div class="biblio-card" data-idx="${idx}">
    <p class="card-title">${s.nom || '—'}</p>
    <p class="card-subtitle">${niveauLabel} · ${s.ecole || ''}</p>
    <div class="card-tags">${tags.join('')}</div>
    <p class="card-desc">${s.description ? s.description.substring(0, 120) + '…' : ''}</p>
  </div>`;
}

function carteClasse(c, idx) {
  const de = c.de_vie ? `${c.de_vie.type}` : '';
  return `<div class="biblio-card" data-idx="${idx}">
    <p class="card-title">${c.nom || '—'}</p>
    <p class="card-subtitle">${de ? 'Dé de vie : ' + de : ''}</p>
    <div class="card-tags">
      ${(c.sauvegardes_maitrise || []).map(s => `<span class="card-tag gold">${s}</span>`).join('')}
    </div>
  </div>`;
}

function carteEspece(e, idx) {
  const taille = e.taille ? e.taille.categorie : '';
  return `<div class="biblio-card" data-idx="${idx}">
    <p class="card-title">${e.nom || '—'}</p>
    <p class="card-subtitle">Taille ${taille} · Vitesse ${e.vitesse || '?'}</p>
    <p class="card-desc">${e.description ? e.description.substring(0, 120) + '…' : ''}</p>
    <div class="card-tags">
      ${(e.traits || []).slice(0, 3).map(t => `<span class="card-tag">${t.nom}</span>`).join('')}
    </div>
  </div>`;
}

function carteBackground(b, idx) {
  return `<div class="biblio-card" data-idx="${idx}">
    <p class="card-title">${b.nom || '—'}</p>
    <p class="card-subtitle">${b.don ? 'Don : ' + b.don : ''}</p>
    <p class="card-desc">${b.description ? b.description.substring(0, 120) + '…' : ''}</p>
    <div class="card-tags">
      ${(b.competences || []).map(c => `<span class="card-tag gold">${c}</span>`).join('')}
    </div>
  </div>`;
}

function carteDon(d, idx) {
  return `<div class="biblio-card" data-idx="${idx}">
    <p class="card-title">${d.nom || '—'}</p>
    <p class="card-subtitle">${d.categorie || ''}</p>
    <p class="card-desc">${d.description ? d.description.substring(0, 120) + '…' : ''}</p>
  </div>`;
}

function carteEquipement(e, idx) {
  const isArme = state.filtres.typeEquip !== 'armures';
  const detail = isArme
    ? (e.degats ? `${e.degats.de || ''} ${e.degats.type || ''}` : '')
    : (e.classe_armure ? (typeof e.classe_armure === 'object' ? `+${e.classe_armure.bonus}` : `CA ${e.classe_armure.base || ''}`) : '');
  const prix = e.prix ? `${e.prix.quantite} ${e.prix.monnaie}` : '';
  return `<div class="biblio-card" data-idx="${idx}">
    <p class="card-title">${e.nom || '—'}</p>
    <p class="card-subtitle">${e.categorie ? e.categorie.replace(/_/g, ' ') : ''}</p>
    <div class="card-tags">
      ${detail ? `<span class="card-tag gold">${detail}</span>` : ''}
      ${prix ? `<span class="card-tag">${prix}</span>` : ''}
      ${e.poids ? `<span class="card-tag">${e.poids} kg</span>` : ''}
    </div>
  </div>`;
}

function carteGlossaire(g, idx) {
  return `<div class="biblio-card" data-idx="${idx}">
    <p class="card-title">${g.nom || '—'}</p>
    <p class="card-subtitle">${g.categorie || ''}</p>
    <p class="card-desc">${g.description ? g.description.substring(0, 120) + '…' : ''}</p>
  </div>`;
}

// ─── PAGINATION ───────────────────────────────────────────────
function renderPagination() {
  const total = Math.ceil(state.data.length / PER_PAGE);
  const zone = document.getElementById('biblio-pagination');
  if (total <= 1) { zone.innerHTML = ''; return; }

  const pages = [];
  pages.push(`<button ${state.page === 1 ? 'disabled' : ''} onclick="goPage(${state.page - 1})">‹</button>`);
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - state.page) <= 2) {
      pages.push(`<button class="${i === state.page ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`);
    } else if (Math.abs(i - state.page) === 3) {
      pages.push('<button disabled>…</button>');
    }
  }
  pages.push(`<button ${state.page === total ? 'disabled' : ''} onclick="goPage(${state.page + 1})">›</button>`);
  zone.innerHTML = pages.join('');
}

window.goPage = function(p) {
  state.page = p;
  renderGrille();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ─── MODAL ────────────────────────────────────────────────────
function ouvrirModal(item) {
  const overlay = document.getElementById('modal-overlay');
  const body = document.getElementById('modal-body');
  body.innerHTML = renderModalContent(item);
  overlay.classList.remove('hidden');
}

function fermerModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function renderModalContent(item) {
  switch (state.onglet) {
    case 'sorts': return modalSort(item);
    case 'classes': return modalClasse(item);
    case 'especes': return modalEspece(item);
    case 'backgrounds': return modalBackground(item);
    case 'dons': return modalDon(item);
    case 'equipement': return modalEquipement(item);
    case 'glossaire': return modalGlossaire(item);
    default: return `<pre>${JSON.stringify(item, null, 2)}</pre>`;
  }
}

function modalSort(s) {
  const niveauLabel = s.niveau === 0 ? 'Sort mineur' : `Niveau ${s.niveau}`;
  const comp = s.composantes ? Object.entries(s.composantes).filter(([,v]) => v).map(([k]) => k).join(', ') : '';
  const degatsHtml = Array.isArray(s.degats) ? s.degats.map(d => `${d.valeur || ''} ${d.type || ''}`).join(' + ') : '';
  return `
    <p class="modal-title">${s.nom}</p>
    <p class="modal-subtitle">${niveauLabel} · ${s.ecole || ''}</p>
    <div class="modal-tags">
      ${s.concentration ? '<span class="card-tag">Concentration</span>' : ''}
      ${s.rituel ? '<span class="card-tag">Rituel</span>' : ''}
      ${(s.classes || []).map(c => `<span class="card-tag gold">${c}</span>`).join('')}
    </div>
    <div class="modal-section">
      <h3>Incantation</h3>
      <p>⏱ ${s.temps_incantation || '—'} &nbsp;|&nbsp; 📏 ${s.portee || '—'} &nbsp;|&nbsp; ⏳ ${s.duree || '—'}</p>
      ${comp ? `<p>Composantes : ${comp}</p>` : ''}
    </div>
    ${s.zone ? `<div class="modal-section"><h3>Zone d'effet</h3><p>${s.zone.forme || ''} · ${s.zone.rayon_m ? s.zone.rayon_m + ' m' : ''}</p></div>` : ''}
    ${s.sauvegarde ? `<div class="modal-section"><h3>Jet de sauvegarde</h3><p>${s.sauvegarde.type || ''}</p></div>` : ''}
    ${degatsHtml ? `<div class="modal-section"><h3>Dégâts</h3><p>${degatsHtml}</p></div>` : ''}
    <div class="modal-section"><h3>Description</h3><p>${appliquerTooltips(s.description) || '—'}</p></div>
    ${s.description_superieur ? `<div class="modal-section"><h3>Aux niveaux supérieurs</h3><p>${s.description_superieur}</p></div>` : ''}
  `;
}

function modalClasse(c) {
  const data = c._full || c;
  const n0 = data.niveaux?.['0'] || {};
  const competences = n0.competences_choisies;
  return `
    <p class="modal-title">${data.nom}</p>
    <p class="modal-subtitle">Source : ${data.source || 'PHB 2024'}</p>
    <div class="modal-section">
      <h3>Informations de base</h3>
      <p>Dé de vie : ${n0.de_vie?.type || '—'}</p>
      <p>Caractéristique principale : ${n0.caracteristique_principale || '—'}</p>
      <p>Jets de sauvegarde : ${(n0.sauvegardes_maitrise || []).join(', ')}</p>
    </div>
    ${competences ? `<div class="modal-section"><h3>Compétences (${competences.nombre} au choix)</h3><p>${competences.options?.join(', ') || ''}</p></div>` : ''}
    <div class="modal-section">
      <h3>Maîtrises d'armures</h3>
      <p>${(n0.maitrises_armures || []).join(', ') || '—'}</p>
    </div>
    <div class="modal-section">
      <h3>Maîtrises d'armes</h3>
      <p>${(n0.maitrises_armes || []).join(', ') || '—'}</p>
    </div>
  `;
}

function modalEspece(e) {
  return `
    <p class="modal-title">${e.nom}</p>
    <p class="modal-subtitle">Taille ${e.taille?.categorie || '?'} · Vitesse ${e.vitesse || '?'} m</p>
    <div class="modal-section"><h3>Description</h3><p>${e.description || '—'}</p></div>
    ${e.taille?.details ? `<div class="modal-section"><h3>Taille</h3><p>${e.taille.details}</p></div>` : ''}
    ${e.traits?.length ? `<div class="modal-section"><h3>Traits raciaux</h3>${e.traits.map(t => `<p><strong>${t.nom}</strong> — ${appliquerTooltips(t.description)}</p>`).join('')}</div>` : ''}
    ${e.sorts_innes?.length ? `<div class="modal-section"><h3>Sorts innés</h3><p>${e.sorts_innes.map(s => s.nom || s).join(', ')}</p></div>` : ''}
    ${e.resistances?.length ? `<div class="modal-section"><h3>Résistances</h3><p>${e.resistances.join(', ')}</p></div>` : ''}
  `;
}

function modalBackground(b) {
  return `
    <p class="modal-title">${b.nom}</p>
    <p class="modal-subtitle">Historique · PHB 2024</p>
    <div class="modal-section"><h3>Description</h3><p>${b.description || '—'}</p></div>
    <div class="modal-section">
      <h3>Maîtrises</h3>
      <p>Compétences : ${(b.competences || []).join(', ')}</p>
      <p>Outils : ${(b.outils || []).join(', ') || '—'}</p>
      <p>Langues : ${(b.langues || []).join(', ') || '—'}</p>
    </div>
    ${b.aptitude ? `<div class="modal-section"><h3>${b.aptitude.nom}</h3><p>${b.aptitude.description}</p></div>` : ''}
    ${b.equipement?.length ? `<div class="modal-section"><h3>Équipement de départ</h3><ul>${b.equipement.map(eq => `<li>${eq.quantite}× ${eq.nom}</li>`).join('')}</ul></div>` : ''}
  `;
}

function modalDon(d) {
  const prereq = d.prerequis;
  const prereqTexte = prereq ? Object.entries(prereq).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(', ') : '';
  return `
    <p class="modal-title">${d.nom}</p>
    <p class="modal-subtitle">Catégorie : ${d.categorie || '—'}</p>
    ${prereqTexte ? `<div class="modal-section"><h3>Prérequis</h3><p>${prereqTexte}</p></div>` : ''}
    <div class="modal-section"><h3>Description</h3><p>${d.description || '—'}</p></div>
    ${d.effets?.length ? `<div class="modal-section"><h3>Effets</h3><ul>${d.effets.map(ef => `<li>${typeof ef === 'string' ? ef : (ef.type + ' : ' + (ef.valeur || ''))}</li>`).join('')}</ul></div>` : ''}
  `;
}

function modalEquipement(e) {
  const isArme = state.filtres.typeEquip !== 'armures';
  const prixTexte = e.prix ? `${e.prix.quantite} ${e.prix.monnaie}` : '—';
  return `
    <p class="modal-title">${e.nom}</p>
    <p class="modal-subtitle">${e.categorie ? e.categorie.replace(/_/g, ' ') : ''}</p>
    <div class="modal-section">
      ${isArme && e.degats ? `<h3>Dégâts</h3><p>${e.degats.de || ''} ${e.degats.type || ''} ${e.degats.polyvalente ? '(polyvalente ' + e.degats.polyvalente + ')' : ''}</p>` : ''}
      ${!isArme && e.classe_armure ? `<h3>Classe d'armure</h3><p>${typeof e.classe_armure === 'object' ? JSON.stringify(e.classe_armure) : e.classe_armure}</p>` : ''}
      <h3>Caractéristiques</h3>
      <p>Poids : ${e.poids || '—'} kg &nbsp;|&nbsp; Prix : ${prixTexte}</p>
      ${e.force_min ? `<p>Force minimum : ${e.force_min}</p>` : ''}
      ${e.discretion ? `<p>Discrétion : ${e.discretion}</p>` : ''}
    </div>
    ${isArme && e.proprietes?.length ? `<div class="modal-section"><h3>Propriétés</h3><p>${e.proprietes.join(', ')}</p></div>` : ''}
    ${isArme && e.botte ? `<div class="modal-section"><h3>Botte</h3><p>${e.botte}</p></div>` : ''}
  `;
}

function modalGlossaire(g) {
  return `
    <p class="modal-title">${g.nom}</p>
    <p class="modal-subtitle">Catégorie : ${g.categorie || '—'}</p>
    <div class="modal-section"><h3>Description</h3><p>${g.description || '—'}</p></div>
    ${g.effets?.length ? `<div class="modal-section"><h3>Effets mécaniques</h3><ul>${g.effets.map(ef => `<li>${ef.type || ''} ${ef.detail || ef.cible || ''}</li>`).join('')}</ul></div>` : ''}
    ${g.lire_aussi?.length ? `<div class="modal-section"><h3>Voir aussi</h3><p>${g.lire_aussi.join(', ')}</p></div>` : ''}
  `;
}

// ─── ÉTATS UI ─────────────────────────────────────────────────
function afficherLoading() {
  document.getElementById('biblio-grille').innerHTML = '<div class="biblio-loading" style="grid-column:1/-1"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</div>';
  document.getElementById('biblio-count').textContent = '';
  document.getElementById('biblio-pagination').innerHTML = '';
}

function afficherErreur(msg) {
  document.getElementById('biblio-grille').innerHTML = `<div class="biblio-empty" style="grid-column:1/-1"><i class="fa-solid fa-triangle-exclamation"></i><p>Erreur : ${msg}</p></div>`;
}

// ─── INITIALISATION ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await chargerCorrespondances();

  // Tabs
  document.querySelectorAll('.biblio-tab').forEach(tab => {
    tab.addEventListener('click', () => changerOnglet(tab.dataset.tab));
  });

  // Recherche globale (debounced)
  const searchInput = document.getElementById('recherche-globale');
  searchInput.addEventListener('input', debounce(e => {
    state.recherche = e.target.value.trim();
    state.page = 1;
    chargerDonnees();
  }, 300));

  // Modal fermeture
  document.getElementById('modal-close').addEventListener('click', fermerModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) fermerModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fermerModal(); });

  // Charger l'onglet par défaut
  changerOnglet('sorts');
  renderFiltres();
});
