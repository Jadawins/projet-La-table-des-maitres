// ═══════════════════════════════════════════════════════════════
//  CAMPAGNE-DETAIL.JS — Éditeur de campagne
// ═══════════════════════════════════════════════════════════════

const API = 'https://myrpgtable.fr/api';
let token = null;
let campagneId = null;
let campagne = null;

// Vue active : { type: 'chapitre'|'rencontre'|'lieu', chapitreId, itemId }
let vueActive = { type: null, chapitreId: null, itemId: null };

// Éditeurs Quill
let quillPrive = null;
let quillPublic = null;

// Auto-save
let autoSaveTimer = null;
let saveTimeout = null;
let saveIndicator = null;

// ─── COMPÉTENCES disponibles pour jets ────────────────────────
const COMPETENCES = [
  'Acrobaties','Arcanes','Athlétisme','Discrétion','Dressage',
  'Escamotage','Histoire','Intimidation','Investigation','Médecine',
  'Nature','Perception','Perspicacité','Persuasion','Religion',
  'Représentation','Survie','Tromperie'
];
const CARACTERISTIQUES = ['FOR','DEX','CON','INT','SAG','CHA'];

// ─── INIT ─────────────────────────────────────────────────────

let _authDone = false;
function waitForAuth(cb) {
  function fire() { if (_authDone) return; _authDone = true; token = window.SUPABASE_TOKEN; cb(); }
  if (window.SUPABASE_TOKEN) { fire(); return; }
  window.addEventListener('supabase-ready', fire, { once: true });
  let n = 0;
  const t = setInterval(() => {
    if (window.SUPABASE_TOKEN) { clearInterval(t); fire(); }
    if (++n > 150) clearInterval(t);
  }, 100);
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function init() {
  const params = new URLSearchParams(location.search);
  campagneId = params.get('id');
  if (!campagneId) { location.href = 'campagne.html'; return; }

  saveIndicator = document.getElementById('save-indicator');

  try {
    const res = await fetch(`${API}/Campagnes/${campagneId}`, { headers: authHeaders() });
    if (!res.ok) { location.href = 'campagne.html'; return; }
    campagne = await res.json();
  } catch {
    location.href = 'campagne.html';
    return;
  }

  document.getElementById('topbar-nom').textContent = campagne.nom;
  document.title = `${campagne.nom} — La Table du Maître`;
  document.getElementById('statut-select').value = campagne.statut;

  renderNav();

  // Auto-save toutes les 30s
  autoSaveTimer = setInterval(() => autoSave(), 30000);
}

// ─── NAVIGATION ───────────────────────────────────────────────

function renderNav() {
  const body = document.getElementById('nav-body');
  if (!campagne.chapitres || !campagne.chapitres.length) {
    body.innerHTML = `<div style="padding:1rem;color:#555;font-size:0.78rem;text-align:center;">
      Aucun chapitre.<br>Cliquez sur + pour commencer.
    </div>`;
    return;
  }

  const sorted = [...campagne.chapitres].sort((a, b) => a.ordre - b.ordre);
  body.innerHTML = sorted.map(ch => {
    const isOpen = vueActive.chapitreId === ch.id;
    const nbR = (ch.rencontres || []).length;
    const nbL = (ch.lieux || []).length;
    return `
    <div class="nav-chapitre" data-id="${ch.id}" draggable="true">
      <div class="nav-chapitre-header ${vueActive.chapitreId === ch.id && vueActive.type === 'chapitre' ? 'active' : ''}"
           onclick="selectChapitre('${ch.id}')">
        <i class="fa-solid fa-chevron-right nav-toggle ${isOpen ? 'open' : ''}"></i>
        <span class="nav-chapitre-title">${escHtml(ch.titre)}</span>
        <button class="btn-icon" title="Supprimer chapitre" onclick="event.stopPropagation();supprimerChapitre('${ch.id}')">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      ${isOpen ? `
      <div class="nav-sub">
        ${nbR > 0 ? `<div class="nav-section-label">Rencontres</div>` : ''}
        ${(ch.rencontres || []).map(r => `
          <div class="nav-sub-item ${vueActive.itemId === r.id ? 'active' : ''}"
               onclick="selectRencontre('${ch.id}','${r.id}')">
            <i class="fa-solid fa-swords" style="font-size:0.7rem;color:#c9a84c;"></i>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(r.nom)}</span>
            <span class="nav-sub-label encounter">${labelDiff(r.difficulte)}</span>
          </div>
        `).join('')}
        ${nbL > 0 ? `<div class="nav-section-label">Lieux</div>` : ''}
        ${(ch.lieux || []).map(l => `
          <div class="nav-sub-item ${vueActive.itemId === l.id ? 'active' : ''}"
               onclick="selectLieu('${ch.id}','${l.id}')">
            <i class="fa-solid fa-map-pin" style="font-size:0.7rem;color:#80c4a0;"></i>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(l.nom)}</span>
            <span class="nav-sub-label place">Lieu</span>
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>`;
  }).join('');

  initDragDrop();
}

function labelDiff(d) {
  return { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile', mortel: 'Mortel' }[d] || d;
}

// ─── SÉLECTION ────────────────────────────────────────────────

function selectChapitre(chapitreId) {
  sauvegarderVueCourante();
  vueActive = { type: 'chapitre', chapitreId, itemId: null };
  renderNav();
  renderChapitre(chapitreId);
}

function selectRencontre(chapitreId, rencontreId) {
  sauvegarderVueCourante();
  vueActive = { type: 'rencontre', chapitreId, itemId: rencontreId };
  renderNav();
  const ch = campagne.chapitres.find(c => c.id === chapitreId);
  const r = ch?.rencontres?.find(x => x.id === rencontreId);
  if (r) renderRencontre(chapitreId, r);
}

function selectLieu(chapitreId, lieuId) {
  sauvegarderVueCourante();
  vueActive = { type: 'lieu', chapitreId, itemId: lieuId };
  renderNav();
  const ch = campagne.chapitres.find(c => c.id === chapitreId);
  const l = ch?.lieux?.find(x => x.id === lieuId);
  if (l) renderLieu(chapitreId, l);
}

// ─── VUE CHAPITRE ─────────────────────────────────────────────

function renderChapitre(chapitreId) {
  const ch = campagne.chapitres.find(c => c.id === chapitreId);
  if (!ch) return;

  const ec = document.getElementById('editor-content');
  ec.innerHTML = `
  <div class="editor-section">
    <input class="chapter-title-input" id="ch-titre" value="${escHtml(ch.titre)}"
           placeholder="Titre du chapitre…"
           oninput="markDirty()"
           onblur="sauvegarderChapitre('${chapitreId}')" />
  </div>

  <div class="editor-section">
    <div class="tab-bar">
      <button class="tab-btn active" onclick="switchTab('prive',this)">
        <i class="fa-solid fa-lock"></i> Privé (MJ)
      </button>
      <button class="tab-btn" onclick="switchTab('public',this)">
        <i class="fa-solid fa-eye"></i> Public (joueurs)
      </button>
    </div>
    <div class="tab-panel active" id="panel-prive">
      <div id="quill-prive"></div>
    </div>
    <div class="tab-panel" id="panel-public">
      <div id="quill-public"></div>
    </div>
  </div>

  <div class="editor-section">
    <div class="editor-section-title">
      <i class="fa-solid fa-swords"></i> Rencontres du chapitre
    </div>
    <div class="rencontres-grid" id="rencontres-grid">
      ${renderRencontresGrid(ch)}
    </div>
    <button class="btn-secondary btn-sm" onclick="ajouterRencontre('${chapitreId}')">
      <i class="fa-solid fa-plus"></i> Ajouter une rencontre
    </button>
  </div>

  <div class="editor-section" style="margin-top:1.5rem;">
    <div class="editor-section-title">
      <i class="fa-solid fa-map-pin"></i> Lieux du chapitre
    </div>
    <div class="lieux-grid" id="lieux-grid">
      ${renderLieuxGrid(ch)}
    </div>
    <button class="btn-secondary btn-sm" onclick="ajouterLieu('${chapitreId}')">
      <i class="fa-solid fa-plus"></i> Ajouter un lieu
    </button>
  </div>
  `;

  // Init Quill editors
  quillPrive = new Quill('#quill-prive', {
    theme: 'snow',
    placeholder: 'Notes MJ uniquement…',
    modules: { toolbar: [[{ header: [2,3,false] }],['bold','italic'],['blockquote'],['bullet','list'],['clean']] }
  });
  quillPrive.root.innerHTML = ch.contenu_prive || '';

  quillPublic = new Quill('#quill-public', {
    theme: 'snow',
    placeholder: 'Contenu visible par les joueurs…',
    modules: { toolbar: [[{ header: [2,3,false] }],['bold','italic'],['blockquote'],['bullet','list'],['clean']] }
  });
  quillPublic.root.innerHTML = ch.contenu_public || '';

  quillPrive.on('text-change', () => markDirty());
  quillPublic.on('text-change', () => markDirty());
}

function renderRencontresGrid(ch) {
  const rs = ch.rencontres || [];
  if (!rs.length) return `<div style="color:#555;font-size:0.8rem;">Aucune rencontre</div>`;
  return rs.map(r => `
    <div class="rencontre-card" onclick="selectRencontre('${ch.id}','${r.id}')">
      <span class="badge-difficulte diff-${r.difficulte}">${labelDiff(r.difficulte)}</span>
      <span class="rencontre-card-nom">${escHtml(r.nom)}</span>
      <span class="rencontre-card-meta">${(r.monstres||[]).length} monstre(s)</span>
      <button class="btn-icon" onclick="event.stopPropagation();supprimerRencontre('${ch.id}','${r.id}')">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`).join('');
}

function renderLieuxGrid(ch) {
  const ls = ch.lieux || [];
  if (!ls.length) return `<div style="color:#555;font-size:0.8rem;">Aucun lieu</div>`;
  return ls.map(l => `
    <div class="lieu-card" onclick="selectLieu('${ch.id}','${l.id}')">
      <i class="fa-solid fa-map-pin" style="color:#80c4a0;"></i>
      <span class="lieu-card-nom">${escHtml(l.nom)}</span>
      <span class="rencontre-card-meta">${(l.pnj||[]).length} PNJ</span>
      <button class="btn-icon" onclick="event.stopPropagation();supprimerLieu('${ch.id}','${l.id}')">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`).join('');
}

function switchTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`panel-${tab}`).classList.add('active');
}

// ─── VUE RENCONTRE ────────────────────────────────────────────

function renderRencontre(chapitreId, r) {
  const ec = document.getElementById('editor-content');
  const monstresHtml = (r.monstres || []).map((m, i) => renderMonstreRow(m, i)).join('');
  const jetsHtml = (r.jets_competences || []).map((j, i) => renderJetRow(j, i)).join('');

  ec.innerHTML = `
  <div class="rencontre-editor" id="rencontre-editor">
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
      <button class="btn-secondary btn-sm" onclick="selectChapitre('${chapitreId}')">
        <i class="fa-solid fa-arrow-left"></i> Chapitre
      </button>
    </div>

    <div class="rencontre-header-row">
      <input class="rencontre-nom-input" id="r-nom" value="${escHtml(r.nom)}"
             placeholder="Nom de la rencontre…"
             oninput="markDirty()" onblur="sauvegarderRencontre('${chapitreId}','${r.id}')" />
      <select class="difficulte-select" id="r-diff" onchange="sauvegarderRencontre('${chapitreId}','${r.id}')">
        <option value="facile" ${r.difficulte==='facile'?'selected':''}>Facile</option>
        <option value="moyen" ${r.difficulte==='moyen'?'selected':''}>Moyen</option>
        <option value="difficile" ${r.difficulte==='difficile'?'selected':''}>Difficile</option>
        <option value="mortel" ${r.difficulte==='mortel'?'selected':''}>Mortel</option>
      </select>
    </div>

    <textarea class="rencontre-desc" id="r-desc" placeholder="Description de la rencontre…"
              oninput="markDirty()" onblur="sauvegarderRencontre('${chapitreId}','${r.id}')">${escHtml(r.description)}</textarea>

    <!-- MONSTRES -->
    <div class="editor-section">
      <div class="editor-section-title"><i class="fa-solid fa-skull"></i> Monstres</div>
      <div id="monstres-list">${monstresHtml}</div>
      <button class="btn-secondary btn-sm" onclick="ouvrirModalMonstre('${chapitreId}','${r.id}')">
        <i class="fa-solid fa-plus"></i> Ajouter un monstre
      </button>
    </div>

    <!-- JETS DE COMPÉTENCES -->
    <div class="editor-section">
      <div class="editor-section-title"><i class="fa-solid fa-dice-d20"></i> Jets de compétences scénarisés</div>
      <div id="jets-list">${jetsHtml}</div>
      <button class="btn-secondary btn-sm" onclick="ajouterJet('${chapitreId}','${r.id}')">
        <i class="fa-solid fa-plus"></i> Ajouter un jet
      </button>
    </div>

    <!-- LANCER -->
    <div style="display:flex;align-items:center;gap:0.75rem;padding-top:0.5rem;border-top:1px solid rgba(255,255,255,0.06);">
      <button class="btn-lancer-rencontre" onclick="ouvrirModalLancer('${chapitreId}','${r.id}')">
        <i class="fa-solid fa-sword"></i> Lancer cette rencontre
      </button>
      <span style="font-size:0.75rem;color:#666;">Charge les monstres dans l'écran MJ</span>
    </div>
  </div>
  `;
}

function renderMonstreRow(m, idx) {
  const attaquesHtml = (m.attaques || []).map((a, ai) => `
    <div class="attaque-row" data-att="${ai}">
      <input class="att-nom" value="${escHtml(a.nom)}" placeholder="Cimeterre" onchange="updateAttaque(${idx},${ai},'nom',this.value)" />
      <span style="color:#666;font-size:0.75rem;">+</span>
      <input class="att-bonus" type="number" value="${a.bonus_attaque||0}" placeholder="+4" onchange="updateAttaque(${idx},${ai},'bonus_attaque',+this.value)" />
      <input class="att-degats" value="${escHtml(a.degats||'')}" placeholder="1d6+2" onchange="updateAttaque(${idx},${ai},'degats',this.value)" />
      <input class="att-type" value="${escHtml(a.type||'')}" placeholder="Tranchants" onchange="updateAttaque(${idx},${ai},'type',this.value)" />
      <button class="btn-icon" onclick="supprimerAttaque(${idx},${ai})"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');

  return `
  <div class="monstre-row" data-monstre="${idx}">
    <div class="monstre-row-header">
      <input class="monstre-nom-input" value="${escHtml(m.nom)}" placeholder="Nom…"
             onchange="updateMonstre(${idx},'nom',this.value)" />
      <button class="btn-icon" onclick="supprimerMonstre(${idx})"><i class="fa-solid fa-trash"></i></button>
    </div>
    <div class="monstre-stats">
      <div class="stat-field"><label>Qté</label><input type="number" value="${m.quantite||1}" min="1" onchange="updateMonstre(${idx},'quantite',+this.value)" /></div>
      <div class="stat-field"><label>PV max</label><input type="number" value="${m.pv_max||10}" min="1" onchange="updateMonstre(${idx},'pv_max',+this.value)" /></div>
      <div class="stat-field"><label>CA</label><input type="number" value="${m.ca||12}" min="1" onchange="updateMonstre(${idx},'ca',+this.value)" /></div>
      <div class="stat-field"><label>Init. bonus</label><input type="number" value="${m.initiative_bonus||0}" onchange="updateMonstre(${idx},'initiative_bonus',+this.value)" /></div>
    </div>
    <div class="attaques-section">
      <div style="font-size:0.65rem;color:#666;margin-bottom:0.3rem;">ATTAQUES</div>
      <div id="attaques-${idx}">${attaquesHtml}</div>
      <button class="btn-icon add" style="font-size:0.75rem;padding:0.2rem 0;" onclick="ajouterAttaque(${idx})">
        <i class="fa-solid fa-plus"></i> Attaque
      </button>
    </div>
  </div>`;
}

function renderJetRow(j, idx) {
  const compOptions = COMPETENCES.map(c =>
    `<option value="${c}" ${j.competence===c?'selected':''}>${c}</option>`
  ).join('');
  const carOptions = CARACTERISTIQUES.map(c =>
    `<option value="${c}" ${j.caracteristique===c?'selected':''}>${c}</option>`
  ).join('');
  return `
  <div class="jet-row" data-jet="${idx}">
    <div class="jet-row-top">
      <input class="jet-desc" value="${escHtml(j.description||'')}" placeholder="Percevoir l'embuscade…"
             onchange="updateJet(${idx},'description',this.value)" />
      <select class="jet-comp-select" onchange="updateJet(${idx},'competence',this.value)">${compOptions}</select>
      <select onchange="updateJet(${idx},'caracteristique',this.value)" style="width:65px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:5px;color:#ddd;padding:0.3rem 0.4rem;font-size:0.78rem;">${carOptions}</select>
      <span style="color:#666;font-size:0.75rem;">DD</span>
      <input class="jet-dd" type="number" value="${j.dd||12}" min="1" max="30"
             onchange="updateJet(${idx},'dd',+this.value)" />
      <button class="btn-icon" onclick="supprimerJet(${idx})"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="jet-row-results">
      <div class="jet-succes">
        <div class="jet-label">✅ Succès</div>
        <textarea placeholder="Ce qui se passe en cas de réussite…"
                  onchange="updateJet(${idx},'succes',this.value)">${escHtml(j.succes||'')}</textarea>
      </div>
      <div class="jet-echec">
        <div class="jet-label">❌ Échec</div>
        <textarea placeholder="Ce qui se passe en cas d'échec…"
                  onchange="updateJet(${idx},'echec',this.value)">${escHtml(j.echec||'')}</textarea>
      </div>
    </div>
  </div>`;
}

// ─── VUE LIEU ─────────────────────────────────────────────────

function renderLieu(chapitreId, l) {
  const ec = document.getElementById('editor-content');
  const pnjHtml = (l.pnj || []).map((p, i) => renderPnjRow(p, i)).join('');

  ec.innerHTML = `
  <div class="lieu-editor" id="lieu-editor">
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
      <button class="btn-secondary btn-sm" onclick="selectChapitre('${chapitreId}')">
        <i class="fa-solid fa-arrow-left"></i> Chapitre
      </button>
    </div>

    <input class="lieu-nom-input" id="l-nom" value="${escHtml(l.nom)}"
           placeholder="Nom du lieu…"
           oninput="markDirty()" onblur="sauvegarderLieu('${chapitreId}','${l.id}')" />

    <div class="editor-section">
      <div class="tab-bar">
        <button class="tab-btn active" onclick="switchTab('lieu-prive',this)">
          <i class="fa-solid fa-lock"></i> Description MJ
        </button>
        <button class="tab-btn" onclick="switchTab('lieu-public',this)">
          <i class="fa-solid fa-eye"></i> Description joueurs
        </button>
      </div>
      <div class="tab-panel active" id="panel-lieu-prive">
        <textarea id="lieu-desc-privee" style="width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#ccc;padding:0.7rem;font-size:0.85rem;resize:vertical;min-height:120px;box-sizing:border-box;"
                  placeholder="Notes MJ sur ce lieu…"
                  oninput="markDirty()" onblur="sauvegarderLieu('${chapitreId}','${l.id}')">${escHtml(l.description_privee)}</textarea>
      </div>
      <div class="tab-panel" id="panel-lieu-public">
        <textarea id="lieu-desc-publique" style="width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#ccc;padding:0.7rem;font-size:0.85rem;resize:vertical;min-height:120px;box-sizing:border-box;"
                  placeholder="Ce que les joueurs voient…"
                  oninput="markDirty()" onblur="sauvegarderLieu('${chapitreId}','${l.id}')">${escHtml(l.description_publique)}</textarea>
      </div>
    </div>

    <!-- PNJ -->
    <div class="editor-section">
      <div class="editor-section-title"><i class="fa-solid fa-person"></i> PNJ de ce lieu</div>
      <div id="pnj-list">${pnjHtml}</div>
      <button class="btn-secondary btn-sm" onclick="ajouterPnj('${chapitreId}','${l.id}')">
        <i class="fa-solid fa-plus"></i> Ajouter un PNJ
      </button>
    </div>
  </div>`;
}

function renderPnjRow(p, idx) {
  return `
  <div class="pnj-row" data-pnj="${idx}">
    <div class="pnj-row-header">
      <input class="pnj-nom-input" value="${escHtml(p.nom||'')}" placeholder="Nom du PNJ…"
             onchange="updatePnj(${idx},'nom',this.value)" />
      <button class="btn-icon" onclick="supprimerPnj(${idx})"><i class="fa-solid fa-trash"></i></button>
    </div>
    <textarea placeholder="Description publique…" onchange="updatePnj(${idx},'description',this.value)">${escHtml(p.description||'')}</textarea>
    <div class="secret-label"><i class="fa-solid fa-lock"></i> Secret MJ</div>
    <textarea placeholder="Informations secrètes…" onchange="updatePnj(${idx},'secret',this.value)">${escHtml(p.secret||'')}</textarea>
  </div>`;
}

// ─── MUTATIONS DONNÉES LOCALES ─────────────────────────────────

function getChapitreRencontre(chapitreId, rencontreId) {
  const ch = campagne.chapitres.find(c => c.id === chapitreId);
  const r = ch?.rencontres?.find(x => x.id === rencontreId);
  return { ch, r };
}

function getChapitreFromActive() {
  return campagne.chapitres.find(c => c.id === vueActive.chapitreId);
}

function getRencontreFromActive() {
  const ch = getChapitreFromActive();
  return ch?.rencontres?.find(r => r.id === vueActive.itemId);
}

function getLieuFromActive() {
  const ch = getChapitreFromActive();
  return ch?.lieux?.find(l => l.id === vueActive.itemId);
}

function updateMonstre(idx, field, value) {
  const r = getRencontreFromActive();
  if (!r) return;
  r.monstres[idx][field] = value;
  markDirty();
  debounceSaveRencontre();
}

function supprimerMonstre(idx) {
  const r = getRencontreFromActive();
  if (!r) return;
  r.monstres.splice(idx, 1);
  sauvegarderRencontre(vueActive.chapitreId, vueActive.itemId);
  selectRencontre(vueActive.chapitreId, vueActive.itemId);
}

function ajouterAttaque(mIdx) {
  const r = getRencontreFromActive();
  if (!r) return;
  r.monstres[mIdx].attaques = r.monstres[mIdx].attaques || [];
  r.monstres[mIdx].attaques.push({ nom: '', bonus_attaque: 0, degats: '1d6', type: '' });
  sauvegarderRencontre(vueActive.chapitreId, vueActive.itemId);
  selectRencontre(vueActive.chapitreId, vueActive.itemId);
}

function supprimerAttaque(mIdx, aIdx) {
  const r = getRencontreFromActive();
  if (!r) return;
  r.monstres[mIdx].attaques.splice(aIdx, 1);
  sauvegarderRencontre(vueActive.chapitreId, vueActive.itemId);
  selectRencontre(vueActive.chapitreId, vueActive.itemId);
}

function updateAttaque(mIdx, aIdx, field, value) {
  const r = getRencontreFromActive();
  if (!r) return;
  r.monstres[mIdx].attaques[aIdx][field] = value;
  markDirty();
  debounceSaveRencontre();
}

function ajouterJet(chapitreId, rencontreId) {
  const { r } = getChapitreRencontre(chapitreId, rencontreId);
  if (!r) return;
  r.jets_competences = r.jets_competences || [];
  r.jets_competences.push({ id: uid(), description: '', competence: 'Perception', caracteristique: 'SAG', dd: 12, succes: '', echec: '' });
  sauvegarderRencontre(chapitreId, rencontreId);
  selectRencontre(chapitreId, rencontreId);
}

function supprimerJet(idx) {
  const r = getRencontreFromActive();
  if (!r) return;
  r.jets_competences.splice(idx, 1);
  sauvegarderRencontre(vueActive.chapitreId, vueActive.itemId);
  selectRencontre(vueActive.chapitreId, vueActive.itemId);
}

function updateJet(idx, field, value) {
  const r = getRencontreFromActive();
  if (!r) return;
  r.jets_competences[idx][field] = value;
  markDirty();
  debounceSaveRencontre();
}

function ajouterPnj(chapitreId, lieuId) {
  const ch = campagne.chapitres.find(c => c.id === chapitreId);
  const l = ch?.lieux?.find(x => x.id === lieuId);
  if (!l) return;
  l.pnj = l.pnj || [];
  l.pnj.push({ nom: '', description: '', secret: '' });
  sauvegarderLieu(chapitreId, lieuId);
  selectLieu(chapitreId, lieuId);
}

function supprimerPnj(idx) {
  const l = getLieuFromActive();
  if (!l) return;
  l.pnj.splice(idx, 1);
  sauvegarderLieu(vueActive.chapitreId, vueActive.itemId);
  selectLieu(vueActive.chapitreId, vueActive.itemId);
}

function updatePnj(idx, field, value) {
  const l = getLieuFromActive();
  if (!l) return;
  l.pnj[idx][field] = value;
  markDirty();
}

// ─── AUTO-SAVE / SAUVEGARDE ───────────────────────────────────

function markDirty() {
  setSaveIndicator('saving');
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => sauvegarderVueCourante(), 2000);
}

function debounceSaveRencontre() {
  // déjà géré par markDirty
}

function setSaveIndicator(state) {
  if (!saveIndicator) return;
  if (state === 'saved') {
    saveIndicator.textContent = '✓ Sauvegardé';
    saveIndicator.className = 'save-indicator saved';
  } else if (state === 'saving') {
    saveIndicator.textContent = '⏳ Sauvegarde…';
    saveIndicator.className = 'save-indicator saving';
  } else {
    saveIndicator.textContent = '—';
    saveIndicator.className = 'save-indicator';
  }
}

async function sauvegarderVueCourante() {
  if (!vueActive.type) return;
  if (vueActive.type === 'chapitre') await sauvegarderChapitre(vueActive.chapitreId);
  if (vueActive.type === 'rencontre') await sauvegarderRencontre(vueActive.chapitreId, vueActive.itemId);
  if (vueActive.type === 'lieu') await sauvegarderLieu(vueActive.chapitreId, vueActive.itemId);
}

async function sauvegarderMeta() {
  const statut = document.getElementById('statut-select').value;
  try {
    await fetch(`${API}/Campagnes/${campagneId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ statut })
    });
    campagne.statut = statut;
  } catch {}
}

async function autoSave() {
  if (!vueActive.type) return;
  setSaveIndicator('saving');
  await sauvegarderVueCourante();
}

async function sauvegarderChapitre(chapitreId) {
  const ch = campagne.chapitres.find(c => c.id === chapitreId);
  if (!ch) return;
  const titre = document.getElementById('ch-titre')?.value || ch.titre;
  const contenu_prive = quillPrive ? quillPrive.root.innerHTML : ch.contenu_prive;
  const contenu_public = quillPublic ? quillPublic.root.innerHTML : ch.contenu_public;
  ch.titre = titre;
  ch.contenu_prive = contenu_prive;
  ch.contenu_public = contenu_public;
  try {
    await fetch(`${API}/Campagnes/${campagneId}/chapitres/${chapitreId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ titre, contenu_prive, contenu_public })
    });
    setSaveIndicator('saved');
    // Mettre à jour le titre dans la nav
    const navEl = document.querySelector(`.nav-chapitre[data-id="${chapitreId}"] .nav-chapitre-title`);
    if (navEl) navEl.textContent = titre;
  } catch {
    setSaveIndicator(null);
  }
}

async function sauvegarderRencontre(chapitreId, rencontreId) {
  const { r } = getChapitreRencontre(chapitreId, rencontreId);
  if (!r) return;
  const nom = document.getElementById('r-nom')?.value ?? r.nom;
  const description = document.getElementById('r-desc')?.value ?? r.description;
  const difficulte = document.getElementById('r-diff')?.value ?? r.difficulte;
  r.nom = nom; r.description = description; r.difficulte = difficulte;
  try {
    await fetch(`${API}/Campagnes/${campagneId}/chapitres/${chapitreId}/rencontres/${rencontreId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ nom, description, difficulte, monstres: r.monstres, jets_competences: r.jets_competences })
    });
    setSaveIndicator('saved');
  } catch {
    setSaveIndicator(null);
  }
}

async function sauvegarderLieu(chapitreId, lieuId) {
  const ch = campagne.chapitres.find(c => c.id === chapitreId);
  const l = ch?.lieux?.find(x => x.id === lieuId);
  if (!l) return;
  const nom = document.getElementById('l-nom')?.value ?? l.nom;
  const dp = document.getElementById('lieu-desc-privee')?.value ?? l.description_privee;
  const dpu = document.getElementById('lieu-desc-publique')?.value ?? l.description_publique;
  l.nom = nom; l.description_privee = dp; l.description_publique = dpu;
  try {
    await fetch(`${API}/Campagnes/${campagneId}/chapitres/${chapitreId}/lieux/${lieuId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ nom, description_privee: dp, description_publique: dpu, pnj: l.pnj })
    });
    setSaveIndicator('saved');
  } catch {
    setSaveIndicator(null);
  }
}

// ─── ACTIONS CHAPITRE ─────────────────────────────────────────

async function ajouterChapitre() {
  try {
    const res = await fetch(`${API}/Campagnes/${campagneId}/chapitres`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ titre: `Chapitre ${campagne.chapitres.length + 1}` })
    });
    const ch = await res.json();
    campagne.chapitres.push(ch);
    selectChapitre(ch.id);
  } catch (e) {
    alert('Erreur lors de l\'ajout du chapitre');
  }
}

async function supprimerChapitre(chapitreId) {
  if (!confirm('Supprimer ce chapitre ? Toutes les rencontres et lieux seront supprimés.')) return;
  try {
    await fetch(`${API}/Campagnes/${campagneId}/chapitres/${chapitreId}`, {
      method: 'DELETE', headers: authHeaders()
    });
    campagne.chapitres = campagne.chapitres.filter(c => c.id !== chapitreId);
    if (vueActive.chapitreId === chapitreId) {
      vueActive = { type: null, chapitreId: null, itemId: null };
      document.getElementById('editor-content').innerHTML = `
        <div style="text-align:center;padding:4rem;color:#555;">
          <i class="fa-solid fa-arrow-left" style="font-size:2rem;color:#333;"></i>
          <p style="margin-top:1rem;">Sélectionnez un chapitre</p>
        </div>`;
    }
    renderNav();
  } catch {}
}

// ─── ACTIONS RENCONTRE ────────────────────────────────────────

async function ajouterRencontre(chapitreId) {
  try {
    const res = await fetch(`${API}/Campagnes/${campagneId}/chapitres/${chapitreId}/rencontres`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ nom: 'Nouvelle rencontre', difficulte: 'moyen' })
    });
    const r = await res.json();
    const ch = campagne.chapitres.find(c => c.id === chapitreId);
    ch.rencontres = ch.rencontres || [];
    ch.rencontres.push(r);
    selectRencontre(chapitreId, r.id);
  } catch {}
}

async function supprimerRencontre(chapitreId, rencontreId) {
  if (!confirm('Supprimer cette rencontre ?')) return;
  try {
    await fetch(`${API}/Campagnes/${campagneId}/chapitres/${chapitreId}/rencontres/${rencontreId}`, {
      method: 'DELETE', headers: authHeaders()
    });
    const ch = campagne.chapitres.find(c => c.id === chapitreId);
    ch.rencontres = ch.rencontres.filter(r => r.id !== rencontreId);
    if (vueActive.itemId === rencontreId) selectChapitre(chapitreId);
    else renderChapitre(chapitreId);
  } catch {}
}

// ─── ACTIONS LIEU ─────────────────────────────────────────────

async function ajouterLieu(chapitreId) {
  try {
    const res = await fetch(`${API}/Campagnes/${campagneId}/chapitres/${chapitreId}/lieux`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ nom: 'Nouveau lieu' })
    });
    const l = await res.json();
    const ch = campagne.chapitres.find(c => c.id === chapitreId);
    ch.lieux = ch.lieux || [];
    ch.lieux.push(l);
    selectLieu(chapitreId, l.id);
  } catch {}
}

async function supprimerLieu(chapitreId, lieuId) {
  if (!confirm('Supprimer ce lieu ?')) return;
  try {
    await fetch(`${API}/Campagnes/${campagneId}/chapitres/${chapitreId}/lieux/${lieuId}`, {
      method: 'DELETE', headers: authHeaders()
    });
    const ch = campagne.chapitres.find(c => c.id === chapitreId);
    ch.lieux = ch.lieux.filter(l => l.id !== lieuId);
    if (vueActive.itemId === lieuId) selectChapitre(chapitreId);
    else renderChapitre(chapitreId);
  } catch {}
}

// ─── MODAL MONSTRE ────────────────────────────────────────────

let _monstreTarget = null; // { chapitreId, rencontreId }

function ouvrirModalMonstre(chapitreId, rencontreId) {
  _monstreTarget = { chapitreId, rencontreId };
  ['m-nom','m-qte','m-pv','m-ca','m-init'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'm-qte' ? 1 : id === 'm-pv' ? 10 : id === 'm-ca' ? 12 : id === 'm-init' ? 0 : '';
  });
  document.getElementById('modal-monstre').classList.remove('hidden');
}

function fermerModalMonstre() {
  document.getElementById('modal-monstre').classList.add('hidden');
  _monstreTarget = null;
}

async function validerAjoutMonstre() {
  if (!_monstreTarget) return;
  const { chapitreId, rencontreId } = _monstreTarget;
  const { r } = getChapitreRencontre(chapitreId, rencontreId);
  if (!r) return;
  r.monstres = r.monstres || [];
  r.monstres.push({
    id: uid(),
    nom: document.getElementById('m-nom').value || 'Monstre',
    quantite: +document.getElementById('m-qte').value || 1,
    pv_max: +document.getElementById('m-pv').value || 10,
    pv_actuels: +document.getElementById('m-pv').value || 10,
    ca: +document.getElementById('m-ca').value || 12,
    initiative_bonus: +document.getElementById('m-init').value || 0,
    attaques: [],
    source: 'personnalise'
  });
  fermerModalMonstre();
  await sauvegarderRencontre(chapitreId, rencontreId);
  selectRencontre(chapitreId, rencontreId);
}

// ─── MODAL LANCER RENCONTRE ───────────────────────────────────

let _lancerTarget = null;

async function ouvrirModalLancer(chapitreId, rencontreId) {
  _lancerTarget = { chapitreId, rencontreId };
  document.getElementById('modal-lancer').classList.remove('hidden');
  const sel = document.getElementById('lancer-session-select');
  sel.innerHTML = '<option value="">Chargement…</option>';
  try {
    const res = await fetch(`${API}/Sessions`, { headers: authHeaders() });
    const sessions = await res.json();
    const actives = sessions.filter(s => s.mj_id && (s.statut === 'en_cours' || s.statut === 'recrutement'));
    if (!actives.length) {
      sel.innerHTML = '<option value="">Aucune session active</option>';
    } else {
      sel.innerHTML = actives.map(s => `<option value="${s._id}">${escHtml(s.nom)}</option>`).join('');
    }
  } catch {
    sel.innerHTML = '<option value="">Erreur de chargement</option>';
  }
}

function fermerModalLancer() {
  document.getElementById('modal-lancer').classList.add('hidden');
  _lancerTarget = null;
}

async function validerLancerRencontre() {
  if (!_lancerTarget) return;
  const sessionId = document.getElementById('lancer-session-select').value;
  if (!sessionId) { alert('Sélectionnez une session'); return; }
  const { chapitreId, rencontreId } = _lancerTarget;
  try {
    // Sauvegarder d'abord
    await sauvegarderRencontre(chapitreId, rencontreId);
    const res = await fetch(
      `${API}/Campagnes/${campagneId}/chapitres/${chapitreId}/rencontres/${rencontreId}/lancer`,
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ session_id: sessionId }) }
    );
    if (!res.ok) {
      const err = await res.json();
      alert('Erreur : ' + err.error);
      return;
    }
    const { combat_id } = await res.json();
    fermerModalLancer();
    window.open(`ecran-mj.html?session=${sessionId}&combat=${combat_id}`, '_blank');
  } catch (e) {
    alert('Erreur lors du lancement : ' + e.message);
  }
}

// ─── DRAG & DROP CHAPITRES ────────────────────────────────────

function initDragDrop() {
  const items = document.querySelectorAll('.nav-chapitre');
  items.forEach(item => {
    item.addEventListener('dragstart', e => {
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => {
      e.preventDefault();
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const draggedId = e.dataTransfer.getData('text/plain');
      const targetId = item.dataset.id;
      if (draggedId === targetId) return;
      reorderChapitres(draggedId, targetId);
    });
  });
}

async function reorderChapitres(draggedId, targetId) {
  const sorted = [...campagne.chapitres].sort((a, b) => a.ordre - b.ordre);
  const draggedIdx = sorted.findIndex(c => c.id === draggedId);
  const targetIdx = sorted.findIndex(c => c.id === targetId);
  if (draggedIdx < 0 || targetIdx < 0) return;
  const [dragged] = sorted.splice(draggedIdx, 1);
  sorted.splice(targetIdx, 0, dragged);
  sorted.forEach((c, i) => { c.ordre = i + 1; });
  campagne.chapitres = sorted;
  renderNav();
  // Sauvegarder les ordres
  try {
    await Promise.all(sorted.map(c =>
      fetch(`${API}/Campagnes/${campagneId}/chapitres/${c.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ ordre: c.ordre })
      })
    ));
  } catch {}
}

// ─── CLAVIER ──────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    fermerModalMonstre();
    fermerModalLancer();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    sauvegarderVueCourante();
  }
});

// ─── DÉMARRAGE ────────────────────────────────────────────────

waitForAuth(init);
