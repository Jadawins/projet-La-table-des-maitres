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
  window._perso = perso; // exposer pour le wizard niveau
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
  renderRessources();
  renderAttaques();
  renderSorts();
  migrerMonnaieDepuisEquipement();
  renderEquipement();
  renderMonnaie();
  renderTraits();
  renderLanguesMaitrises();
  renderDesVie();
  if (typeof renderBarreXP === 'function') renderBarreXP(perso);

  const inspDiamond = document.getElementById('inspire-diamond');
  if (inspDiamond) {
    inspDiamond.classList.toggle('active', !!perso.inspiration);
  }
  document.getElementById('bonus-maitrise-display').textContent = '+' + getBM();
  renderArmureEquipee();
  initSectionsCollapsibles();
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

// ─── ATTAQUES (voir section COMBAT plus bas pour renderAttaques) ─

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

// ─── SORTS (voir section COMBAT plus bas pour renderSorts) ────

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

// ─── ARMURE & CA ──────────────────────────────────────────────

// base CA, dexMax (99 = illimité, 0 = aucun DEX)
const ARMURES_CA = {
  'sans armure':           { base: 10, dexMax: 99 },
  'armure matelassée':     { base: 11, dexMax: 99 },
  'armure de cuir':        { base: 11, dexMax: 99 },
  'cuir clouté':           { base: 12, dexMax: 99 },
  'armure de cuir clouté': { base: 12, dexMax: 99 },
  'broigne':               { base: 12, dexMax: 99 },
  'chemise de mailles':    { base: 13, dexMax:  2 },
  'cotte de mailles':      { base: 14, dexMax:  2 },
  'cuirasse':              { base: 13, dexMax:  2 },
  'cotte de plaques':      { base: 14, dexMax:  2 },
  'demi-plate':            { base: 15, dexMax:  2 },
  'plates divisées':       { base: 16, dexMax:  0 },
  'harnois':               { base: 18, dexMax:  0 },
};
const BOUCLIER_BONUS = 2;

function _matchArmure(nom) {
  const n = (nom || '').toLowerCase().trim();
  for (const key of Object.keys(ARMURES_CA)) {
    if (key === 'sans armure') continue;
    if (n.includes(key)) return key;
  }
  return null;
}

function _hasBouclier() {
  return (perso.equipement || []).some(e => (e.nom||'').toLowerCase().includes('bouclier'));
}

function calculerCA(armureKey) {
  const data = ARMURES_CA[armureKey] || ARMURES_CA['sans armure'];
  const dexMod = getMod('DEX');
  const dexBonus = Math.min(dexMod, data.dexMax === 99 ? dexMod : data.dexMax);
  const bouclier = _hasBouclier() ? BOUCLIER_BONUS : 0;
  return data.base + dexBonus + bouclier;
}

function renderArmureEquipee() {
  const el = document.getElementById('armure-section');
  if (!el) return;

  const armuresInventaire = (perso.equipement || [])
    .map(e => ({ nom: e.nom, key: _matchArmure(e.nom) }))
    .filter(e => e.key);

  const equipee = perso.combat?.armure_equipee || 'sans armure';
  const bouclier = _hasBouclier();
  const caCalc = calculerCA(equipee);

  const options = [
    { key: 'sans armure', label: 'Sans armure (CA 10 + DEX)' },
    ...armuresInventaire.map(a => ({ key: a.key, label: a.nom }))
  ];

  el.innerHTML = `
    <div class="armure-row">
      <select class="armure-select" onchange="equiperArmure(this.value)">
        ${options.map(o => `<option value="${esc(o.key)}" ${o.key===equipee?'selected':''}>${esc(o.label)}</option>`).join('')}
      </select>
      <div class="armure-ca-badge">
        <span class="armure-ca-val">${caCalc}</span>
        <span class="armure-ca-label">CA</span>
      </div>
    </div>
    ${bouclier ? `<div class="armure-bouclier-badge"><i class="fa-solid fa-shield"></i> Bouclier +2 inclus</div>` : ''}
  `;
}

function equiperArmure(key) {
  if (!perso.combat) perso.combat = {};
  perso.combat.armure_equipee = key;
  const ca = calculerCA(key);
  perso.combat.ca = ca;
  markDirty('combat.armure_equipee', key);
  markDirty('combat.ca', ca);
  renderArmureEquipee();
  renderCombatQuick();
}

// ─── ÉQUIPEMENT ───────────────────────────────────────────────

// Détecte les items de monnaie dans l'équipement et les transfère vers perso.monnaie
function _detecterMonnaie(nomOriginal) {
  const n = nomOriginal.trim().toLowerCase().replace(/\s+/g, ' ');
  // "X pp/po/pe/pa/pc"
  const mNombre = n.match(/^(\d+)\s*(pp|po|pe|pa|pc)$/);
  if (mNombre) return { cle: mNombre[2], montant: parseInt(mNombre[1]) };
  // Juste "po", "pa", etc.
  if (/^(pp|po|pe|pa|pc)$/.test(n)) return { cle: n, montant: null };
  // "Pièces d'or" / "pieces d or" / etc. — on cherche le métal sans dépendre de l'apostrophe
  if (/pi.{0,4}ces?.{0,5}or\b/.test(n))     return { cle: 'po', montant: null };
  if (/pi.{0,4}ces?.{0,5}argent/.test(n))    return { cle: 'pa', montant: null };
  if (/pi.{0,4}ces?.{0,5}cuivre/.test(n))    return { cle: 'pc', montant: null };
  if (/pi.{0,4}ces?.{0,5}lectrum/.test(n))   return { cle: 'pe', montant: null };
  if (/pi.{0,4}ces?.{0,5}platine/.test(n))   return { cle: 'pp', montant: null };
  return null;
}

function migrerMonnaieDepuisEquipement() {
  if (!perso.equipement?.length) return;
  if (!perso.monnaie) perso.monnaie = {};
  const garder = [];
  let modifie = false;
  for (const item of perso.equipement) {
    const detect = _detecterMonnaie(item.nom || '');
    if (!detect) { garder.push(item); continue; }
    const montant = detect.montant !== null ? detect.montant : (item.quantite || 1);
    perso.monnaie[detect.cle] = (perso.monnaie[detect.cle] || 0) + montant;
    modifie = true;
  }
  if (modifie) {
    perso.equipement = garder;
    markDirty('equipement', perso.equipement);
    markDirty('monnaie', perso.monnaie);
    flushSave();
  }
}

function renderEquipement() {
  const tbody = document.getElementById('equip-tbody');
  const equip = perso.equipement || [];
  if (!equip.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:#555;font-size:0.78rem;">Aucun équipement</td></tr>`;
    return;
  }
  tbody.innerHTML = equip.map((e, i) => {
    const magBadge = e.magique ? `<span class="equip-badge-magic">✨</span>` : '';
    const harmoBadge = (e.magique && e.harmonisation_possible)
      ? `<span class="equip-badge-harmo" onclick="toggleHarmonisation(${i})" title="${e.harmonise ? 'Désharmoniser' : 'Harmoniser'}">${e.harmonise ? '⚡ Harmonisé' : '○ Harmoniser'}</span>`
      : '';
    return `<tr>
      <td>${esc(e.nom)}${magBadge}${harmoBadge}</td>
      <td><input type="number" value="${e.quantite||1}" min="1" style="width:44px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:4px;color:#ccc;text-align:center;padding:0.15rem;" onchange="updateItemQte(${i},+this.value)" /></td>
      <td><button onclick="supprimerItem(${i})" style="background:none;border:none;color:#555;cursor:pointer;font-size:0.75rem;">✕</button></td>
    </tr>`;
  }).join('');
}

function updateItemQte(i, qte) {
  perso.equipement[i].quantite = qte;
  markDirty('equipement', perso.equipement);
}

function supprimerItem(i) {
  perso.equipement.splice(i, 1);
  markDirty('equipement', perso.equipement);
  renderEquipement();
  renderArmureEquipee();
}

function ajouterItem() {
  const nom = prompt('Nom de l\'objet :');
  if (!nom) return;
  if (!perso.equipement) perso.equipement = [];
  perso.equipement.push({ nom: nom.trim(), quantite: 1 });
  markDirty('equipement', perso.equipement);
  renderEquipement();
  renderArmureEquipee();
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

// ═══════════════════════════════════════════════════════════════
//  RESSOURCES DE CLASSE
// ═══════════════════════════════════════════════════════════════

const RESSOURCES_CONFIG = {
  barbare:     [{ id:'rages',            nom:'Rages',                  icone:'🔥', maxFn: niv => niv>=17?6:niv>=12?5:niv>=6?4:niv>=3?3:2, reset:'long' }],
  druide:      [{ id:'formes_sauvages',  nom:'Formes sauvages',        icone:'🐺', maxFn: ()  => 2,                                          reset:'court' }],
  moine:       [{ id:'ki',               nom:'Points de ki',           icone:'✨', maxFn: niv => niv,                                        reset:'court' }],
  paladin:     [
    { id:'channel_divinite', nom:'Channel Divinité', icone:'⚜️', maxFn: () => 2,       reset:'court' },
    { id:'imposition_mains', nom:'Imposition des mains', icone:'🤲', maxFn: niv => niv*5, reset:'long' }
  ],
  clerc:       [{ id:'channel_divinite', nom:'Channel Divinité',       icone:'✝️', maxFn: () => 2,                                           reset:'court' }],
  ensorceleur: [{ id:'sorcellerie',      nom:'Points de sorcellerie',  icone:'💜', maxFn: niv => niv,                                        reset:'long' }],
  occultiste:  [{ id:'pacte',            nom:'Emplacements de Pacte',  icone:'📜', maxFn: niv => niv>=9?4:niv>=5?3:niv>=3?2:1,              reset:'court' }],
  guerrier:    [
    { id:'second_souffle', nom:'Second Souffle', icone:'🛡️', maxFn: () => 1,          reset:'court' },
    { id:'action_surge',   nom:'Action Surge',   icone:'⚡', maxFn: niv => niv>=17?2:1, reset:'court' }
  ],
  barde:       [{ id:'inspiration',      nom:'Inspiration bardique',   icone:'🎵', maxFn: () => Math.max(1, getMod('CHA')), reset:'court' }],
  magicien:    [{ id:'recuperation',     nom:'Récupération arcanique', icone:'📚', maxFn: niv => Math.max(1, Math.ceil(niv/2)), reset:'court' }]
};

function getConfigsClasse() {
  const classe = (perso.classe || '').toLowerCase();
  return RESSOURCES_CONFIG[classe] || [];
}

function getRessourceMax(cfg) {
  const niv = perso.niveau || 1;
  return cfg.maxFn(niv, perso);
}

function renderRessources() {
  const configs = getConfigsClasse();
  const section = document.getElementById('ressources-section');
  const list    = document.getElementById('ressources-list');
  if (!configs.length) { if (section) section.style.display = 'none'; return; }
  if (section) section.style.display = 'block';

  const classe  = (perso.classe || '').toLowerCase();
  const resData = perso.ressources_classe || {};

  list.innerHTML = `<div style="display:flex;justify-content:flex-end;margin-bottom:0.4rem;">
    <button class="btn-reset-ressources" onclick="resetRessources('long')" title="Remettre toutes les ressources au maximum (ex: après repos long)">
      <i class="fa-solid fa-rotate-right"></i> Reset
    </button>
  </div>` + configs.map(cfg => {
    const maxVal = getRessourceMax(cfg);
    const cur    = resData[cfg.id]?.actuel ?? maxVal;
    const safe   = Math.min(Math.max(0, cur), maxVal);
    const displayMax = maxVal > 20 ? 0 : maxVal;
    const cases = displayMax > 0
      ? Array.from({ length: maxVal }, (_, i) =>
          `<div class="ressource-case ${classe} ${i < safe ? 'pleine' : ''}" onclick="toggleRessourceCase('${cfg.id}',${i},${maxVal})"></div>`
        ).join('')
      : '';

    return `
    <div class="ressource-row">
      <span class="ressource-icone">${cfg.icone}</span>
      <span class="ressource-nom">${cfg.nom}</span>
      ${displayMax > 0 ? `<div class="ressource-cases">${cases}</div>` : ''}
      <span class="ressource-chiffre">${safe}/${maxVal}</span>
      <div class="ressource-controls">
        <button class="res-btn moins" onclick="modifierRessource('${cfg.id}',-1,${maxVal})">−</button>
        <button class="res-btn plus"  onclick="modifierRessource('${cfg.id}',+1,${maxVal})">+</button>
      </div>
      <span class="res-badge-reset ${cfg.reset}">${cfg.reset === 'court' ? 'Court' : 'Long'}</span>
    </div>`;
  }).join('');
}

function toggleRessourceCase(id, idx, maxVal) {
  if (!perso.ressources_classe) perso.ressources_classe = {};
  const cur = perso.ressources_classe[id]?.actuel ?? maxVal;
  perso.ressources_classe[id] = { actuel: cur > idx ? idx : idx + 1, max: maxVal };
  sauvegarderRessource(id, perso.ressources_classe[id].actuel);
  renderRessources();
}

function modifierRessource(id, delta, maxVal) {
  if (!perso.ressources_classe) perso.ressources_classe = {};
  const cur  = perso.ressources_classe[id]?.actuel ?? maxVal;
  const nouv = Math.max(0, Math.min(maxVal, cur + delta));
  perso.ressources_classe[id] = { actuel: nouv, max: maxVal };
  sauvegarderRessource(id, nouv);
  renderRessources();
}

async function sauvegarderRessource(id, valeur) {
  try {
    await fetch(`${API}/Personnages/${persoId}/ressources`, {
      method: 'PUT', headers: authHeaders(),
      body: JSON.stringify({ ressource: id, valeur })
    });
  } catch(e) { /* silencieux */ }
}

// ═══════════════════════════════════════════════════════════════
//  SYSTÈME DE REPOS
// ═══════════════════════════════════════════════════════════════

let _reposActifId  = null;
let _reposActif    = null;
let _reposType     = null;
let _timerInterval = null;

function proposerRepos(type) {
  _reposType = type;
  const titrEl = document.getElementById('proposer-repos-titre');
  if (titrEl) titrEl.textContent = type === 'court' ? '🌙 Proposer un Repos Court' : '💤 Proposer un Repos Long';
  const effets = type === 'court'
    ? ['Dépenser des dés de vie pour récupérer des PV', 'Reset ressources court (Formes sauvages, Ki, Channel, Second Souffle…)', 'NE reset PAS les emplacements de sorts (sauf Occultiste)']
    : ['Récupération complète des PV', 'Récupération de la moitié des dés de vie', 'Reset de toutes les ressources', 'Reset de tous les emplacements de sorts', 'Réduction de 1 niveau d\'Épuisement'];
  const efftEl = document.getElementById('proposer-repos-effets');
  if (efftEl) efftEl.innerHTML = effets.map(e => `<li>${e}</li>`).join('');
  document.getElementById('modal-proposer-repos').classList.remove('hidden');
}

async function confirmerProposerRepos() {
  const sessionId = getSessionIdFiche();
  if (!sessionId) { alert('Aucune session active. Ouvrez la fiche depuis une session.'); return; }
  const mode  = document.getElementById('repos-mode').value;
  const timer = parseInt(document.getElementById('repos-timer').value) || 0;
  try {
    const r = await fetch(`${API}/Repos`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ session_id: sessionId, type: _reposType, demandeur_nom: perso.nom || 'Joueur', mode_validation: mode, timer_secondes: timer })
    });
    if (!r.ok) throw new Error((await r.json()).error);
    const data = await r.json();
    _reposActifId = data._id; _reposActif = data;
    document.getElementById('modal-proposer-repos').classList.add('hidden');
    afficherResultatRepos('✅ Vote créé ! En attente des réponses…', 'succes');
    // Toast local
    if (typeof toastLocal === 'function') {
      toastLocal('repos', `🌙 Repos ${_reposType} proposé`, `${perso.nom} propose un repos. Vote en cours…`);
    }
  } catch(e) {
    afficherResultatRepos(`❌ ${e.message}`, 'echec');
    document.getElementById('modal-proposer-repos').classList.add('hidden');
  }
}

async function verifierVoteRepos() {
  const sessionId = getSessionIdFiche();
  if (!sessionId) return;
  try {
    const r = await fetch(`${API}/Repos/actif/${sessionId}`, { headers: authHeaders() });
    if (!r.ok) {
      masquerNotifRepos();
      if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
      if (_reposActifId) { _reposActifId = null; _reposActif = null; }
      return;
    }
    const data = await r.json();
    _reposActifId = data._id; _reposActif = data;

    const userId = localStorage.getItem('userId');
    const dejaVote = (data.votes || []).find(v => v.user_id === userId);

    const badge = document.getElementById('repos-notif-badge');
    if (badge) {
      badge.textContent = `⏰ ${data.demandeur_nom} propose un Repos ${data.type === 'court' ? 'Court' : 'Long'}`;
      badge.classList.add('visible');
    }
    if (data.timer_expire && !_timerInterval) demarrerTimerRepos(data.timer_expire);

    // Ouvrir modal si pas encore voté et pas l'initiateur
    if (!dejaVote && data.demandeur_id !== userId) {
      const modal = document.getElementById('modal-vote-repos');
      if (modal && modal.classList.contains('hidden')) ouvrirModalVoteRepos();
    }

    // Si résolu → appliquer
    if (data.statut === 'accepte' || data.statut === 'force') {
      await appliquerEffetsRepos(data);
      masquerNotifRepos();
    } else if (data.statut === 'refuse' || data.statut === 'expire') {
      masquerNotifRepos();
    }
  } catch(e) { /* silencieux */ }
}

function masquerNotifRepos() {
  document.getElementById('repos-notif-badge')?.classList.remove('visible');
}

function demarrerTimerRepos(expireDate) {
  if (_timerInterval) clearInterval(_timerInterval);
  _timerInterval = setInterval(() => {
    const restant = Math.max(0, Math.floor((new Date(expireDate) - new Date()) / 1000));
    const el = document.getElementById('vote-repos-timer');
    if (el) { el.textContent = `⏱️ ${String(Math.floor(restant/60)).padStart(2,'0')}:${String(restant%60).padStart(2,'0')}`; el.style.display='block'; }
    if (restant <= 0) { clearInterval(_timerInterval); _timerInterval = null; }
  }, 1000);
}

function ouvrirModalVoteRepos() {
  if (!_reposActif) return;
  const data = _reposActif;
  const userId = localStorage.getItem('userId');
  document.getElementById('vote-repos-titre').textContent =
    `${data.type==='court'?'🌙':'💤'} ${data.demandeur_nom} propose un Repos ${data.type==='court'?'Court':'Long'}`;
  document.getElementById('vote-repos-effets').textContent =
    data.type==='court' ? '• Dés de vie → PV  • Reset ressources court' : '• PV max  • Toutes ressources  • Sorts reset';
  const liste = document.getElementById('vote-repos-liste');
  liste.innerHTML = (data.votes||[]).map(v => `
    <div class="vote-item"><span class="v-nom">${esc(v.nom)}</span>
    <span class="v-rep ${v.reponse||'att'}">${v.reponse==='ok'?'✅ OK':v.reponse==='non'?'❌ Non':'⏳ ?'}</span></div>`
  ).join('') || '<div style="color:#555;font-size:0.75rem;">Aucun vote pour l\'instant</div>';
  if (data.timer_expire) demarrerTimerRepos(data.timer_expire);
  const dejaVote = (data.votes||[]).find(v => v.user_id === userId);
  document.querySelectorAll('#modal-vote-repos .vote-btn').forEach(b => b.style.display = dejaVote ? 'none' : '');
  document.getElementById('modal-vote-repos').classList.remove('hidden');
}

async function voterRepos(reponse) {
  if (!_reposActifId) return;
  const userId = localStorage.getItem('userId');
  try {
    const r = await fetch(`${API}/Repos/${_reposActifId}/vote`, {
      method: 'PUT', headers: authHeaders(),
      body: JSON.stringify({ user_id: userId, nom: perso.nom||'Joueur', reponse })
    });
    const data = await r.json();
    document.getElementById('modal-vote-repos').classList.add('hidden');
    masquerNotifRepos();
    if (data.statut === 'accepte' || data.statut === 'force') await appliquerEffetsRepos(_reposActif);
    else afficherResultatRepos(`Vote : ${reponse==='ok'?'✅ OK':'❌ Non'}`, reponse==='ok'?'succes':'echec');
  } catch(e) { console.error(e); }
}

async function appliquerEffetsRepos(data) {
  if (!data) return;
  const isLong = data.type === 'long';
  if (isLong) {
    perso.combat = perso.combat || {};
    const pvMax = perso.combat.pv_max || 10;
    perso.combat.pv_actuels = pvMax;
    document.getElementById('pv-actuels').value = pvMax;
    updatePVBar();
    const dvTotal = perso.combat.des_vie?.total || (perso.niveau||1);
    const dvRest  = perso.combat.des_vie?.restants ?? dvTotal;
    if (!perso.combat.des_vie) perso.combat.des_vie = {};
    perso.combat.des_vie.restants = Math.min(dvTotal, dvRest + Math.max(1, Math.floor(dvTotal/2)));
    const dvEl = document.getElementById('dv-restants');
    if (dvEl) dvEl.value = perso.combat.des_vie.restants;
    if (perso.sorts?.emplacements?.length) perso.sorts.emplacements = perso.sorts.emplacements.map(e => ({...e, utilises:0}));
    renderSorts();
    flashPV('soin');
    afficherResultatRepos('💤 Repos long ! Toutes ressources récupérées.', 'succes');
  } else {
    ouvrirModalDVCourt();
    afficherResultatRepos('🌙 Repos court ! Ressources récupérées.', 'succes');
  }
  resetRessources(isLong ? 'long' : 'court');
  _reposActifId = null; _reposActif = null;
  const payload = {};
  if (isLong) {
    payload['combat.pv_actuels'] = perso.combat.pv_actuels;
    payload['combat.des_vie']    = perso.combat.des_vie;
    if (perso.sorts?.emplacements) payload['sorts.emplacements'] = perso.sorts.emplacements;
  }
  payload['ressources_classe'] = perso.ressources_classe;
  try {
    await fetch(`${API}/Personnages/${persoId}`, { method:'PUT', headers:authHeaders(), body:JSON.stringify(payload) });
  } catch(e) { /* silencieux */ }
}

function resetRessources(type) {
  const configs = getConfigsClasse();
  if (!perso.ressources_classe) perso.ressources_classe = {};
  for (const cfg of configs) {
    if (type === 'long' || cfg.reset === 'court') {
      const maxVal = getRessourceMax(cfg);
      perso.ressources_classe[cfg.id] = { actuel: maxVal, max: maxVal };
    }
  }
  renderRessources();
}

function ouvrirModalDVCourt() {
  const combat = perso.combat || {};
  const dvTotal = combat.des_vie?.total || (perso.niveau||1);
  const dvRest  = combat.des_vie?.restants ?? dvTotal;
  const dvType  = combat.des_vie?.type || 'd8';
  document.getElementById('dv-court-info').textContent =
    `Dés de vie : ${dvRest}/${dvTotal} (${dvType}). Chaque dé : 1${dvType} + ${fmtMod(getMod('CON'))} PV`;
  document.getElementById('dv-depenser').value = Math.min(1, dvRest);
  document.getElementById('dv-pv-gain').textContent = '';
  document.getElementById('modal-dv-court').classList.remove('hidden');
}

function calculerSoinDV() {
  const nb    = parseInt(document.getElementById('dv-depenser').value) || 0;
  const faces = parseInt((perso.combat?.des_vie?.type||'d8').replace('d','')) || 8;
  const moyen = Math.floor((faces/2+0.5)*nb + getMod('CON')*nb);
  document.getElementById('dv-pv-gain').textContent = `≈ +${Math.max(0,moyen)} PV (moy.)`;
}

function appliquerDVCourt() {
  const nb    = parseInt(document.getElementById('dv-depenser').value) || 0;
  const combat = perso.combat || {};
  const dvTotal = combat.des_vie?.total || (perso.niveau||1);
  const dvRest  = combat.des_vie?.restants ?? dvTotal;
  const faces   = parseInt((combat.des_vie?.type||'d8').replace('d','')) || 8;
  if (nb > dvRest) { alert(`Vous n'avez que ${dvRest} dé(s) de vie.`); return; }
  let total = 0;
  for (let i=0;i<nb;i++) total += Math.floor(Math.random()*faces)+1;
  total += getMod('CON')*nb;
  total = Math.max(0, total);
  const pvMax  = combat.pv_max || 10;
  const pvNouv = Math.min(pvMax, (combat.pv_actuels ?? pvMax) + total);
  perso.combat.pv_actuels = pvNouv;
  if (!perso.combat.des_vie) perso.combat.des_vie = {};
  perso.combat.des_vie.restants = dvRest - nb;
  document.getElementById('pv-actuels').value = pvNouv;
  const dvEl = document.getElementById('dv-restants');
  if (dvEl) dvEl.value = dvRest - nb;
  updatePVBar();
  flashPV('soin');
  markDirty('combat.pv_actuels', pvNouv);
  markDirty('combat.des_vie', perso.combat.des_vie);
  document.getElementById('modal-dv-court').classList.add('hidden');
  afficherResultatRepos(`🌙 ${nb}${combat.des_vie?.type||'d8'} lancé(s) : +${total} PV → ${pvNouv}/${pvMax}`, 'succes');
}

function afficherResultatRepos(msg, type) {
  ['repos-result', 'repos-result-fiche'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<div class="repos-result-msg ${type}">${msg}</div>`;
    setTimeout(() => { el.innerHTML = ''; }, 6000);
  });
}

window.proposerRepos          = proposerRepos;
window.confirmerProposerRepos = confirmerProposerRepos;
window.ouvrirModalVoteRepos   = ouvrirModalVoteRepos;
window.voterRepos             = voterRepos;
window.ouvrirModalDVCourt     = ouvrirModalDVCourt;
window.calculerSoinDV         = calculerSoinDV;
window.appliquerDVCourt       = appliquerDVCourt;
window.modifierRessource      = modifierRessource;
window.toggleRessourceCase    = toggleRessourceCase;

// ─── COMBAT : ATTAQUES AMÉLIORÉES (avec bouton Attaquer) ──────

function renderAttaques() {
  const tbody = document.getElementById('attaques-tbody');
  const attacks = perso.attaques || [];
  if (!attacks.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:#555;font-size:0.78rem;text-align:center;padding:0.5rem;">Aucune attaque</td></tr>`;
    return;
  }
  tbody.innerHTML = attacks.map((a, i) => `
    <tr>
      <td>${esc(a.nom)}</td>
      <td class="atk-bonus">${esc(a.bonus_attaque)}</td>
      <td class="atk-degats">${esc(a.degats)} <span style="color:#888;font-size:0.65rem;">${esc(a.type||'')}</span></td>
      <td>${combatActif ? `<button class="atk-btn-attaquer" onclick="ouvrirAttaqueCombat(${i})">⚔️</button>` : ''}</td>
      <td><button class="btn-icon" style="color:#555;background:none;border:none;cursor:pointer;font-size:0.75rem;" onclick="supprimerAttaque(${i})">✕</button></td>
    </tr>`).join('');
}

// ─── SORTS AMÉLIORÉS (avec bouton Lancer) ────────────────────

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

  // Emplacements — auto-calcul si absent et magie-tables disponible
  let empl = sorts.emplacements || [];
  if (!empl.length && typeof getSlotsEmplacements === 'function') {
    const classe = (perso.classe || '').toLowerCase();
    const niveau = perso.niveau || 1;
    const calcules = getSlotsEmplacements(classe, niveau);
    if (calcules.length) {
      empl = calcules;
      sorts.emplacements = empl;
      markDirty('sorts', sorts);
    }
  }

  const slots = document.getElementById('spell-slots');
  if (!empl.length) {
    slots.innerHTML = '<span class="empl-vide">Aucun emplacement (sorts mineurs uniquement)</span>';
  } else {
    slots.innerHTML = empl.map((e, i) => {
      const isPacte = e.type === 'pacte';
      const label = isPacte ? `Pacte Niv.${e.niveau}` : `Niv.${e.niveau||i+1}`;
      const dots = Array.from({ length: e.total }, (_, j) => `
        <div class="slot-dot ${j < e.utilises ? 'used' : 'available'}"
             onclick="toggleSlot(${i},${j})"></div>`).join('');
      return `<div class="spell-slot-col${isPacte ? ' pact-slot-col' : ''}">
        <div class="slot-level-label">${label}</div>
        <div class="slot-dots">${dots}</div>
      </div>`;
    }).join('');
  }

  // Sorts connus par niveau — avec bouton Lancer
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
  sortsEl.innerHTML = Object.keys(parNiveau).sort((a,b)=>+a-+b).map(niv => {
    const collapsed = localStorage.getItem('sorts_niv_collapsed_' + niv) === '1' ? ' collapsed' : '';
    const label = niv == 0 ? 'Sorts mineurs' : `Niveau ${niv}`;
    const count = parNiveau[niv].length;
    return `
    <div class="sorts-niveau-group${collapsed}" id="sng-${niv}">
      <div class="sorts-niveau-header" onclick="toggleSortsNiveau(${niv})">
        <span>${label}</span>
        <span class="sng-count">${count}</span>
        <span class="sng-arrow">▾</span>
      </div>
      <div class="sng-content">
        ${parNiveau[niv].map(s => `
          <div class="sort-row-item"
               data-sort-nom="${esc(s.nom)}"
               data-sort-ecole="${esc(s.ecole||'')}"
               data-sort-portee="${esc(s.portee||'')}"
               data-sort-duree="${esc(s.duree||'')}"
               data-sort-temps="${esc(s.temps_incantation||'')}"
               data-sort-desc="${esc((s.description||'').slice(0,300))}"
               data-sort-id="${esc(s.id||'')}"
               data-sort-niveau="${niv}"
               onmouseenter="showSortTooltip(event,this)"
               onmouseleave="hideSortTooltip()">
            <span class="sort-nom-label">${esc(s.nom)}</span>
            ${s.concentration ? '<span class="sort-badge-c">C</span>' : ''}
            ${s.rituel ? '<span class="sort-badge-r">R</span>' : ''}
            ${combatActif ? `<button class="btn-lancer-sort" onclick="lancerSortCombat('${esc(s.nom)}',${niv},${!!s.concentration})">Lancer</button>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  renderSortsRaciaux();
}

function renderSortsRaciaux() {
  const section = document.getElementById('sorts-raciaux-section');
  const list = document.getElementById('sorts-raciaux-list');
  if (!section || !list) return;
  const raciaux = perso.sorts?.sorts_raciaux || [];
  if (!raciaux.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  list.innerHTML = raciaux.map(s => {
    const util = s.utilisation === 'a_volonte' ? 'À volonté' : s.utilisation.replace(/_/g,' ');
    const niv = s.niveau_sort === 0 ? 'Mineur' : `Niv.${s.niveau_sort}`;
    return `<div class="sort-row-item">
      <span class="sort-nom-label">${esc(s.nom)}</span>
      <span class="sort-badge-racial" title="Sort racial">Racial</span>
      <span style="font-size:0.7rem;color:#888;margin-left:0.4rem;">${niv} — ${util}</span>
      ${s.caracteristique ? `<span style="font-size:0.7rem;color:#a090e0;margin-left:0.3rem;">${s.caracteristique}</span>` : ''}
    </div>`;
  }).join('');
}

// ─── COMBAT JOUEUR : ÉTAT GLOBAL ─────────────────────────────

let combatActif      = false;
let combatId_fiche   = null;
let combatData_fiche = null;
let _pvPrecedent     = null;
let _joueurPartId    = null;
let _refreshCombatTimer = null;
let _actionUtilisee  = false;
let _bonusUtilise    = false;
let _reactionUtilisee = false;
let _atkEnCours      = null; // { attaque, index }
let _sortEnCours     = null;
let _ciblSelecte     = null;

function getSessionIdFiche() {
  return localStorage.getItem('sessionId') || new URLSearchParams(location.search).get('session');
}

// ─── AUTO-REFRESH COMBAT (5s) ─────────────────────────────────

async function refreshCombatFiche() {
  const sessionId = getSessionIdFiche();
  if (!sessionId) return;
  try {
    const r = await fetch(`${API}/Combats/${sessionId}`, { headers: authHeaders() });
    if (!r.ok) {
      if (combatActif) { combatActif = false; masquerPanelCombat(); }
      return;
    }
    const data = await r.json();
    combatData_fiche = data;
    combatId_fiche   = data._id;

    if (!combatActif) { combatActif = true; afficherPanelCombat(); }

    // Trouver le participant correspondant à ce joueur
    const userId = localStorage.getItem('userId');
    _joueurPartId = (data.participants || []).find(p => p.user_id === userId)?.id || null;
    const joueurPart = data.participants.find(p => p.id === _joueurPartId);

    // PV flash
    if (joueurPart && _pvPrecedent !== null) {
      if (joueurPart.pv_actuels < _pvPrecedent) flashPV('degats');
      else if (joueurPart.pv_actuels > _pvPrecedent) flashPV('soin');
    }
    if (joueurPart) {
      _pvPrecedent = joueurPart.pv_actuels;
      // Mettre à jour la barre PV si les PV ont changé depuis le MJ
      const pvActEl = document.getElementById('pv-actuels');
      if (pvActEl && parseInt(pvActEl.value) !== joueurPart.pv_actuels) {
        pvActEl.value = joueurPart.pv_actuels;
        if (!perso.combat) perso.combat = {};
        perso.combat.pv_actuels = joueurPart.pv_actuels;
        updatePVBar();
      }
      // Interface mort
      if (joueurPart.pv_actuels === 0) afficherInterfaceMort(joueurPart);
      else masquerInterfaceMort();
    }

    // Indicateur de tour
    const sorted = [...data.participants].sort((a,b) => b.initiative - a.initiative);
    const partActuel = sorted[data.tour_actuel];
    const monTour = partActuel && partActuel.id === _joueurPartId;

    const badgeMon = document.getElementById('badge-mon-tour');
    const badgeAtt = document.getElementById('badge-attente');
    if (monTour) {
      badgeMon.classList.add('visible');
      badgeAtt.textContent = '';
      // Reset actions au début du tour
      if (!_actionUtilisee && !_bonusUtilise && !_reactionUtilisee) resetActionsTour();
    } else {
      badgeMon.classList.remove('visible');
      badgeAtt.textContent = partActuel ? `En attente du tour de ${partActuel.nom}…` : '';
    }

    // Journal
    await chargerJournalFiche();

  } catch (e) { /* silencieux */ }
}

async function chargerJournalFiche() {
  if (!combatId_fiche) return;
  try {
    const r = await fetch(`${API}/Combats/${combatId_fiche}/journal`, { headers: authHeaders() });
    if (!r.ok) return;
    const entries = await r.json();
    renderJournalFiche(entries);
  } catch (e) { /* silencieux */ }
}

function renderJournalFiche(entries) {
  const el = document.getElementById('journal-combat-fiche');
  if (!el) return;
  if (!entries.length) { el.innerHTML = '<span style="color:#555;font-size:0.72rem;">Journal vide…</span>'; return; }
  el.innerHTML = entries.slice(-30).map(e => {
    const heure = new Date(e.timestamp).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    const cls = e.type === 'combat' ? (e.contenu.includes('💚') ? 'soin' : 'combat') : e.type || '';
    return `<div class="journal-entry ${cls}"><span class="j-heure">${heure}</span>${esc(e.contenu)}</div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function flashPV(type) {
  const el = document.getElementById('pv-flash-overlay');
  if (!el) return;
  el.className = '';
  void el.offsetWidth; // reflow
  el.className = `flash-${type}`;
  if (navigator.vibrate) navigator.vibrate(type === 'degats' ? [200] : [80]);
}

function afficherPanelCombat() {
  const panel = document.getElementById('combat-panel');
  if (panel) panel.classList.add('actif');
  renderAttaques(); // re-render pour afficher boutons Attaquer
  renderSorts();
}

function masquerPanelCombat() {
  const panel = document.getElementById('combat-panel');
  if (panel) panel.classList.remove('actif');
  renderAttaques();
  renderSorts();
}

function afficherInterfaceMort(participant) {
  const el = document.getElementById('mort-interface');
  if (!el) return;
  el.classList.add('visible');
  const jm = participant.jets_mort || { succes: 0, echecs: 0 };
  ['succes','echec'].forEach(type => {
    const dots = document.querySelectorAll(`#mort-dots-${type === 'succes' ? 'succes' : 'echecs'} .mort-dot`);
    dots.forEach((d, i) => {
      d.className = 'mort-dot';
      if (type === 'succes' && i < jm.succes) d.classList.add('succes-filled');
      if (type === 'echec'  && i < jm.echecs) d.classList.add('echec-filled');
    });
  });
}

function masquerInterfaceMort() {
  const el = document.getElementById('mort-interface');
  if (el) el.classList.remove('visible');
}

async function jetMort(resultat) {
  if (!combatId_fiche || !_joueurPartId) return;
  try {
    const r = await fetch(`${API}/Combats/${combatId_fiche}/mort`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ participant_id: _joueurPartId, resultat })
    });
    const data = await r.json();
    const msg = document.getElementById('mort-message');
    if (msg) {
      msg.textContent = data.log || '';
      msg.style.color = data.stabilise ? '#4ade80' : data.mort ? '#f87171' : '#aaa';
    }
    if (data.stabilise || data.mort) {
      setTimeout(masquerInterfaceMort, 3000);
    }
    if (data.succes !== undefined) {
      // Mettre à jour les dots
      const part = combatData_fiche?.participants?.find(p => p.id === _joueurPartId);
      if (part) {
        part.jets_mort = { succes: data.succes, echecs: data.echecs };
        part.pv_actuels = data.pv_actuels ?? part.pv_actuels;
        afficherInterfaceMort(part);
      }
    }
  } catch (e) { console.error(e); }
}

// ─── ACTIONS DE TOUR ──────────────────────────────────────────

function resetActionsTour() {
  _actionUtilisee   = false;
  _bonusUtilise     = false;
  _reactionUtilisee = false;
  const slots = ['slot-action','slot-bonus','slot-reaction'];
  slots.forEach(id => document.getElementById(id)?.classList.remove('utilise'));
}

function marquerAction() {
  _actionUtilisee = true;
  document.getElementById('slot-action')?.classList.add('utilise');
}
function marquerBonus() {
  _bonusUtilise = true;
  document.getElementById('slot-bonus')?.classList.add('utilise');
}
function marquerReaction() {
  _reactionUtilisee = true;
  document.getElementById('slot-reaction')?.classList.add('utilise');
}

// ─── ATTAQUE EN COMBAT ────────────────────────────────────────

function ouvrirAttaqueCombat(atkIdx) {
  if (!combatData_fiche) return;
  const atk = (perso.attaques || [])[atkIdx];
  if (!atk) return;
  _atkEnCours   = { attaque: atk, index: atkIdx };
  _ciblSelecte  = null;

  document.getElementById('atk-combat-nom').textContent   = atk.nom;
  document.getElementById('atk-combat-bonus').textContent = atk.bonus_attaque || '+0';
  document.getElementById('atk-d20').value     = '';
  document.getElementById('atk-degats-val').value = '';
  document.getElementById('atk-type-label').textContent = atk.type || '';
  document.getElementById('atk-result-box').style.display  = 'none';
  document.getElementById('atk-degats-row').style.display  = 'none';

  // Peupler la liste des cibles (participants visibles hors joueur)
  const cibles = (combatData_fiche.participants || []).filter(p => p.id !== _joueurPartId);
  const listEl = document.getElementById('cibles-list');
  listEl.innerHTML = cibles.length
    ? cibles.map(p => `
        <div class="cible-item" data-pid="${p.id}" onclick="selectionnerCible('${p.id}')">
          <span>${esc(p.nom)}</span>
          <span>
            <span class="cible-ca">CA ${p.ca}</span>
            <span class="cible-pv">PV ${p.pv_actuels}/${p.pv_max}</span>
          </span>
        </div>`).join('')
    : '<div style="color:#555;font-size:0.78rem;">Aucune cible visible</div>';

  document.getElementById('modal-attaque-combat').classList.remove('hidden');
}

function selectionnerCible(pid) {
  _ciblSelecte = pid;
  document.querySelectorAll('#cibles-list .cible-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.pid === pid);
  });
  calculerResultatAttaque();
}

function calculerResultatAttaque() {
  if (!_atkEnCours) return;
  const d20 = parseInt(document.getElementById('atk-d20').value);
  if (isNaN(d20)) return;

  // Parser le bonus
  const bonusStr = _atkEnCours.attaque.bonus_attaque || '+0';
  const bonus = parseInt(bonusStr.replace(/^\+/, '')) || 0;
  const total = d20 + bonus;

  const cible = _ciblSelecte ? (combatData_fiche?.participants || []).find(p => p.id === _ciblSelecte) : null;
  const ca = cible?.ca || '?';

  const boxEl  = document.getElementById('atk-result-box');
  const totEl  = document.getElementById('atk-result-total');
  const verdEl = document.getElementById('atk-result-verdict');
  boxEl.style.display = 'block';
  totEl.textContent   = `${total} vs CA ${ca}`;

  if (d20 === 1) {
    verdEl.textContent = '💨 Raté automatiquement !'; verdEl.className = 'verdict rate';
    document.getElementById('atk-degats-row').style.display = 'none';
  } else if (d20 === 20) {
    verdEl.textContent = '💥 COUP CRITIQUE ! (dés doublés)'; verdEl.className = 'verdict critique';
    document.getElementById('atk-degats-row').style.display = 'flex';
  } else if (cible && total >= ca) {
    verdEl.textContent = '✅ Touché !'; verdEl.className = 'verdict touche';
    document.getElementById('atk-degats-row').style.display = 'flex';
  } else {
    verdEl.textContent = cible ? '❌ Raté !' : '(choisir une cible)'; verdEl.className = 'verdict rate';
    document.getElementById('atk-degats-row').style.display = 'none';
  }
}

async function confirmerAttaqueCombat() {
  if (!_atkEnCours || !combatId_fiche) return;
  const d20 = parseInt(document.getElementById('atk-d20').value);
  if (isNaN(d20)) return;
  const degats = parseInt(document.getElementById('atk-degats-val').value) || 0;
  const userId = localStorage.getItem('userId');

  try {
    await fetch(`${API}/Combats/${combatId_fiche}/attaque`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        attaquant_id: _joueurPartId || userId,
        cible_id: _ciblSelecte,
        d20,
        degats,
        type_degats: _atkEnCours.attaque.type || ''
      })
    });
    document.getElementById('modal-attaque-combat').classList.add('hidden');
    marquerAction();
    await chargerJournalFiche();
  } catch (e) { console.error(e); }
}

// ─── SORT EN COMBAT ───────────────────────────────────────────

function ouvrirModalSortCombat() {
  if (!combatData_fiche) return;
  const sorts = perso.sorts?.sorts_connus || [];
  const listEl = document.getElementById('sorts-modal-list');
  listEl.innerHTML = sorts.length
    ? sorts.map(s => `
        <div class="sort-modal-item" data-snom="${esc(s.nom)}" data-sniv="${s.niveau||0}" data-sconc="${!!s.concentration}" onclick="selectionnerSortModal(this,'${esc(s.nom)}',${s.niveau||0},${!!s.concentration})">
          <span>${esc(s.nom)}</span>
          <span>
            <span class="sort-m-niv">Niv.${s.niveau||0}</span>
            ${s.concentration ? '<span class="sort-badge-c" style="margin-left:0.3rem;">C</span>' : ''}
          </span>
        </div>`).join('')
    : '<div style="color:#555;font-size:0.78rem;">Aucun sort connu</div>';

  // Cibles
  const cibles = (combatData_fiche.participants || []).filter(p => p.id !== _joueurPartId);
  document.getElementById('sort-cibles-list').innerHTML = cibles.map(p => `
    <div class="cible-item" data-pid="${p.id}" onclick="selectionnerCibleSort('${p.id}')">
      <span>${esc(p.nom)}</span>
      <span class="cible-pv">PV ${p.pv_actuels}/${p.pv_max}</span>
    </div>`).join('');

  _sortEnCours = null; _ciblSelecte = null;
  document.getElementById('sort-cible-section').style.display = 'none';
  document.getElementById('sort-jet-section').style.display   = 'none';
  document.getElementById('sort-d20').value    = '';
  document.getElementById('sort-degats').value = '';
  document.getElementById('sort-type-degats').value = '';
  document.getElementById('modal-sort-combat').classList.remove('hidden');
}

function lancerSortCombat(nom, niv, concentration) {
  ouvrirModalSortCombat();
  setTimeout(() => {
    const item = document.querySelector(`[data-snom="${nom}"]`);
    if (item) selectionnerSortModal(item, nom, niv, concentration);
  }, 50);
}

function selectionnerSortModal(el, nom, niv, conc) {
  _sortEnCours = { nom, niveau: niv, concentration: conc };
  document.querySelectorAll('.sort-modal-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('sort-cible-section').style.display = 'block';
  document.getElementById('sort-jet-section').style.display   = 'flex';
}

function selectionnerCibleSort(pid) {
  _ciblSelecte = pid;
  document.querySelectorAll('#sort-cibles-list .cible-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.pid === pid);
  });
}

async function confirmerSortCombat() {
  if (!_sortEnCours || !combatId_fiche) return;
  const userId = localStorage.getItem('userId');
  const body = {
    lanceur_id: _joueurPartId || userId,
    sort_nom:   _sortEnCours.nom,
    sort_niveau: _sortEnCours.niveau,
    concentration: _sortEnCours.concentration,
    cible_id: _ciblSelecte || null,
    d20: parseInt(document.getElementById('sort-d20').value) || null,
    degats: parseInt(document.getElementById('sort-degats').value) || 0,
    type_degats: document.getElementById('sort-type-degats').value.trim()
  };

  // Si concentration, vérifier si déjà concentré
  if (_sortEnCours.concentration) {
    const moi = combatData_fiche?.participants?.find(p => p.id === _joueurPartId);
    if (moi && (moi.conditions || []).includes('concentre')) {
      alert(`⚠️ Vous perdez la concentration sur ${moi.sort_concentration || 'votre sort précédent'}.`);
    }
  }

  try {
    await fetch(`${API}/Combats/${combatId_fiche}/sort`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
    document.getElementById('modal-sort-combat').classList.add('hidden');
    marquerAction();
    await chargerJournalFiche();
  } catch (e) { console.error(e); }
}

// ─── JET DE SAUVEGARDE ────────────────────────────────────────

function ouvrirModalSauvegarde() {
  document.getElementById('js-d20').value = '';
  document.getElementById('js-result-box').style.display = 'none';
  document.getElementById('modal-sauvegarde').classList.remove('hidden');
}

function calculerJS() {
  const d20 = parseInt(document.getElementById('js-d20').value);
  const car  = document.getElementById('js-car').value;
  const dd   = parseInt(document.getElementById('js-dd').value) || 10;
  if (isNaN(d20)) return;

  // Trouver le bonus de sauvegarde
  const s = (perso.jets_sauvegarde || {})[car] || {};
  const hasMaitrise = s.maitrise || false;
  const bonus = getMod(car) + (hasMaitrise ? getBM() : 0);
  const total = d20 + bonus;
  const reussi = total >= dd;

  const el = document.getElementById('js-result-box');
  el.style.display = 'block';
  el.className = `js-result ${reussi ? 'reussi' : 'rate'}`;
  el.textContent = `${car} : d20(${d20}) ${bonus >= 0 ? '+' : ''}${bonus} = ${total} vs DD ${dd} — ${reussi ? '✅ Réussi !' : '❌ Raté !'}`;

  // Concentration automatique si CON
  if (car === 'CON' && !reussi) {
    const moi = combatData_fiche?.participants?.find(p => p.id === _joueurPartId);
    if (moi && (moi.conditions || []).includes('concentre')) {
      el.textContent += ` 💨 Concentration brisée !`;
    }
  }
}

async function confirmerSauvegarde() {
  if (!combatId_fiche || !_joueurPartId) {
    document.getElementById('modal-sauvegarde').classList.add('hidden');
    return;
  }
  const d20  = parseInt(document.getElementById('js-d20').value);
  const car  = document.getElementById('js-car').value;
  const dd   = parseInt(document.getElementById('js-dd').value) || 10;
  if (isNaN(d20)) { document.getElementById('modal-sauvegarde').classList.add('hidden'); return; }

  const s = (perso.jets_sauvegarde || {})[car] || {};
  const bonus = getMod(car) + (s.maitrise ? getBM() : 0);

  try {
    const r = await fetch(`${API}/Combats/${combatId_fiche}/sauvegarde`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ participant_id: _joueurPartId, caracteristique: car, d20, modificateur: bonus, dd })
    });
    const data = await r.json();
    if (data.concentration_brisee) alert('💨 Votre Concentration est brisée !');
    document.getElementById('modal-sauvegarde').classList.add('hidden');
    await chargerJournalFiche();
  } catch (e) { console.error(e); }
}

function ouvrirChoixAction() {
  // Simple: ouvre le premier menu d'attaque si des attaques existent
  if ((perso.attaques || []).length) ouvrirAttaqueCombat(0);
  else alert('Aucune attaque définie. Utilisez "Ajouter une attaque".');
}

// ─── DÉMARRAGE ────────────────────────────────────────────────

function demarrerCombatPolling() {
  // Stocker sessionId si passé en URL
  const sid = new URLSearchParams(location.search).get('session');
  if (sid) localStorage.setItem('sessionId', sid);

  // PV de départ pour détection flash
  _pvPrecedent = perso.combat?.pv_actuels ?? null;

  // Lancer le polling
  refreshCombatFiche();
  verifierVoteRepos();
  _refreshCombatTimer = setInterval(() => { refreshCombatFiche(); verifierVoteRepos(); }, 5000);
  window.addEventListener('beforeunload', () => clearInterval(_refreshCombatTimer));
}

// Exposer les fonctions
window.jetMort              = jetMort;
window.ouvrirAttaqueCombat  = ouvrirAttaqueCombat;
window.selectionnerCible    = selectionnerCible;
window.calculerResultatAttaque = calculerResultatAttaque;
window.confirmerAttaqueCombat  = confirmerAttaqueCombat;
window.marquerAction        = marquerAction;
window.marquerBonus         = marquerBonus;
window.marquerReaction      = marquerReaction;
window.ouvrirChoixAction    = ouvrirChoixAction;
window.ouvrirModalSortCombat = ouvrirModalSortCombat;
window.lancerSortCombat     = lancerSortCombat;
window.selectionnerSortModal = selectionnerSortModal;
window.selectionnerCibleSort = selectionnerCibleSort;
window.confirmerSortCombat  = confirmerSortCombat;
window.ouvrirModalSauvegarde = ouvrirModalSauvegarde;
window.toggleSortsNiveau    = toggleSortsNiveau;
window.equiperArmure        = equiperArmure;
window.resetRessources      = resetRessources;
window.calculerJS           = calculerJS;
window.confirmerSauvegarde  = confirmerSauvegarde;

// ─── TOOLTIP SORTS ────────────────────────────────────────────

const _sortCache = {};

function _getSortTooltipEl() {
  let el = document.getElementById('sort-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sort-tooltip';
    el.className = 'sort-tooltip';
    document.body.appendChild(el);
  }
  return el;
}

function showSortTooltip(event, row) {
  const d = row.dataset;
  const nom    = d.sortNom   || '';
  const ecole  = d.sortEcole || '';
  const portee = d.sortPortee|| '';
  const duree  = d.sortDuree || '';
  const temps  = d.sortTemps || '';
  const desc   = d.sortDesc  || '';
  const niv    = d.sortNiveau;
  const id     = d.sortId    || '';

  const el = _getSortTooltipEl();

  const nivLabel = niv == 0 ? 'Sort mineur' : `Niveau ${niv}`;
  const infos = [ecole, portee, duree, temps].filter(Boolean).join(' · ');

  const renderTooltip = (description) => {
    el.innerHTML = `
      <div class="st-header">
        <span class="st-nom">${esc(nom)}</span>
        <span class="st-niv">${esc(nivLabel)}</span>
      </div>
      ${infos ? `<div class="st-infos">${esc(infos)}</div>` : ''}
      ${description ? `<div class="st-desc">${esc(description)}</div>` : '<div class="st-desc st-no-data">Description non disponible</div>'}`;
    el.classList.add('visible');
    _positionTooltip(event, el);
  };

  if (desc) {
    renderTooltip(desc);
  } else if (id && _sortCache[id]) {
    const s = _sortCache[id];
    row.dataset.sortDesc  = (s.description || '').slice(0, 300);
    row.dataset.sortEcole = s.ecole || '';
    row.dataset.sortPortee= s.portee || '';
    row.dataset.sortDuree = s.duree || '';
    row.dataset.sortTemps = s.temps_incantation || '';
    renderTooltip(s.description || '');
  } else if (id) {
    renderTooltip('');
    const niveau = parseInt(niv) || 0;
    fetch(`${API}/GetSorts2024?niveau=${niveau}`)
      .then(r => r.json())
      .then(list => {
        (list || []).forEach(s => { if (s.id) _sortCache[s.id] = s; });
        const found = _sortCache[id];
        if (found) {
          row.dataset.sortDesc  = (found.description || '').slice(0, 300);
          row.dataset.sortEcole = found.ecole || '';
          row.dataset.sortPortee= found.portee || '';
          row.dataset.sortDuree = found.duree || '';
          row.dataset.sortTemps = found.temps_incantation || '';
          if (el.classList.contains('visible')) renderTooltip(found.description || '');
        }
      }).catch(() => {});
  } else {
    renderTooltip('');
  }
}

function _positionTooltip(event, el) {
  const vw = window.innerWidth;
  const x = event.clientX + window.scrollX;
  const y = event.clientY + window.scrollY;
  el.style.top  = (y + 16) + 'px';
  el.style.left = Math.min(x + 12, vw + window.scrollX - 260) + 'px';
}

function hideSortTooltip() {
  const el = document.getElementById('sort-tooltip');
  if (el) el.classList.remove('visible');
}

function toggleSortsNiveau(niv) {
  const el = document.getElementById('sng-' + niv);
  if (!el) return;
  el.classList.toggle('collapsed');
  localStorage.setItem('sorts_niv_collapsed_' + niv, el.classList.contains('collapsed') ? '1' : '0');
}

// ─── SECTIONS RÉTRACTABLES ────────────────────────────────────

function initSectionsCollapsibles() {
  document.querySelectorAll('.fiche-section-title').forEach(title => {
    const section = title.closest('.fiche-section');
    if (!section) return;
    title.style.cursor = 'pointer';
    title.setAttribute('title', 'Cliquer pour réduire/agrandir');

    const key = 'section_collapsed_' + (title.textContent || '').trim().slice(0, 40);
    if (localStorage.getItem(key) === '1') section.classList.add('collapsed');

    title.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      localStorage.setItem(key, section.classList.contains('collapsed') ? '1' : '0');
    });
  });
}

waitForAuth(async () => {
  await init();
  demarrerCombatPolling();
});
