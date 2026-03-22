// ═══════════════════════════════════════════════════════════════
//  FICHE-PERSONNAGE.JS — Fiche éditable D&D 2024
// ═══════════════════════════════════════════════════════════════

const API = 'https://myrpgtable.fr/api';
let token = null;
let persoId = null;
let perso = null;
let pendingChanges = {};
let saveTimer = null;
let saveBatchTimer = null;

const CARS = ['FOR','DEX','CON','INT','SAG','CHA'];

const TOUTES_COMPETENCES = [
  { nom: 'Acrobaties', car: 'DEX' }, { nom: 'Arcanes', car: 'INT' },
  { nom: 'Athlétisme', car: 'FOR' }, { nom: 'Discrétion', car: 'DEX' },
  { nom: 'Dressage', car: 'SAG' }, { nom: 'Escamotage', car: 'DEX' },
  { nom: 'Histoire', car: 'INT' }, { nom: 'Intimidation', car: 'CHA' },
  { nom: 'Investigation', car: 'INT' }, { nom: 'Médecine', car: 'SAG' },
  { nom: 'Nature', car: 'INT' }, { nom: 'Perception', car: 'SAG' },
  { nom: 'Perspicacité', car: 'SAG' }, { nom: 'Persuasion', car: 'CHA' },
  { nom: 'Religion', car: 'INT' }, { nom: 'Représentation', car: 'CHA' },
  { nom: 'Survie', car: 'SAG' }, { nom: 'Tromperie', car: 'CHA' },
];

// ─── UTILITAIRES ──────────────────────────────────────────────

let _authDone = false;
function waitForAuth(cb) {
  function fire() { if (_authDone) return; _authDone = true; token = window.SUPABASE_TOKEN; cb(); }
  if (window.SUPABASE_TOKEN) { fire(); return; }
  window.addEventListener('supabase-ready', fire, { once: true });
  // Fallback polling si l'événement est manqué
  let n = 0;
  const t = setInterval(() => {
    if (window.SUPABASE_TOKEN) { clearInterval(t); fire(); }
    if (++n > 150) clearInterval(t);
  }, 100);
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function mod(val) { return Math.floor((val - 10) / 2); }
function fmtMod(v) { return v >= 0 ? `+${v}` : `${v}`; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function getCarVal(k) { return perso?.caracteristiques?.[k]?.valeur || 10; }
function getMod(k) { return mod(getCarVal(k)); }
function getBM() { return perso?.bonus_maitrise || 2; }

// ─── DIRTY / SAVE ─────────────────────────────────────────────

function setSaveIndicator(state) {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  if (state === 'saved') { el.textContent = '✓ Sauvegardé'; el.className = 'fiche-save-indicator saved'; }
  else if (state === 'saving') { el.textContent = '⏳ Sauvegarde…'; el.className = 'fiche-save-indicator saving'; }
  else { el.textContent = '—'; el.className = 'fiche-save-indicator'; }
}

function setNestedValue(obj, path, val) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]]) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = val;
}

function markDirty(field, value) {
  setNestedValue(perso, field, value);
  pendingChanges[field] = value;
  setSaveIndicator('saving');
  clearTimeout(saveBatchTimer);
  saveBatchTimer = setTimeout(flushSave, 2000);
}

async function flushSave() {
  if (!Object.keys(pendingChanges).length) return;
  const payload = { ...pendingChanges };
  pendingChanges = {};
  try {
    await fetch(`${API}/Personnages/${persoId}`, {
      method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload)
    });
    setSaveIndicator('saved');
  } catch { setSaveIndicator(null); }
}

// Ctrl+S
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); flushSave(); }
});

// ─── CHARGEMENT ───────────────────────────────────────────────

async function init() {
  const params = new URLSearchParams(location.search);
  persoId = params.get('id');
  if (!persoId) { location.href = 'mes-personnages.html'; return; }
  try {
    const r = await fetch(`${API}/Personnages/${persoId}`, { headers: authHeaders() });
    if (!r.ok) { location.href = 'mes-personnages.html'; return; }
    perso = await r.json();
  } catch { location.href = 'mes-personnages.html'; return; }
  renderAll();
}

// ─── RENDU COMPLET ────────────────────────────────────────────

function renderAll() {
  document.title = `${perso.nom} — La Table du Maître`;
  document.getElementById('p-nom').value = perso.nom || '';
  renderTags();
  renderPV();
  renderCombatQuick();
  renderCaracteristiques();
  renderSauvegardes();
  renderCompetences();
  renderAttaques();
  renderSorts();
  renderEquipement();
  renderMonnaie();
  renderTraits();
  renderLanguesMaitrises();
  renderDesVie();

  const inspDiamond = document.getElementById('inspire-diamond');
  if (inspDiamond) {
    inspDiamond.classList.toggle('active', !!perso.inspiration);
  }
  document.getElementById('bonus-maitrise-display').textContent = '+' + getBM();
}

// ─── HEADER : TAGS ────────────────────────────────────────────

function renderTags() {
  const tags = [];
  if (perso.niveau) tags.push(`Niveau ${perso.niveau}`);
  if (perso.classe) tags.push(capitalize(perso.classe));
  if (perso.espece) tags.push(capitalize(perso.espece));
  if (perso.background) tags.push(capitalize(perso.background));
  if (perso.alignement) tags.push(perso.alignement.replace(/_/g,' '));
  document.getElementById('fiche-tags').innerHTML = tags.map(t => `<span class="fiche-tag">${esc(t)}</span>`).join('');
}

function capitalize(s) { return String(s||'').charAt(0).toUpperCase() + s.slice(1); }

// ─── PV ───────────────────────────────────────────────────────

function renderPV() {
  const c = perso.combat || {};
  document.getElementById('pv-actuels').value = c.pv_actuels ?? c.pv_max ?? 10;
  document.getElementById('pv-max').value = c.pv_max || 10;
  document.getElementById('pv-temp').value = c.pv_temporaires || 0;
  updatePVBar();
}

function changePV() {
  const act = parseInt(document.getElementById('pv-actuels').value) || 0;
  const max = parseInt(document.getElementById('pv-max').value) || 1;
  if (!perso.combat) perso.combat = {};
  perso.combat.pv_actuels = act;
  perso.combat.pv_max = max;
  pendingChanges['combat.pv_actuels'] = act;
  pendingChanges['combat.pv_max'] = max;
  setSaveIndicator('saving');
  clearTimeout(saveBatchTimer);
  saveBatchTimer = setTimeout(flushSave, 1500);
  updatePVBar();
}

function updatePVBar() {
  const act = parseInt(document.getElementById('pv-actuels').value) || 0;
  const max = parseInt(document.getElementById('pv-max').value) || 1;
  const pct = Math.max(0, Math.min(100, (act / max) * 100));
  const bar = document.getElementById('pv-bar');
  bar.style.width = pct + '%';
  bar.style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';
}

// ─── STATS RAPIDES (CA, INIT, VITESSE) ────────────────────────

function renderCombatQuick() {
  const c = perso.combat || {};
  const el = document.getElementById('fiche-combat-quick');
  el.innerHTML = `
    <div class="fiche-stat-bubble">
      <div class="bubble-val" contenteditable="true" onblur="markDirty('combat.ca',+this.textContent||10)">${c.ca || 10}</div>
      <div class="bubble-label">CA</div>
    </div>
    <div class="fiche-stat-bubble">
      <div class="bubble-val">${fmtMod(c.initiative ?? getMod('DEX'))}</div>
      <div class="bubble-label">Initiative</div>
    </div>
    <div class="fiche-stat-bubble">
      <div class="bubble-val">${c.vitesse || 9}m</div>
      <div class="bubble-label">Vitesse</div>
    </div>
    <div class="fiche-stat-bubble">
      <div class="bubble-val">${perso.niveau || 1}</div>
      <div class="bubble-label">Niveau</div>
    </div>
    <div class="fiche-stat-bubble">
      <div class="bubble-val">${perso.experience || 0}</div>
      <div class="bubble-label">XP</div>
    </div>`;
}

// ─── CARACTÉRISTIQUES ─────────────────────────────────────────

function renderCaracteristiques() {
  const grid = document.getElementById('carac-grid');
  grid.innerHTML = CARS.map(k => {
    const val = getCarVal(k);
    const m = mod(val);
    return `
    <div class="carac-box">
      <div class="carac-name">${k}</div>
      <input class="carac-val-input" type="number" value="${val}" min="1" max="30"
             onchange="updateCarac('${k}',+this.value)" />
      <div class="carac-mod" id="carac-mod-${k}">${fmtMod(m)}</div>
    </div>`;
  }).join('');
}

function updateCarac(k, val) {
  if (!perso.caracteristiques) perso.caracteristiques = {};
  perso.caracteristiques[k] = { valeur: val, modificateur: mod(val) };
  document.getElementById(`carac-mod-${k}`).textContent = fmtMod(mod(val));
  pendingChanges['caracteristiques'] = perso.caracteristiques;
  setSaveIndicator('saving');
  clearTimeout(saveBatchTimer);
  saveBatchTimer = setTimeout(flushSave, 2000);
  // Rafraîchir sauvegardes et compétences
  renderSauvegardes();
  renderCompetences();
}

// ─── JETS DE SAUVEGARDE ───────────────────────────────────────

function renderSauvegardes() {
  const saves = perso.jets_sauvegarde || {};
  const list = document.getElementById('save-list');
  list.innerHTML = CARS.map(k => {
    const s = saves[k] || {};
    const hasMaitrise = s.maitrise || false;
    const val = getMod(k) + (hasMaitrise ? getBM() : 0);
    return `
    <div class="save-row">
      <div class="save-dot ${hasMaitrise ? 'filled' : ''}" title="Maîtrise" onclick="toggleSave('${k}')"></div>
      <span class="save-name">${k}</span>
      <span class="save-bonus">${fmtMod(val)}</span>
    </div>`;
  }).join('');
}

function toggleSave(k) {
  if (!perso.jets_sauvegarde) perso.jets_sauvegarde = {};
  if (!perso.jets_sauvegarde[k]) perso.jets_sauvegarde[k] = { maitrise: false, valeur: 0 };
  perso.jets_sauvegarde[k].maitrise = !perso.jets_sauvegarde[k].maitrise;
  perso.jets_sauvegarde[k].valeur = getMod(k) + (perso.jets_sauvegarde[k].maitrise ? getBM() : 0);
  pendingChanges['jets_sauvegarde'] = perso.jets_sauvegarde;
  setSaveIndicator('saving');
  clearTimeout(saveBatchTimer);
  saveBatchTimer = setTimeout(flushSave, 1500);
  renderSauvegardes();
}

// ─── COMPÉTENCES ──────────────────────────────────────────────

function renderCompetences() {
  const comps = perso.competences || [];
  const list = document.getElementById('comp-list');
  list.innerHTML = TOUTES_COMPETENCES.map(c => {
    const found = comps.find(x => x.nom === c.nom);
    const hasMaitrise = found?.maitrise || false;
    const hasExpertise = found?.expertise || false;
    const val = getMod(c.car) + (hasExpertise ? getBM() * 2 : hasMaitrise ? getBM() : 0);
    return `
    <div class="comp-list-row" onclick="toggleComp('${c.nom}','${c.car}')">
      <div class="comp-dot ${hasExpertise ? 'expertise' : hasMaitrise ? 'maitrise' : ''}"></div>
      <span class="comp-list-name ${hasMaitrise || hasExpertise ? 'has-maitrise' : ''}">${c.nom}</span>
      <span class="comp-list-char">${c.car}</span>
      <span class="comp-list-val">${fmtMod(val)}</span>
    </div>`;
  }).join('');
}

function toggleComp(nom, car) {
  if (!perso.competences) perso.competences = [];
  const idx = perso.competences.findIndex(c => c.nom === nom);
  if (idx < 0) {
    perso.competences.push({ nom, caracteristique: car, maitrise: true, expertise: false, valeur: getMod(car) + getBM() });
  } else {
    const c = perso.competences[idx];
    if (c.maitrise && !c.expertise) {
      c.expertise = true;
      c.valeur = getMod(car) + getBM() * 2;
    } else {
      perso.competences.splice(idx, 1);
    }
  }
  pendingChanges['competences'] = perso.competences;
  setSaveIndicator('saving');
  clearTimeout(saveBatchTimer);
  saveBatchTimer = setTimeout(flushSave, 1500);
  renderCompetences();
}

// ─── INSPIRATION ──────────────────────────────────────────────

function toggleInspiration() {
  perso.inspiration = !perso.inspiration;
  document.getElementById('inspire-diamond').classList.toggle('active', perso.inspiration);
  markDirty('inspiration', perso.inspiration);
}

// ─── ATTAQUES ─────────────────────────────────────────────────

function renderAttaques() {
  const tbody = document.getElementById('attaques-tbody');
  const attacks = perso.attaques || [];
  if (!attacks.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:#555;font-size:0.78rem;text-align:center;padding:0.5rem;">Aucune attaque</td></tr>`;
    return;
  }
  tbody.innerHTML = attacks.map((a, i) => `
    <tr>
      <td>${esc(a.nom)}</td>
      <td class="atk-bonus">${esc(a.bonus_attaque)}</td>
      <td class="atk-degats">${esc(a.degats)} <span style="color:#888;font-size:0.65rem;">${esc(a.type||'')}</span></td>
      <td><button class="btn-icon" style="color:#555;background:none;border:none;cursor:pointer;font-size:0.75rem;" onclick="supprimerAttaque(${i})">✕</button></td>
    </tr>`).join('');
}

function ouvrirModalAttaque() {
  ['atk-nom','atk-bonus','atk-degats','atk-type'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('modal-attaque').classList.remove('hidden');
}

function fermerModalAttaque() {
  document.getElementById('modal-attaque').classList.add('hidden');
}

function validerAttaque() {
  const nom = document.getElementById('atk-nom').value.trim();
  if (!nom) return;
  if (!perso.attaques) perso.attaques = [];
  perso.attaques.push({
    nom,
    bonus_attaque: document.getElementById('atk-bonus').value.trim() || '+0',
    degats: document.getElementById('atk-degats').value.trim() || '1d6',
    type: document.getElementById('atk-type').value.trim()
  });
  markDirty('attaques', perso.attaques);
  fermerModalAttaque();
  renderAttaques();
}

function supprimerAttaque(idx) {
  perso.attaques.splice(idx, 1);
  markDirty('attaques', perso.attaques);
  renderAttaques();
}

// ─── DÉS DE VIE ──────────────────────────────────────────────

function renderDesVie() {
  const dv = perso.combat?.des_vie || {};
  const niv = perso.niveau || 1;
  document.getElementById('des-vie-type').textContent = `${niv}${dv.type || 'd8'}`;
  document.getElementById('dv-restants').value = dv.restants ?? niv;
  document.getElementById('dv-total').textContent = dv.total || niv;
}

// ─── JETS DE MORT ─────────────────────────────────────────────

function toggleMortDot(el) {
  el.classList.toggle('available');
  el.classList.toggle('used');
}

// ─── SORTS ────────────────────────────────────────────────────

function renderSorts() {
  const sorts = perso.sorts || {};
  if (!sorts.caracteristique_incantation) {
    document.getElementById('sorts-section').style.display = 'none';
    return;
  }
  document.getElementById('sorts-section').style.display = 'block';
  const car = sorts.caracteristique_incantation;
  const dd = sorts.dd_sorts || (8 + getBM() + getMod(car));
  const bonus = sorts.bonus_attaque_sort || (getBM() + getMod(car));
  document.getElementById('sort-stats-row').innerHTML = `
    <span><strong style="color:#e0d0ff;">${car}</strong> — Caractéristique d'incantation</span>
    <span>DD sorts : <strong style="color:#e0d0ff;">${dd}</strong></span>
    <span>Bonus attaque : <strong style="color:#e0d0ff;">${fmtMod(bonus)}</strong></span>`;

  // Emplacements
  const empl = sorts.emplacements || [];
  const slots = document.getElementById('spell-slots');
  if (!empl.length) {
    slots.innerHTML = '<span style="color:#555;font-size:0.75rem;">Aucun emplacement défini</span>';
  } else {
    slots.innerHTML = empl.map((e, i) => {
      const dots = Array.from({ length: e.total }, (_, j) => `
        <div class="slot-dot ${j < e.utilises ? 'used' : 'available'}"
             onclick="toggleSlot(${i},${j})"></div>`).join('');
      return `<div class="spell-slot-col">
        <div class="slot-level-label">Niv.${e.niveau||i+1}</div>
        <div class="slot-dots">${dots}</div>
      </div>`;
    }).join('');
  }

  // Sorts connus par niveau
  const connus = sorts.sorts_connus || [];
  const parNiveau = {};
  connus.forEach(s => {
    const niv = s.niveau ?? 0;
    if (!parNiveau[niv]) parNiveau[niv] = [];
    parNiveau[niv].push(s);
  });
  const sortsEl = document.getElementById('sorts-connus-list');
  if (!connus.length) {
    sortsEl.innerHTML = '<span style="color:#555;font-size:0.78rem;">Aucun sort connu</span>';
    return;
  }
  sortsEl.innerHTML = Object.keys(parNiveau).sort((a,b)=>+a-+b).map(niv => `
    <div class="sorts-niveau-group">
      <div class="sorts-niveau-header">${niv == 0 ? 'Sorts mineurs' : `Niveau ${niv}`}</div>
      ${parNiveau[niv].map(s => `
        <span class="sort-chip">${esc(s.nom)}</span>`).join('')}
    </div>`).join('');
}

function toggleSlot(emplIdx, dotIdx) {
  const empl = perso.sorts?.emplacements;
  if (!empl) return;
  const e = empl[emplIdx];
  if (!e) return;
  if (dotIdx < e.utilises) e.utilises--;
  else e.utilises++;
  markDirty('sorts', perso.sorts);
  renderSorts();
}

// ─── ÉQUIPEMENT ───────────────────────────────────────────────

function renderEquipement() {
  const tbody = document.getElementById('equip-tbody');
  const equip = perso.equipement || [];
  if (!equip.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:#555;font-size:0.78rem;">Aucun équipement</td></tr>`;
    return;
  }
  tbody.innerHTML = equip.map((e, i) => `
    <tr>
      <td>${esc(e.nom)}</td>
      <td><input type="number" value="${e.quantite||1}" min="1" style="width:44px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:4px;color:#ccc;text-align:center;padding:0.15rem;" onchange="updateItemQte(${i},+this.value)" /></td>
      <td><button onclick="supprimerItem(${i})" style="background:none;border:none;color:#555;cursor:pointer;font-size:0.75rem;">✕</button></td>
    </tr>`).join('');
}

function updateItemQte(i, qte) {
  perso.equipement[i].quantite = qte;
  markDirty('equipement', perso.equipement);
}

function supprimerItem(i) {
  perso.equipement.splice(i, 1);
  markDirty('equipement', perso.equipement);
  renderEquipement();
}

function ajouterItem() {
  const nom = prompt('Nom de l\'objet :');
  if (!nom) return;
  if (!perso.equipement) perso.equipement = [];
  perso.equipement.push({ nom: nom.trim(), quantite: 1 });
  markDirty('equipement', perso.equipement);
  renderEquipement();
}

// ─── MONNAIE ──────────────────────────────────────────────────

function renderMonnaie() {
  const m = perso.monnaie || {};
  ['pp','po','pe','pa','pc'].forEach(k => {
    const el = document.getElementById(`m-${k}`);
    if (el) el.value = m[k] || 0;
  });
}

// ─── TRAITS ───────────────────────────────────────────────────

function renderTraits() {
  const t = perso.traits || {};
  const setVal = (id, arr) => {
    const el = document.getElementById(id);
    if (el) el.value = (arr||[]).join('\n');
  };
  setVal('traits-field', t.traits_personnalite);
  setVal('ideaux-field', t.ideaux);
  setVal('liens-field', t.liens);
  setVal('defauts-field', t.defauts);
  const apEl = document.getElementById('apparence-field');
  if (apEl) apEl.value = perso.apparence || '';
  const hiEl = document.getElementById('historique-field');
  if (hiEl) hiEl.value = perso.historique_perso || '';
  const notEl = document.getElementById('notes-field');
  if (notEl) notEl.value = perso.notes || '';
}

// ─── LANGUES & MAÎTRISES ─────────────────────────────────────

function renderLanguesMaitrises() {
  const langEl = document.getElementById('langues-section');
  if (langEl) {
    const langues = (perso.langues||[]).map(l => capitalize(l));
    langEl.innerHTML = langues.length ? langues.join(', ') : '—';
  }
  const maiEl = document.getElementById('maitrises-section');
  if (maiEl) {
    const parts = [];
    if ((perso.maitrise_armes||[]).length) parts.push(`<strong style="color:#c8b8ff;">Armes :</strong> ${perso.maitrise_armes.join(', ')}`);
    if ((perso.maitrise_armures||[]).length) parts.push(`<strong style="color:#c8b8ff;">Armures :</strong> ${perso.maitrise_armures.join(', ')}`);
    if ((perso.maitrise_outils||[]).length) parts.push(`<strong style="color:#c8b8ff;">Outils :</strong> ${perso.maitrise_outils.join(', ')}`);
    maiEl.innerHTML = parts.join('<br>') || '—';
  }
}

// ─── SUPPRESSION ──────────────────────────────────────────────

async function supprimerPersonnage() {
  if (!confirm(`Supprimer définitivement "${perso.nom}" ?`)) return;
  try {
    await fetch(`${API}/Personnages/${persoId}`, { method: 'DELETE', headers: authHeaders() });
    location.href = 'mes-personnages.html';
  } catch (e) { alert('Erreur : ' + e.message); }
}

// ─── DÉMARRAGE ────────────────────────────────────────────────

waitForAuth(init);
