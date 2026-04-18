/* =============================================================
   ÉCRAN MJ — JS principal
   ============================================================= */

const API = 'https://myrpgtable.fr/api';

let combatId = null;
let sessionId = null;
let sessionNom = '';
let combatData = null;
let refreshInterval = null;
let notesTimer = null;
let histoDes = [];

const CONDITIONS = {
  a_terre:    { label: 'À terre',      info: 'Désavantage aux jets d\'attaque. Attaquants à distance : désavantage. Corps à corps : avantage.' },
  agrippe:    { label: 'Agrippé',      info: 'Vitesse = 0. Fin si l\'agresseur est neutralisé ou hors de portée.' },
  assourdi:   { label: 'Assourdi',     info: 'Incapable d\'entendre. Échec automatique aux jets basés sur l\'ouïe.' },
  aveugle:    { label: 'Aveuglé',      info: 'Incapable de voir. Désavantage aux jets d\'attaque. Les attaquants ont l\'avantage.' },
  charme:     { label: 'Charmé',       info: 'Ne peut pas attaquer le charmeur. Le charmeur a l\'avantage aux interactions sociales.' },
  effraye:    { label: 'Effrayé',      info: 'Désavantage aux jets et attaques si la source de peur est visible. Ne peut s\'en rapprocher.' },
  empoisonne: { label: 'Empoisonné',   info: 'Désavantage aux jets d\'attaque et de caractéristique.' },
  entrave:    { label: 'Entravé',      info: 'Vitesse = 0. Désavantage aux jets d\'attaque. Les attaquants ont l\'avantage.' },
  epuisement: { label: 'Épuisement',   info: 'Niveaux 1–6 : pénalités croissantes sur compétences, vitesse, attaques et PV max.' },
  etourdi:    { label: 'Étourdi',      info: 'Incapable d\'agir ou de parler clairement. Désavantage aux jets FOR et DEX. Attaquants : avantage.' },
  inconscient:{ label: 'Inconscient',  info: 'Neutralisé, ne peut se déplacer ni parler. Attaquants : avantage. Coups à portée critiques.' },
  invisible:  { label: 'Invisible',    info: 'Impossible à détecter sans magie. Avantage aux jets d\'attaque. Attaquants : désavantage.' },
  neutralise: { label: 'Neutralisé',   info: 'Ne peut entreprendre aucune action ni réaction.' },
  paralyse:   { label: 'Paralysé',     info: 'Neutralisé et incapable de bouger. Attaquants : avantage. Coups à portée = critiques.' },
  petrifie:   { label: 'Pétrifié',     info: 'Transformé en substance inerte. Neutralisé. Résistance à tous les dégâts.' }
};

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${window.SUPABASE_TOKEN || ''}`
  };
}

// ─── UTILITAIRES ──────────────────────────────────────────────

function showSynchro(visible) {
  document.getElementById('synchro-indicator').classList.toggle('visible', visible);
}

function pvPct(cur, max) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
}

function pvClass(pct) {
  if (pct <= 0) return 'zero';
  if (pct < 25) return 'bas';
  if (pct < 50) return 'moyen';
  return 'haut';
}

function typeIcon(type) {
  if (type === 'joueur') return '<i class="fa-solid fa-user" style="color:#865dff"></i>';
  if (type === 'pnj')    return '<i class="fa-solid fa-person" style="color:#c9a84c"></i>';
  return '<i class="fa-solid fa-dragon" style="color:#ff6666"></i>';
}

function formatHeure(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ─── TRACKER INITIATIVE ───────────────────────────────────────

function renderInitiativeList() {
  const list = document.getElementById('initiative-list');
  if (!combatData) return;

  const sorted = [...combatData.participants].sort((a, b) => b.initiative - a.initiative);
  // Garder l'ordre trié mais savoir qui est le participant actuel (par index dans sorted)
  // Le tour_actuel est basé sur l'ordre TRIÉ
  const tourActuel = combatData.tour_actuel;

  if (!sorted.length) {
    list.innerHTML = '<div style="text-align:center;padding:2rem;color:#555;font-size:0.82rem;">Aucun participant. Ajoutez-en avec le bouton ci-dessous.</div>';
    return;
  }

  list.innerHTML = sorted.map((p, i) => {
    const isActif = i === tourActuel;
    const pct = pvPct(p.pv_actuels, p.pv_max);
    const pvC = pvClass(pct);

    const condBadges = (p.conditions || []).map(c => {
      const cInfo = CONDITIONS[c];
      return cInfo
        ? `<span class="cond-badge ${c}" title="${cInfo.info}" onclick="retirerCondition('${p.id}','${c}')">${cInfo.label} ✕</span>`
        : `<span class="cond-badge" onclick="retirerCondition('${p.id}','${c}')">${c} ✕</span>`;
    }).join('');

    const condManquantes = Object.entries(CONDITIONS)
      .filter(([k]) => !(p.conditions || []).includes(k))
      .map(([k, v]) => `<span class="cond-picker-badge" title="${v.info}" onclick="ajouterCondition('${p.id}','${k}')">${v.label}</span>`)
      .join('');

    return `
      <div class="participant-card ${isActif ? 'actif' : ''} ${p.pv_actuels <= 0 ? 'mort' : ''}" data-pid="${p.id}">
        <div class="participant-header">
          <span class="participant-type-icon">${typeIcon(p.type)}</span>
          <span class="participant-nom" title="${p.nom}">${p.nom}</span>
          ${isActif ? '<span class="participant-actif-badge">▶ Joue</span>' : ''}
          <button class="btn-eye ${p.visible_joueurs ? 'visible' : ''}" title="${p.visible_joueurs ? 'Visible' : 'Caché'}"
            onclick="toggleVisible('${p.id}')">
            <i class="fa-solid fa-${p.visible_joueurs ? 'eye' : 'eye-slash'}"></i>
          </button>
          <button style="background:transparent;border:none;color:#666;cursor:pointer;font-size:0.75rem;" title="Supprimer"
            onclick="supprimerParticipant('${p.id}')">✕</button>
        </div>

        <div class="participant-row">
          <span class="init-label">Init</span>
          <input class="init-input" type="number" value="${p.initiative}" min="-10" max="30"
            onchange="majInitiative('${p.id}', this.value)" />
          <span class="ca-badge">CA ${p.ca}</span>
        </div>

        <div class="participant-row">
          <div class="pv-bar-wrap">
            <div class="pv-info">
              <span>PV</span>
              <span class="pv-nums">
                <input type="number" value="${p.pv_actuels}" min="0" max="${p.pv_max * 2}"
                  style="width:40px;background:transparent;border:none;color:#c9a84c;font-family:Georgia;font-size:0.82rem;text-align:center;outline:none;"
                  onchange="majPvDirect('${p.id}', this.value)" />
                / ${p.pv_max}
              </span>
            </div>
            <div class="pv-bar">
              <div class="pv-bar-fill ${pvC}" style="width:${pct}%"></div>
            </div>
          </div>
        </div>

        <div class="participant-row">
          <div class="pv-controls">
            <button class="pv-btn dmg" onclick="appliquerDelta('${p.id}', -getDelta('${p.id}'))">−</button>
            <input class="pv-delta-input" id="delta-${p.id}" type="number" value="1" min="1" />
            <button class="pv-btn soin" onclick="appliquerDelta('${p.id}', +getDelta('${p.id}'))">+</button>
          </div>
        </div>

        ${condBadges ? `<div class="conditions-row">${condBadges}</div>` : ''}

        <details style="margin-top:0.3rem;">
          <summary style="font-size:0.72rem;color:#555;cursor:pointer;">+ Ajouter condition</summary>
          <div class="cond-picker">${condManquantes}</div>
        </details>

        <div class="participant-row" style="gap:0.4rem;flex-wrap:wrap;position:relative;">
          <button class="btn-action-combat attaque" style="font-size:0.7rem;padding:0.2rem 0.6rem;" onclick="ouvrirModalDegats('${p.id}')">⚔️ Dégâts</button>
          <button class="btn-action-combat soin" style="font-size:0.7rem;padding:0.2rem 0.6rem;" onclick="ouvrirModalSoin('${p.id}')">💚 Soin</button>
          <button class="btn-menu-actions" onclick="toggleMenuP('${p.id}', event)" title="Actions avancées">···</button>
          <div class="participant-dropdown hidden" id="pmenu-${p.id}">
            ${p.type !== 'joueur' ? `
              <button class="pmenu-item danger" onclick="tuerMonstre('${p.id}')">☠️ Tuer</button>
              <button class="pmenu-item" onclick="fuirParticipant('${p.id}')">🏃 Fuite monstre</button>
              <button class="pmenu-item" onclick="neutraliserMonstre('${p.id}')">😴 Neutraliser</button>
            ` : `
              <button class="pmenu-item" onclick="fuirParticipant('${p.id}')">🏃 Fuite joueur</button>
            `}
            <button class="pmenu-item" onclick="ouvrirModifPvManuel('${p.id}')">✏️ Modifier PV</button>
          </div>
        </div>

        ${p.type !== 'joueur' ? renderActionsZone(p) : ''}

        <textarea class="notes-input" rows="1" placeholder="Notes…"
          onchange="majNotes('${p.id}', this.value)">${p.notes || ''}</textarea>
      </div>`;
  }).join('');

  // Mettre à jour le badge round
  document.getElementById('round-badge').textContent = `Round ${combatData.round}`;
  document.getElementById('topbar-round').textContent = `⚔️ Round ${combatData.round} — Tour ${combatData.tour_actuel + 1}/${sorted.length}`;
}

function getDelta(pid) {
  const el = document.getElementById(`delta-${pid}`);
  return parseInt(el?.value) || 1;
}

// ─── MISE À JOUR PARTICIPANTS ─────────────────────────────────

function trouverParticipant(pid) {
  return combatData.participants.find(p => p.id === pid);
}

async function sauvegarderParticipants() {
  if (!combatId) return;
  await fetch(`${API}/Combats/${combatId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ participants: combatData.participants })
  });
}

async function majInitiative(pid, val) {
  const p = trouverParticipant(pid);
  if (!p) return;
  p.initiative = +val || 0;
  renderInitiativeList();
  await sauvegarderParticipants();
}

async function majPvDirect(pid, val) {
  const p = trouverParticipant(pid);
  if (!p) return;
  p.pv_actuels = Math.max(0, Math.min(p.pv_max * 2, parseInt(val) || 0));
  renderInitiativeList();
  renderJoueursPv();
  await sauvegarderParticipants();
  if (p.pv_actuels === 0) {
    envoyerMsgSysteme(`${p.nom} tombe à 0 PV !`);
    if (p.type === 'joueur' && p.user_id && typeof createNotification === 'function') {
      createNotification({ user_id: p.user_id, session_id: sessionId, type: 'mort', titre: '💀 Vous êtes à 0 PV !', message: `${p.nom} est à 0 PV ! Jets de mort.`, lien: p.personnage_id ? `/fiche-personnage.html?id=${p.personnage_id}` : null });
    }
  }
}

async function appliquerDelta(pid, delta) {
  const p = trouverParticipant(pid);
  if (!p) return;
  const avant = p.pv_actuels;
  p.pv_actuels = Math.max(0, Math.min(p.pv_max * 2, p.pv_actuels + delta));
  renderInitiativeList();
  renderJoueursPv();
  await sauvegarderParticipants();
  const verbe = delta < 0 ? `subit ${Math.abs(delta)} dégâts` : `récupère ${delta} PV`;
  envoyerMsgSysteme(`${p.nom} ${verbe}. PV : ${p.pv_actuels}/${p.pv_max}`);
  if (avant > 0 && p.pv_actuels === 0) {
    envoyerMsgSysteme(`${p.nom} tombe à 0 PV !`);
    if (p.type === 'joueur' && p.user_id && typeof createNotification === 'function') {
      createNotification({ user_id: p.user_id, session_id: sessionId, type: 'mort', titre: '💀 Vous êtes à 0 PV !', message: `${p.nom} est à 0 PV ! Jets de mort.`, lien: p.personnage_id ? `/fiche-personnage.html?id=${p.personnage_id}` : null });
    }
  }
}

async function ajouterCondition(pid, condKey) {
  const p = trouverParticipant(pid);
  if (!p) return;
  if (!p.conditions) p.conditions = [];
  if (!p.conditions.includes(condKey)) {
    p.conditions.push(condKey);
    renderInitiativeList();
    await sauvegarderParticipants();
    envoyerMsgSysteme(`${p.nom} est maintenant ${CONDITIONS[condKey]?.label || condKey}.`);
  }
}

async function retirerCondition(pid, condKey) {
  const p = trouverParticipant(pid);
  if (!p) return;
  p.conditions = (p.conditions || []).filter(c => c !== condKey);
  renderInitiativeList();
  await sauvegarderParticipants();
  envoyerMsgSysteme(`${p.nom} n'est plus ${CONDITIONS[condKey]?.label || condKey}.`);
}

async function toggleVisible(pid) {
  const p = trouverParticipant(pid);
  if (!p) return;
  p.visible_joueurs = !p.visible_joueurs;
  renderInitiativeList();
  await sauvegarderParticipants();
}

async function majNotes(pid, val) {
  const p = trouverParticipant(pid);
  if (!p) return;
  p.notes = val;
  await sauvegarderParticipants();
}

async function supprimerParticipant(pid) {
  if (!combatId) return;
  combatData.participants = combatData.participants.filter(p => p.id !== pid);
  renderInitiativeList();
  await fetch(`${API}/Combats/${combatId}/participant/${pid}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
}

// ─── TOUR SUIVANT ─────────────────────────────────────────────

async function tourSuivant() {
  if (!combatId) return;
  try {
    const res = await fetch(`${API}/Combats/${combatId}/tour`, {
      method: 'PUT',
      headers: authHeaders()
    });
    if (!res.ok) return;
    const data = await res.json();
    combatData.round = data.round;
    combatData.tour_actuel = data.tour_actuel;
    // Reset réaction du participant qui vient de commencer son tour
    const sorted = [...combatData.participants].sort((a, b) => b.initiative - a.initiative);
    const actifNow = sorted[data.tour_actuel];
    if (actifNow) resetReactionsTour(actifNow.id);
    renderInitiativeList();
    await chargerMessages();

    // Notifier le joueur dont c'est le tour
    const actif = combatData.participants?.[data.tour_actuel];
    if (actif && actif.type === 'joueur' && actif.user_id && typeof createNotification === 'function') {
      createNotification({
        user_id: actif.user_id,
        session_id: sessionId,
        type: 'tour',
        titre: "C'est votre tour !",
        message: `${actif.nom}, c'est à vous d'agir !`,
        lien: actif.personnage_id ? `/fiche-personnage.html?id=${actif.personnage_id}` : null
      });
    }
  } catch (e) { console.error(e); }
}
window.tourSuivant = tourSuivant;

// ─── MODALE PARTICIPANT ───────────────────────────────────────

let _monstreSearchTimeout = null;

function ouvrirModalParticipant() {
  document.getElementById('p-nom').value = '';
  document.getElementById('p-type').value = 'monstre';
  document.getElementById('p-init').value = '10';
  document.getElementById('p-pv').value = '10';
  document.getElementById('p-ca').value = '10';
  document.getElementById('p-xp').value = '0';
  document.getElementById('monstre-search').value = '';
  document.getElementById('monstre-results').style.display = 'none';
  document.getElementById('modal-participant').classList.remove('hidden');
}
window.ouvrirModalParticipant = ouvrirModalParticipant;

function fermerModal() {
  document.getElementById('modal-participant').classList.add('hidden');
}
window.fermerModal = fermerModal;

// Recherche de monstres dans MonstresCustom
async function rechercherMonstres() {
  clearTimeout(_monstreSearchTimeout);
  _monstreSearchTimeout = setTimeout(async () => {
    const q = document.getElementById('monstre-search').value.trim();
    const resultsEl = document.getElementById('monstre-results');
    if (!q) { resultsEl.style.display = 'none'; return; }
    try {
      const res = await fetch(`${API}/MonstresCustom?recherche=${encodeURIComponent(q)}`, { headers: authHeaders() });
      if (!res.ok) return;
      const docs = await res.json();
      if (!docs.length) {
        resultsEl.innerHTML = '<div style="padding:0.5rem 0.75rem;color:#444;font-size:0.78rem;">Aucun résultat</div>';
        resultsEl.style.display = 'block';
        return;
      }
      resultsEl.innerHTML = docs.map(m => `
        <div class="monstre-result-item" data-id="${m._id}"
             style="padding:0.4rem 0.75rem;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.8rem;display:flex;gap:0.5rem;align-items:center;color:#ccc;transition:background 0.1s;"
             onmouseover="this.style.background='rgba(134,93,255,0.12)'"
             onmouseout="this.style.background=''"
             onclick="selectionnerMonstre(${JSON.stringify(m).replace(/"/g,'&quot;')})">
          <span style="flex:1">${m.nom}</span>
          <span style="font-size:0.7rem;color:#555;">FP ${m.fp}</span>
          <span style="font-size:0.7rem;color:#555;">PV ${m.pv}</span>
          <span style="font-size:0.7rem;color:#555;">CA ${m.ca}</span>
          <span style="font-size:0.7rem;color:#c9a84c;">${m.xp} XP</span>
        </div>
      `).join('');
      resultsEl.style.display = 'block';
    } catch { /* silencieux */ }
  }, 250);
}
window.rechercherMonstres = rechercherMonstres;

function selectionnerMonstre(m) {
  document.getElementById('p-nom').value  = m.nom;
  document.getElementById('p-type').value = 'monstre';
  document.getElementById('p-pv').value   = m.pv  || 10;
  document.getElementById('p-ca').value   = m.ca  || 10;
  document.getElementById('p-xp').value   = m.xp  || 0;
  document.getElementById('monstre-search').value = '';
  document.getElementById('monstre-results').style.display = 'none';
  const nomEl = document.getElementById('p-nom');
  nomEl._attaques            = m.attaques            || [];
  nomEl._monstreId           = m._id;
  nomEl._actions_bonus       = m.actions_bonus        || [];
  nomEl._reactions           = m.reactions            || [];
  nomEl._actions_legendaires = m.actions_legendaires  || [];
  nomEl._actions_leg_nb      = m.actions_leg_nb       || 0;
  nomEl._resistances_leg_nb  = m.resistances_leg_nb   || 0;
}
window.selectionnerMonstre = selectionnerMonstre;

async function ajouterParticipant() {
  if (!combatId) return;
  const nomEl = document.getElementById('p-nom');
  const body = {
    nom:             nomEl.value || 'Inconnu',
    type:            document.getElementById('p-type').value,
    initiative:      +document.getElementById('p-init').value || 0,
    pv_max:          +document.getElementById('p-pv').value  || 10,
    ca:              +document.getElementById('p-ca').value  || 10,
    xp:              +document.getElementById('p-xp').value  || 0,
    attaques:            nomEl._attaques            || [],
    actions_bonus:       nomEl._actions_bonus       || [],
    reactions:           nomEl._reactions           || [],
    actions_legendaires: nomEl._actions_legendaires || [],
    actions_leg_nb:      nomEl._actions_leg_nb      || 0,
    resistances_leg_nb:  nomEl._resistances_leg_nb  || 0,
    monstre_id:          nomEl._monstreId           || null,
    visible_joueurs: document.getElementById('p-visible').value !== 'false'
  };
  // Réinitialiser les données cachées
  nomEl._attaques            = [];
  nomEl._monstreId           = null;
  nomEl._actions_bonus       = [];
  nomEl._reactions           = [];
  nomEl._actions_legendaires = [];
  nomEl._actions_leg_nb      = 0;
  nomEl._resistances_leg_nb  = 0;
  try {
    const res = await fetch(`${API}/Combats/${combatId}/participant`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.participant) {
      combatData.participants.push(data.participant);
      renderInitiativeList();
      fermerModal();
      envoyerMsgSysteme(`${data.participant.nom} rejoint le combat !`);
    }
  } catch (e) { console.error(e); }
}
window.ajouterParticipant = ajouterParticipant;

// ─── PV JOUEURS (col centrale) ────────────────────────────────

function renderJoueursPv() {
  const list = document.getElementById('joueurs-pv-list');
  const joueurs = combatData.participants.filter(p => p.type === 'joueur');
  if (!joueurs.length) {
    list.innerHTML = '<p style="font-size:0.8rem;color:#555;">Aucun joueur dans le combat.</p>';
    return;
  }
  list.innerHTML = joueurs.map(j => {
    const pct = pvPct(j.pv_actuels, j.pv_max);
    const pvC = pvClass(pct);
    return `
      <div class="joueur-pv-row">
        <span class="joueur-pv-nom">${j.nom}</span>
        <div class="joueur-pv-bar-wrap">
          <div class="pv-info">
            <span></span>
            <span class="pv-nums" style="font-size:0.78rem">${j.pv_actuels} / ${j.pv_max}</span>
          </div>
          <div class="pv-bar">
            <div class="pv-bar-fill ${pvC}" style="width:${pct}%"></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── LANCEUR DE DÉS ──────────────────────────────────────────

function lancerRapide(faces) {
  const resultat = Math.floor(Math.random() * faces) + 1;
  afficherResultat(resultat, `1d${faces}`, [resultat]);
}
window.lancerRapide = lancerRapide;

function lancerFormule() {
  const formule = document.getElementById('des-formule').value.trim() || '1d20';
  const match = formule.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!match) {
    document.getElementById('resultat-total').textContent = '?';
    document.getElementById('resultat-detail').textContent = 'Formule invalide (ex: 2d6+3)';
    document.getElementById('resultat-de').style.display = 'block';
    return;
  }
  const nb = parseInt(match[1]) || 1;
  const faces = parseInt(match[2]);
  const modif = parseInt(match[3]) || 0;
  const jets = Array.from({ length: nb }, () => Math.floor(Math.random() * faces) + 1);
  const total = jets.reduce((a, b) => a + b, 0) + modif;
  afficherResultat(total, formule, jets, modif);
}
window.lancerFormule = lancerFormule;

function afficherResultat(total, formule, jets, modif = 0) {
  const el = document.getElementById('resultat-de');
  el.style.display = 'block';
  document.getElementById('resultat-total').textContent = total;
  const detail = jets.length > 1
    ? `[${jets.join(', ')}]${modif !== 0 ? (modif > 0 ? ` + ${modif}` : ` ${modif}`) : ''}`
    : (modif !== 0 ? `${jets[0]}${modif > 0 ? ` + ${modif}` : ` ${modif}`}` : '');
  document.getElementById('resultat-detail').textContent = detail;

  // Animation flash
  el.style.borderColor = '#c9a84c';
  setTimeout(() => { el.style.borderColor = 'rgba(201,168,76,0.25)'; }, 400);

  // Historique
  histoDes.unshift({ formule, total });
  if (histoDes.length > 5) histoDes.pop();
  renderHistoDes();
}

function renderHistoDes() {
  const el = document.getElementById('historique-des');
  el.innerHTML = histoDes.map(h => `
    <div class="histo-item">
      <span>${h.formule}</span>
      <span class="histo-result">${h.total}</span>
    </div>`).join('');
}

// ─── NOTES MJ (auto-save 30s) ────────────────────────────────

async function sauvegarderNotes() {
  if (!combatId) return;
  const notes = document.getElementById('notes-mj').value;
  const el = document.getElementById('notes-status');
  el.textContent = 'Sauvegarde…';
  try {
    await fetch(`${API}/Combats/${combatId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ notes_mj: notes })
    });
    el.textContent = '✓ Sauvegardé';
    setTimeout(() => { el.textContent = ''; }, 2000);
  } catch (e) {
    el.textContent = '⚠ Erreur de sauvegarde';
  }
}

// ─── MESSAGERIE ───────────────────────────────────────────────

async function envoyerMsgSysteme(contenu) {
  if (!combatId) return;
  await fetch(`${API}/Combats/${combatId}/message`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ contenu, destinataire: 'tous', type: 'systeme', expediteur_nom: 'Système' })
  });
  await chargerMessages();
}

async function envoyerMessage() {
  const contenu = document.getElementById('msg-contenu').value.trim();
  if (!contenu || !combatId) return;

  const dest = document.getElementById('msg-dest').value;
  const isSecret = document.getElementById('msg-secret').checked || (dest !== 'tous');
  const type = isSecret ? 'secret' : 'normal';

  try {
    await fetch(`${API}/Combats/${combatId}/message`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        contenu,
        destinataire: dest,
        type,
        expediteur_nom: `${window.USER_PSEUDO || 'MJ'} (MJ)`
      })
    });
    document.getElementById('msg-contenu').value = '';
    await chargerMessages();
  } catch (e) { console.error(e); }
}
window.envoyerMessage = envoyerMessage;

async function chargerMessages() {
  if (!combatId) return;
  try {
    const res = await fetch(`${API}/Combats/${combatId}/messages`, { headers: authHeaders() });
    if (!res.ok) return;
    const messages = await res.json();
    renderMessages(messages);
  } catch (e) { console.error(e); }
}

function renderMessages(messages) {
  const el = document.getElementById('messages-list');
  if (!messages.length) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;color:#555;font-size:0.82rem;">Aucun message</div>';
    return;
  }
  el.innerHTML = messages.map(m => `
    <div class="message-item ${m.type}">
      <div class="message-header">
        <span class="message-auteur">${m.expediteur_nom}</span>
        <span class="message-heure">${formatHeure(m.timestamp)}</span>
      </div>
      <div class="message-contenu">${escapeHtml(m.contenu)}</div>
      ${m.type === 'secret' && m.destinataire !== 'tous'
        ? `<div class="message-dest">🔒 Privé → ${m.destinataire === window.USER_ID ? 'vous' : m.destinataire}</div>`
        : ''}
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function escapeHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── MENU "..." PAR PARTICIPANT ───────────────────────────────

function toggleMenuP(pid, event) {
  event?.stopPropagation();
  // Fermer tous les autres menus ouverts
  document.querySelectorAll('.participant-dropdown').forEach(m => {
    if (m.id !== `pmenu-${pid}`) m.classList.add('hidden');
  });
  const menu = document.getElementById(`pmenu-${pid}`);
  if (menu) menu.classList.toggle('hidden');
}
window.toggleMenuP = toggleMenuP;

// Fermer les menus en cliquant ailleurs
document.addEventListener('click', () => {
  document.querySelectorAll('.participant-dropdown').forEach(m => m.classList.add('hidden'));
});

// ─── ACTIONS RAPIDES SUR PARTICIPANT ─────────────────────────

async function tuerMonstre(pid) {
  document.getElementById(`pmenu-${pid}`)?.classList.add('hidden');
  const p = trouverParticipant(pid);
  if (!p) return;
  p.pv_actuels = 0;
  renderInitiativeList();
  renderJoueursPv();
  await sauvegarderParticipants();
  envoyerMsgSysteme(`☠️ ${p.nom} tué par le MJ.`);
  await ajouterCondition(pid, 'inconscient');
}
window.tuerMonstre = tuerMonstre;

async function fuirParticipant(pid) {
  document.getElementById(`pmenu-${pid}`)?.classList.add('hidden');
  const p = trouverParticipant(pid);
  if (!p) return;
  const nom = p.nom;
  const verbe = p.type === 'joueur' ? 'quitte le combat' : 'prend la fuite !';
  combatData.participants = combatData.participants.filter(x => x.id !== pid);
  // Ajuster tour_actuel si nécessaire
  const sorted = [...combatData.participants].sort((a, b) => b.initiative - a.initiative);
  if (combatData.tour_actuel >= sorted.length && sorted.length > 0) {
    combatData.tour_actuel = 0;
  }
  renderInitiativeList();
  renderJoueursPv();
  peuplerDestinataireSelect();
  await fetch(`${API}/Combats/${combatId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ participants: combatData.participants, tour_actuel: combatData.tour_actuel })
  });
  envoyerMsgSysteme(`🏃 ${nom} ${verbe}`);
}
window.fuirParticipant = fuirParticipant;

async function neutraliserMonstre(pid) {
  document.getElementById(`pmenu-${pid}`)?.classList.add('hidden');
  const p = trouverParticipant(pid);
  if (!p) return;
  await ajouterCondition(pid, 'inconscient');
  envoyerMsgSysteme(`😴 ${p.nom} est neutralisé (Inconscient).`);
}
window.neutraliserMonstre = neutraliserMonstre;

let _pvManuelPid = null;

function ouvrirModifPvManuel(pid) {
  document.getElementById(`pmenu-${pid}`)?.classList.add('hidden');
  const p = trouverParticipant(pid);
  if (!p) return;
  _pvManuelPid = pid;
  document.getElementById('modal-pv-manuel-nom').textContent    = p.nom;
  document.getElementById('modal-pv-manuel-actuel').textContent = `PV actuels : ${p.pv_actuels} / ${p.pv_max}`;
  document.getElementById('modal-pv-manuel-val').value          = p.pv_actuels;
  document.getElementById('modal-pv-manuel').classList.remove('hidden');
  setTimeout(() => document.getElementById('modal-pv-manuel-val').focus(), 50);
}
window.ouvrirModifPvManuel = ouvrirModifPvManuel;

async function confirmerModifPvManuel() {
  if (!_pvManuelPid) return;
  const val = parseInt(document.getElementById('modal-pv-manuel-val').value);
  if (isNaN(val) || val < 0) return;
  const p = trouverParticipant(_pvManuelPid);
  if (!p) return;
  const ancienPv = p.pv_actuels;
  p.pv_actuels = Math.min(p.pv_max * 2, val);
  renderInitiativeList();
  renderJoueursPv();
  await sauvegarderParticipants();
  envoyerMsgSysteme(`✏️ PV de ${p.nom} modifiés manuellement : ${ancienPv} → ${p.pv_actuels}`);
  if (ancienPv > 0 && p.pv_actuels === 0 && p.type === 'joueur' && p.user_id && typeof createNotification === 'function') {
    createNotification({ user_id: p.user_id, session_id: sessionId, type: 'mort', titre: '💀 Vous êtes à 0 PV !', message: `${p.nom} est à 0 PV.`, lien: p.personnage_id ? `/fiche-personnage.html?id=${p.personnage_id}` : null });
  }
  document.getElementById('modal-pv-manuel').classList.add('hidden');
  _pvManuelPid = null;
}
window.confirmerModifPvManuel = confirmerModifPvManuel;

// ─── RÉINITIALISER INITIATIVE ─────────────────────────────────

async function reinitialiserInitiative() {
  if (!combatId) return;
  if (!confirm('Réinitialiser l\'initiative ? Le round repasse à 1 et le tour au premier participant.')) return;
  combatData.round       = 1;
  combatData.tour_actuel = 0;
  renderInitiativeList();
  try {
    await fetch(`${API}/Combats/${combatId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ round: 1, tour_actuel: 0 })
    });
    envoyerMsgSysteme('🔄 Initiative réinitialisée — Round 1.');
  } catch (e) { console.error(e); }
}
window.reinitialiserInitiative = reinitialiserInitiative;

// ─── TERMINER COMBAT ─────────────────────────────────────────

const LABELS_FIN = {
  victoire: '✅ Victoire des joueurs',
  fuite:    '🏃 Les monstres fuient',
  defaite:  '💀 Défaite des joueurs',
  autre:    '🤝 Autre'
};

function ouvrirModalFinCombat() {
  const radios = document.querySelectorAll('input[name="fin-raison"]');
  radios.forEach(r => { r.checked = r.value === 'victoire'; });
  document.getElementById('fin-combat-autre-wrap').style.display = 'none';
  document.getElementById('fin-combat-xp-wrap').style.display = 'block';

  // Calculer XP automatique depuis les monstres du combat
  const monstres = (combatData?.participants || []).filter(p => p.type === 'monstre' && p.xp > 0);
  const xpAuto   = monstres.reduce((sum, m) => sum + (m.xp || 0), 0);
  const nbJoueurs = (combatData?.participants || []).filter(p => p.type === 'joueur').length;

  document.getElementById('fin-combat-xp').value = xpAuto || '';
  if (xpAuto > 0) {
    document.getElementById('fin-combat-xp-auto').textContent = `(calculé depuis les monstres)`;
    if (nbJoueurs > 0) {
      const parJoueur = Math.floor(xpAuto / nbJoueurs);
      document.getElementById('fin-combat-xp-repartition').textContent =
        `→ ${parJoueur} XP / joueur (${nbJoueurs} joueur${nbJoueurs > 1 ? 's' : ''})`;
    }
  } else {
    document.getElementById('fin-combat-xp-auto').textContent = '';
    document.getElementById('fin-combat-xp-repartition').textContent = '';
  }

  document.getElementById('modal-fin-combat').classList.remove('hidden');
}
window.ouvrirModalFinCombat = ouvrirModalFinCombat;

function majFinCombatUI(val) {
  document.getElementById('fin-combat-autre-wrap').style.display = val === 'autre' ? 'block' : 'none';
  document.getElementById('fin-combat-xp-wrap').style.display   = val === 'victoire' ? 'block' : 'none';
}
window.majFinCombatUI = majFinCombatUI;

async function confirmerFinCombat() {
  if (!combatId) return;
  const raison = document.querySelector('input[name="fin-raison"]:checked')?.value || 'victoire';
  const autreTexte = document.getElementById('fin-combat-autre-texte').value.trim();
  const xpADistribuer = parseInt(document.getElementById('fin-combat-xp').value) || 0;

  const label = raison === 'autre' && autreTexte
    ? `🤝 ${autreTexte}`
    : LABELS_FIN[raison] || raison;

  document.getElementById('modal-fin-combat').classList.add('hidden');

  try {
    // Marquer le combat comme terminé
    await fetch(`${API}/Combats/${combatId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ statut: 'termine', raison_fin: raison, raison_texte: label })
    });

    // Log journal
    envoyerMsgSysteme(`⚔️ Combat terminé — ${label}`);

    // Notifier tous les joueurs
    const joueurs = (combatData.participants || []).filter(p => p.type === 'joueur' && p.user_id);
    for (const j of joueurs) {
      if (typeof createNotification === 'function') {
        createNotification({
          user_id: j.user_id,
          session_id: sessionId,
          type: raison === 'defaite' ? 'mort' : 'combat',
          titre: `⚔️ Combat terminé`,
          message: label,
          lien: j.personnage_id ? `/fiche-personnage.html?id=${j.personnage_id}` : null
        });
      }
    }

    // Distribuer XP via la route /fin (calcule aussi XP auto depuis monstres)
    if (raison === 'victoire') {
      try {
        const finRes = await fetch(`${API}/Combats/${combatId}/fin`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ raison, xp_total: xpADistribuer || 0 })
        });
        if (finRes.ok) {
          const finData = await finRes.json();
          const xpEffectif = finData.xp_total || xpADistribuer;
          if (xpEffectif > 0) {
            const msg = finData.xp_par_joueur > 0
              ? `🌟 ${xpEffectif} XP distribués — ${finData.xp_par_joueur} XP/joueur !`
              : `🌟 ${xpEffectif} XP distribués !`;
            envoyerMsgSysteme(msg);
          }
        }
      } catch (e) { console.warn('Distribution XP échouée', e); }
    }

    clearInterval(refreshInterval);
    clearInterval(notesTimer);
    setTimeout(() => { window.location.href = `session-detail.html?id=${sessionId}`; }, 1500);

  } catch (e) { console.error(e); }
}
window.confirmerFinCombat = confirmerFinCombat;

// ─── SÉLECTEUR DESTINATAIRE ───────────────────────────────────

function peuplerDestinataireSelect() {
  const sel = document.getElementById('msg-dest');
  sel.innerHTML = '<option value="tous">→ Tous</option>';
  (combatData.participants || [])
    .filter(p => p.type === 'joueur' && p.user_id)
    .forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.user_id;
      opt.textContent = `→ ${p.nom} (secret)`;
      sel.appendChild(opt);
    });
}

// ─── AUTO-REFRESH ─────────────────────────────────────────────

async function refresh() {
  if (document.hidden || !combatId) return;
  showSynchro(true);
  try {
    const res = await fetch(`${API}/Combats/${sessionId}`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      // Mettre à jour seulement les données dynamiques pour ne pas écraser les inputs
      combatData.round = data.round;
      combatData.tour_actuel = data.tour_actuel;
      combatData.participants = data.participants;
      combatData.statut = data.statut;
      renderInitiativeList();
      renderJoueursPv();
    }
    await chargerMessages();
  } catch (e) { /* silencieux */ }
  showSynchro(false);
}

// ─── CHARGEMENT INITIAL ───────────────────────────────────────

async function chargerCombat() {
  const params = new URLSearchParams(window.location.search);
  sessionId = params.get('session');
  const combatParam = params.get('combat');

  if (!sessionId) { window.location.href = 'sessions.html'; return; }

  // Mettre à jour le bouton retour
  document.getElementById('btn-retour').href = `session-detail.html?id=${sessionId}`;

  try {
    // Récupérer le nom de la session
    const sRes = await fetch(`${API}/Sessions/${sessionId}`, { headers: authHeaders() });
    if (sRes.ok) {
      const s = await sRes.json();
      sessionNom = s.nom || 'Session';
      document.getElementById('topbar-session-nom').textContent = sessionNom;
      if (!s.est_mj) { window.location.href = `session-detail.html?id=${sessionId}`; return; }
    }

    // Récupérer ou créer le combat
    if (combatParam) {
      // Combat spécifique par ID
      const cRes = await fetch(`${API}/Combats/${sessionId}`, { headers: authHeaders() });
      if (cRes.ok) {
        combatData = await cRes.json();
        combatId = combatData._id;
      }
    } else {
      // Chercher combat actif ou en créer un
      const cRes = await fetch(`${API}/Combats/${sessionId}`, { headers: authHeaders() });
      if (cRes.ok) {
        combatData = await cRes.json();
        combatId = combatData._id;
      } else if (cRes.status === 404) {
        // Créer un nouveau combat
        const createRes = await fetch(`${API}/Combats`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ session_id: sessionId })
        });
        if (createRes.ok) {
          combatData = await createRes.json();
          combatId = combatData._id;
        }
      }
    }

    if (!combatData || !combatId) {
      document.getElementById('initiative-list').innerHTML = '<p style="color:#ff8888;padding:1rem;">Erreur chargement combat.</p>';
      return;
    }

    // Afficher les notes MJ
    document.getElementById('notes-mj').value = combatData.notes_mj || '';

    renderInitiativeList();
    renderJoueursPv();
    peuplerDestinataireSelect();
    await chargerMessages();
    await chargerJournal();
    await chargerVoteReposMJ();
    await chargerJoueursXP();

    // Auto-save notes 30s
    notesTimer = setInterval(sauvegarderNotes, 30000);

    // Auto-refresh 5s
    refreshInterval = setInterval(refresh, 5000);

    // Entrée pour lancer les dés
    document.getElementById('des-formule').addEventListener('keydown', e => {
      if (e.key === 'Enter') lancerFormule();
    });

    // Pré-cocher secret auto si destinataire spécifique
    document.getElementById('msg-dest').addEventListener('change', e => {
      document.getElementById('msg-secret').checked = e.target.value !== 'tous';
    });

  } catch (e) {
    console.error('Erreur chargement:', e);
  }
}

// ─── INIT ─────────────────────────────────────────────────────

let _authDone = false;
function waitForAuth(fn) {
  function fire() { if (_authDone) return; _authDone = true; fn(); }
  if (window.SUPABASE_TOKEN) { fire(); return; }
  window.addEventListener('supabase-ready', fire, { once: true });
  let n = 0;
  const t = setInterval(() => {
    if (window.SUPABASE_TOKEN) { clearInterval(t); fire(); }
    if (++n > 150) clearInterval(t);
  }, 100);
}

document.addEventListener('DOMContentLoaded', () => {
  waitForAuth(chargerCombat);

  // Fermer modale
  document.getElementById('modal-participant').addEventListener('click', e => {
    if (e.target === e.currentTarget) fermerModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fermerModal(); });

  // Nettoyage au quitter
  window.addEventListener('beforeunload', () => {
    clearInterval(refreshInterval);
    clearInterval(notesTimer);
    sauvegarderNotes();
  });
});

// ─── JOURNAL DE COMBAT ─────────────────────────────────────────

async function chargerJournal() {
  if (!combatId) return;
  try {
    const r = await fetch(`${API}/Combats/${combatId}/journal`, { headers: authHeaders() });
    if (!r.ok) return;
    const entries = await r.json();
    renderJournal(entries);
  } catch (e) { /* silencieux */ }
}

function renderJournal(entries) {
  const el = document.getElementById('journal-mj');
  if (!el) return;
  if (!entries.length) { el.innerHTML = '<span style="color:#555;font-size:0.72rem;">Journal vide…</span>'; return; }
  el.innerHTML = entries.slice(-60).map(e => {
    const heure = new Date(e.timestamp).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    const texte = escapeHtml(e.contenu);
    const cls = e.type === 'combat'
      ? (e.contenu.includes('💚') ? 'soin' : e.contenu.includes('💀') ? 'mort' : 'combat')
      : e.type || '';
    return `<div class="journal-entry ${cls}"><span class="j-heure">${heure}</span>${texte}</div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

// ─── MODAL DÉGÂTS MJ AMÉLIORÉ ─────────────────────────────────

const TYPES_DEGATS = ['contondants','perçants','tranchants','feu','froid','foudre','acide','poison','nécrotique','radiant','psychique','force','tonnerre'];

let _mjDmgTarget = null;
let _mjHealTarget = null;
let _mjTypeDmg = 'physiques';

function ouvrirModalDegats(pid) {
  _mjDmgTarget = pid;
  _mjTypeDmg = '';
  const p = trouverParticipant(pid);
  if (!p) return;

  document.getElementById('modal-degats-nom').textContent  = p.nom;
  document.getElementById('modal-degats-pv').textContent   = `PV : ${p.pv_actuels}/${p.pv_max}`;
  document.getElementById('modal-degats-val').value        = '';
  document.getElementById('modal-degats-resist').textContent  = '';
  document.getElementById('modal-degats-immun').textContent   = '';

  // Afficher résistances/immunités si connues
  if ((p.resistances || []).length) {
    document.getElementById('modal-degats-resist').textContent = `Résistances : ${p.resistances.join(', ')}`;
  }
  if ((p.immunites || []).length) {
    document.getElementById('modal-degats-immun').textContent = `Immunités : ${p.immunites.join(', ')}`;
  }

  // Grille types
  const grid = document.getElementById('modal-degats-types');
  grid.innerHTML = TYPES_DEGATS.map(t => `
    <span class="type-degats-badge" data-type="${t}" onclick="selectionnerTypeDmg('${t}')">${t}</span>`).join('');

  document.getElementById('modal-degats-mj').classList.remove('hidden');
}
window.ouvrirModalDegats = ouvrirModalDegats;

function selectionnerTypeDmg(type) {
  _mjTypeDmg = type;
  document.querySelectorAll('.type-degats-badge').forEach(b => b.classList.toggle('selected', b.dataset.type === type));
}
window.selectionnerTypeDmg = selectionnerTypeDmg;

async function confirmerDegats() {
  if (!_mjDmgTarget || !combatId) return;
  const val = parseInt(document.getElementById('modal-degats-val').value) || 0;
  const type = _mjTypeDmg;
  const soignant = window.USER_PSEUDO || 'MJ';

  try {
    const r = await fetch(`${API}/Combats/${combatId}/attaque`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        attaquant_id: 'mj',
        cible_id: _mjDmgTarget,
        d20: 15, // touche automatique depuis le MJ
        degats: val,
        type_degats: type
      })
    });
    const data = await r.json();

    // Mettre à jour localement
    const p = trouverParticipant(_mjDmgTarget);
    if (p && data.pv_restants !== undefined) p.pv_actuels = data.pv_restants;
    renderInitiativeList();
    renderJoueursPv();

    document.getElementById('modal-degats-mj').classList.add('hidden');
    await chargerJournal();
    await chargerMessages();
  } catch (e) { console.error(e); }
}
window.confirmerDegats = confirmerDegats;

function ouvrirModalSoin(pid) {
  _mjHealTarget = pid;
  const p = trouverParticipant(pid);
  if (!p) return;
  document.getElementById('modal-soin-nom').textContent = p.nom;
  document.getElementById('modal-soin-pv-act').textContent = `PV : ${p.pv_actuels}/${p.pv_max}`;
  document.getElementById('modal-soin-val').value = '';
  document.getElementById('modal-soin-mj').classList.remove('hidden');
}
window.ouvrirModalSoin = ouvrirModalSoin;

async function confirmerSoin() {
  if (!_mjHealTarget || !combatId) return;
  const val = parseInt(document.getElementById('modal-soin-val').value) || 0;
  const soignant = window.USER_PSEUDO || 'MJ';

  try {
    const r = await fetch(`${API}/Combats/${combatId}/soin`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ cible_id: _mjHealTarget, pv: val, soignant_nom: soignant })
    });
    const data = await r.json();

    const p = trouverParticipant(_mjHealTarget);
    if (p && data.pv_restants !== undefined) p.pv_actuels = data.pv_restants;
    renderInitiativeList();
    renderJoueursPv();

    document.getElementById('modal-soin-mj').classList.add('hidden');
    await chargerJournal();
    await chargerMessages();
  } catch (e) { console.error(e); }
}
window.confirmerSoin = confirmerSoin;

// ─── ZONE ACTIONS MONSTRE (carte initiative) ──────────────────

function renderActionsZone(p) {
  const ab  = p.actions_bonus || [];
  const rct = p.reactions      || [];
  const leg = p.actions_legendaires || [];
  const legNb = p.actions_leg_nb || 0;
  const resLeg = p.resistances_leg_nb || 0;

  if (!ab.length && !rct.length && !leg.length && !resLeg) return '';

  const usedRct = p._react_used || false;
  const legPool = p._leg_pool != null ? p._leg_pool : legNb;
  const resPool = p._res_pool != null ? p._res_pool : resLeg;

  let html = '<div class="monstre-actions-zone">';

  // Actions bonus
  if (ab.length) {
    html += '<div class="monstre-actions-row"><span class="action-label">🌟 Actions bonus</span>';
    ab.forEach((a, i) => {
      const isAtk = a.type_action === 'attaque';
      html += `<button class="btn-action-type ${isAtk ? 'atk' : 'texte'}"
        onclick="afficherActionInfo('${p.id}','ab',${i})"
        title="${isAtk ? `+${a.bonus_atk||0} · ${escapeHtml(a.degats||'')} ${escapeHtml(a.type_degats||'')}` : escapeHtml(a.desc||'')}"
      >${escapeHtml(a.nom)}</button>`;
    });
    html += '</div>';
  }

  // Réactions
  if (rct.length) {
    html += '<div class="monstre-actions-row"><span class="action-label">⚡ Réactions</span>';
    rct.forEach((a, i) => {
      const isAtk = a.type_action === 'attaque';
      html += `<button class="btn-action-type ${isAtk ? 'atk' : 'texte'} ${usedRct ? 'reaction-used' : ''}"
        onclick="utiliserReaction('${p.id}',${i})"
        title="${escapeHtml(a.desc||'')}"
      >${escapeHtml(a.nom)}</button>`;
    });
    html += '</div>';
  }

  // Légendaires
  if (leg.length || legNb) {
    html += `<div class="monstre-actions-row"><span class="action-label">👑 Légendaires <span class="leg-pool" id="leg-pool-${p.id}">${legPool}/${legNb}</span></span>`;
    leg.forEach((a, i) => {
      const cout = a.cout || 1;
      const disabled = legPool < cout;
      const isAtk = a.type_action === 'attaque';
      html += `<button class="btn-action-type ${isAtk ? 'atk' : 'texte'}" ${disabled ? 'disabled style="opacity:0.3;"' : ''}
        onclick="utiliserLegendaire('${p.id}',${i},${cout})"
        title="${cout > 1 ? `Coût : ${cout} actions. ` : ''}${escapeHtml(a.desc||'')}"
      >${escapeHtml(a.nom)} ${cout > 1 ? `<small>(×${cout})</small>` : ''}</button>`;
    });
    html += `<button class="btn-action-type texte" style="margin-left:auto;" onclick="resetLegendaires('${p.id}')">↺</button>`;
    html += '</div>';
  }

  // Résistances légendaires
  if (resLeg) {
    html += `<div class="monstre-actions-row"><span class="action-label">🛡️ Rés. légendaires <span class="leg-pool" id="res-pool-${p.id}">${resPool}/${resLeg}</span></span>
      <button class="btn-action-type texte" ${resPool <= 0 ? 'disabled style="opacity:0.3;"' : ''} onclick="utiliserResLeg('${p.id}')">Utiliser</button>
      <button class="btn-action-type texte" style="margin-left:auto;" onclick="resetResLeg('${p.id}')">↺</button>
    </div>`;
  }

  html += '</div>';
  return html;
}

function afficherActionInfo(pid, type, idx) {
  const p = trouverParticipant(pid);
  if (!p) return;
  const arr = type === 'ab' ? (p.actions_bonus||[]) : [];
  const a = arr[idx];
  if (!a) return;
  const msg = a.type_action === 'attaque'
    ? `${a.nom} : +${a.bonus_atk||0} · ${a.degats||'—'} ${a.type_degats||''} · ${a.portee||''}\n${a.desc||''}`
    : `${a.nom}\n${a.desc||''}`;
  envoyerMsgSysteme(`📣 ${escapeHtml(p.nom)} — ${msg}`);
}
window.afficherActionInfo = afficherActionInfo;

function utiliserReaction(pid, idx) {
  const p = trouverParticipant(pid);
  if (!p) return;
  const a = (p.reactions||[])[idx];
  if (!a) return;
  p._react_used = true;
  const msg = a.type_action === 'attaque'
    ? `⚡ ${p.nom} utilise sa réaction : ${a.nom} (+${a.bonus_atk||0} · ${a.degats||'—'} ${a.type_degats||''})`
    : `⚡ ${p.nom} utilise sa réaction : ${a.nom}`;
  envoyerMsgSysteme(msg);
  renderInitiativeList();
}
window.utiliserReaction = utiliserReaction;

function utiliserLegendaire(pid, idx, cout) {
  const p = trouverParticipant(pid);
  if (!p) return;
  const legNb = p.actions_leg_nb || 0;
  if (p._leg_pool == null) p._leg_pool = legNb;
  if (p._leg_pool < cout) return;
  p._leg_pool -= cout;
  const a = (p.actions_legendaires||[])[idx];
  const msg = a.type_action === 'attaque'
    ? `👑 ${p.nom} — ${a.nom} (+${a.bonus_atk||0} · ${a.degats||'—'} ${a.type_degats||''})`
    : `👑 ${p.nom} — ${a.nom}`;
  envoyerMsgSysteme(msg);
  renderInitiativeList();
}
window.utiliserLegendaire = utiliserLegendaire;

function resetLegendaires(pid) {
  const p = trouverParticipant(pid);
  if (!p) return;
  p._leg_pool = p.actions_leg_nb || 0;
  renderInitiativeList();
}
window.resetLegendaires = resetLegendaires;

function utiliserResLeg(pid) {
  const p = trouverParticipant(pid);
  if (!p) return;
  if (p._res_pool == null) p._res_pool = p.resistances_leg_nb || 0;
  if (p._res_pool <= 0) return;
  p._res_pool--;
  envoyerMsgSysteme(`🛡️ ${p.nom} utilise une résistance légendaire (${p._res_pool}/${p.resistances_leg_nb} restantes)`);
  renderInitiativeList();
}
window.utiliserResLeg = utiliserResLeg;

function resetResLeg(pid) {
  const p = trouverParticipant(pid);
  if (!p) return;
  p._res_pool = p.resistances_leg_nb || 0;
  renderInitiativeList();
}
window.resetResLeg = resetResLeg;

// Reset réaction au changement de tour (appelé dans tourSuivant)
function resetReactionsTour(pid) {
  const p = trouverParticipant(pid);
  if (p) p._react_used = false;
}

// ─── ATTAQUE MONSTRE → JOUEUR (depuis MJ) ─────────────────────

let _mjAtkSource = null;
let _mjAtkTarget = null;
let _mjAtkAvantage = 'normal'; // 'normal' | 'avantage' | 'desavantage'

function cycleAvantage() {
  const states = ['normal', 'avantage', 'desavantage'];
  const labels = { normal: 'Normal', avantage: '✅ Avantage', desavantage: '❌ Désavantage' };
  const idx = states.indexOf(_mjAtkAvantage);
  _mjAtkAvantage = states[(idx + 1) % 3];
  const btn = document.getElementById('mj-atk-avantage-btn');
  if (btn) { btn.textContent = labels[_mjAtkAvantage]; btn.dataset.state = _mjAtkAvantage; }
}
window.cycleAvantage = cycleAvantage;

function lancerD20Avantage() {
  const r1 = Math.ceil(Math.random() * 20);
  const r2 = Math.ceil(Math.random() * 20);
  let result, detail;
  if (_mjAtkAvantage === 'avantage') {
    result = Math.max(r1, r2);
    detail = `[${r1}, ${r2}] → ${result}`;
  } else if (_mjAtkAvantage === 'desavantage') {
    result = Math.min(r1, r2);
    detail = `[${r1}, ${r2}] → ${result}`;
  } else {
    result = r1;
    detail = `[${r1}]`;
  }
  document.getElementById('mj-atk-d20').value = result;
  const hint = document.getElementById('mj-atk-d20-result');
  if (hint) hint.textContent = detail;
}
window.lancerD20Avantage = lancerD20Avantage;

function ouvrirModalAttaqueMJ(sourcePid) {
  if (!combatData) return;
  _mjAtkSource = sourcePid || null;
  _mjAtkTarget = null;
  _mjAtkAvantage = 'normal';

  const monstres = combatData.participants.filter(p => p.type !== 'joueur');
  const joueurs  = combatData.participants.filter(p => p.type === 'joueur');

  document.getElementById('mj-atk-source-list').innerHTML = monstres.length
    ? monstres.map(p => `<div class="cible-item ${p.id === _mjAtkSource ? 'selected' : ''}" data-pid="${p.id}" onclick="selMJAtkSource('${p.id}')">${escapeHtml(p.nom)}</div>`).join('')
    : '<div style="color:#555;font-size:0.78rem;">Aucun monstre</div>';

  document.getElementById('mj-atk-target-list').innerHTML = joueurs.length
    ? joueurs.map(p => `<div class="cible-item" data-pid="${p.id}" onclick="selMJAtkTarget('${p.id}')">${escapeHtml(p.nom)} <span class="cible-ca">CA ${p.ca}</span></div>`).join('')
    : '<div style="color:#555;font-size:0.78rem;">Aucun joueur</div>';

  document.getElementById('mj-atk-d20').value = '';
  document.getElementById('mj-atk-degats').value = '';
  document.getElementById('mj-atk-type').value = '';
  const hint = document.getElementById('mj-atk-d20-result');
  if (hint) hint.textContent = '';
  const formHint = document.getElementById('mj-atk-formule-hint');
  if (formHint) formHint.textContent = '';
  const btn = document.getElementById('mj-atk-avantage-btn');
  if (btn) { btn.textContent = 'Normal'; btn.dataset.state = 'normal'; }

  // Pré-afficher les attaques si source déjà connue
  if (_mjAtkSource) renderAtkPredefined(_mjAtkSource);
  else { const z = document.getElementById('mj-atk-predefined'); if (z) z.style.display = 'none'; }

  document.getElementById('modal-attaque-mj').classList.remove('hidden');
}
window.ouvrirModalAttaqueMJ = ouvrirModalAttaqueMJ;

function selMJAtkSource(pid) {
  _mjAtkSource = pid;
  document.querySelectorAll('#mj-atk-source-list .cible-item').forEach(el => el.classList.toggle('selected', el.dataset.pid === pid));
  renderAtkPredefined(pid);
}
window.selMJAtkSource = selMJAtkSource;

function selMJAtkTarget(pid) {
  _mjAtkTarget = pid;
  document.querySelectorAll('#mj-atk-target-list .cible-item').forEach(el => el.classList.toggle('selected', el.dataset.pid === pid));
}
window.selMJAtkTarget = selMJAtkTarget;

function renderAtkPredefined(pid) {
  const p = trouverParticipant(pid);
  const zone = document.getElementById('mj-atk-predefined');
  const list = document.getElementById('mj-atk-predefined-list');
  if (!zone || !list) return;
  const atks = p?.attaques || [];
  if (!atks.length) { zone.style.display = 'none'; return; }
  zone.style.display = '';
  list.innerHTML = atks.map((a, i) =>
    `<button class="atk-preset-btn" data-i="${i}"
      title="+${a.bonus||0} · ${escapeHtml(a.degats||'')} ${escapeHtml(a.type||'')}"
      onclick="selAtkPreset(${i})"
    >${escapeHtml(a.nom)}</button>`
  ).join('');
}

function selAtkPreset(idx) {
  const p = trouverParticipant(_mjAtkSource);
  if (!p) return;
  const a = (p.attaques||[])[idx];
  if (!a) return;
  document.querySelectorAll('#mj-atk-predefined-list .atk-preset-btn').forEach((b, i) => b.classList.toggle('selected', i === idx));
  // Ne pas pré-remplir le d20 — le MJ le lance lui-même ou clique 🎲
  document.getElementById('mj-atk-type').value = a.type || '';
  const formHint = document.getElementById('mj-atk-formule-hint');
  if (formHint) formHint.textContent = `Formule dégâts : ${a.degats||'—'} · Bonus atk : +${a.bonus||0}`;
  // Pré-remplir dégâts avec la valeur moyenne arrondie de la formule
  const avg = evalDiceAvg(a.degats||'0');
  document.getElementById('mj-atk-degats').value = avg;
}
window.selAtkPreset = selAtkPreset;

function evalDiceAvg(formula) {
  // Ex: "2d6+3" → avg = 2*3.5 + 3 = 10
  const m = String(formula).match(/^(\d+)d(\d+)(?:([+-])(\d+))?/i);
  if (!m) return parseInt(formula)||0;
  const avg = parseInt(m[1]) * (parseInt(m[2]) + 1) / 2 + (m[3] === '+' ? parseInt(m[4]||0) : -(parseInt(m[4]||0)));
  return Math.round(avg);
}

async function confirmerAttaqueMJ() {
  if (!combatId) return;
  const d20    = parseInt(document.getElementById('mj-atk-d20').value) || 10;
  const degats = parseInt(document.getElementById('mj-atk-degats').value) || 0;
  const type   = document.getElementById('mj-atk-type').value.trim();

  try {
    const r = await fetch(`${API}/Combats/${combatId}/attaque`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        attaquant_id: _mjAtkSource || 'mj',
        cible_id: _mjAtkTarget,
        d20, degats,
        type_degats: type,
        avantage: _mjAtkAvantage !== 'normal' ? _mjAtkAvantage : undefined
      })
    });
    const data = await r.json();
    if (_mjAtkTarget) {
      const p = trouverParticipant(_mjAtkTarget);
      if (p && data.pv_restants !== undefined) p.pv_actuels = data.pv_restants;
    }
    renderInitiativeList();
    renderJoueursPv();
    document.getElementById('modal-attaque-mj').classList.add('hidden');
    await chargerJournal();
    await chargerMessages();
  } catch (e) { console.error(e); }
}
window.confirmerAttaqueMJ = confirmerAttaqueMJ;

// ─── PANNEAU REPOS MJ ─────────────────────────────────────────

let _reposActifMJId  = null;
let _mjTimerInterval = null;

async function chargerVoteReposMJ() {
  if (!sessionId) return;
  try {
    const r = await fetch(`${API}/Repos/actif/${sessionId}`, { headers: authHeaders() });
    if (!r.ok) {
      document.getElementById('mj-repos-vote-panel').style.display = 'none';
      _reposActifMJId = null;
      return;
    }
    const data = await r.json();
    _reposActifMJId = data._id;

    const panel = document.getElementById('mj-repos-vote-panel');
    if (panel) panel.style.display = 'block';
    const titreEl = document.getElementById('mj-repos-titre');
    if (titreEl) titreEl.textContent =
      `${data.type==='court'?'🌙':'💤'} ${data.demandeur_nom} — Repos ${data.type==='court'?'Court':'Long'}`;

    const nbOk  = (data.votes||[]).filter(v => v.reponse==='ok').length;
    const nbNon = (data.votes||[]).filter(v => v.reponse==='non').length;
    const nbAtt = (data.votes||[]).length - nbOk - nbNon;
    const scEl = document.getElementById('mj-repos-scores');
    if (scEl) scEl.textContent = `Votes : ✅ ${nbOk}  ❌ ${nbNon}  ⏳ ${nbAtt}`;

    const votesEl = document.getElementById('mj-repos-votes');
    if (votesEl) votesEl.innerHTML = (data.votes||[]).map(v => `
      <div class="vote-item">
        <span class="v-nom">${escapeHtml(v.nom)}</span>
        <span class="v-rep ${v.reponse||'att'}">${v.reponse==='ok'?'✅':v.reponse==='non'?'❌':'⏳'}</span>
      </div>`).join('') || '<div style="color:#555;font-size:0.72rem;">Aucun vote</div>';

    // Timer
    if (data.timer_expire && !_mjTimerInterval) {
      _mjTimerInterval = setInterval(() => {
        const restant = Math.max(0, Math.floor((new Date(data.timer_expire) - new Date()) / 1000));
        const el = document.getElementById('mj-repos-timer');
        if (el) { el.textContent = `⏱️ ${String(Math.floor(restant/60)).padStart(2,'0')}:${String(restant%60).padStart(2,'0')}`; el.style.display='block'; }
        if (restant <= 0) { clearInterval(_mjTimerInterval); _mjTimerInterval = null; }
      }, 1000);
    }
  } catch(e) { /* silencieux */ }
}

async function validerReposMJ() {
  if (!_reposActifMJId) return;
  try {
    await fetch(`${API}/Repos/${_reposActifMJId}/valider`, { method:'PUT', headers: authHeaders() });
    await fetch(`${API}/Repos/${_reposActifMJId}/appliquer`, { method:'POST', headers: authHeaders() });
    const panel = document.getElementById('mj-repos-vote-panel');
    if (panel) panel.style.display = 'none';
    afficherResultatReposMJ('✅ Repos validé et appliqué à tous !', 'succes');
    _reposActifMJId = null;
    await chargerJournal();
  } catch(e) { console.error(e); }
}
window.validerReposMJ = validerReposMJ;

async function refuserReposMJ() {
  if (!_reposActifMJId) return;
  try {
    await fetch(`${API}/Repos/${_reposActifMJId}/refuser`, { method:'PUT', headers: authHeaders() });
    const panel = document.getElementById('mj-repos-vote-panel');
    if (panel) panel.style.display = 'none';
    afficherResultatReposMJ('❌ Repos refusé.', 'echec');
    _reposActifMJId = null;
  } catch(e) { console.error(e); }
}
window.refuserReposMJ = refuserReposMJ;

async function majTimerReposMJ() {
  if (!_reposActifMJId) return;
  const timer = parseInt(document.getElementById('mj-repos-timer-sel')?.value) || 0;
  try {
    await fetch(`${API}/Repos/${_reposActifMJId}/timer`, {
      method:'PUT', headers: authHeaders(), body: JSON.stringify({ timer_secondes: timer })
    });
  } catch(e) { /* silencieux */ }
}
window.majTimerReposMJ = majTimerReposMJ;

async function imposerReposMJ(type) {
  if (!sessionId) return;
  try {
    const r = await fetch(`${API}/Repos/imposer`, {
      method:'POST', headers: authHeaders(),
      body: JSON.stringify({ session_id: sessionId, type })
    });
    const data = await r.json();
    afficherResultatReposMJ(
      `${type==='court'?'🌙':'💤'} Repos ${type==='court'?'court':'long'} imposé à ${data.nb_personnages||0} personnage(s) !`,
      'succes'
    );
  } catch(e) { afficherResultatReposMJ(`❌ ${e.message}`, 'echec'); }
}
window.imposerReposMJ = imposerReposMJ;

function afficherResultatReposMJ(msg, type) {
  const el = document.getElementById('mj-repos-result');
  if (!el) return;
  el.innerHTML = `<div class="repos-result-msg ${type}" style="font-size:0.76rem;">${msg}</div>`;
  setTimeout(() => { el.innerHTML=''; }, 5000);
}

// ─── INTÉGRATION JOURNAL DANS AUTO-REFRESH ────────────────────

const _origRefresh = refresh;
// ─── XP / NIVEAU ──────────────────────────────────────────────

const XP_PAR_NIVEAU_MJ = {
  1:0, 2:300, 3:900, 4:2700, 5:6500, 6:14000, 7:23000, 8:34000,
  9:48000, 10:64000, 11:85000, 12:100000, 13:120000, 14:140000,
  15:165000, 16:195000, 17:225000, 18:265000, 19:305000, 20:355000
};

let _joueursSession = [];

async function chargerJoueursXP() {
  if (!sessionId) return;
  try {
    const r = await fetch(`${API}/Sessions/${sessionId}`, { headers: authHeaders() });
    if (!r.ok) return;
    const s = await r.json();
    _joueursSession = (s.joueurs || []).filter(j => j.personnage_id);
    await _renderJoueursXP();
  } catch {}
}

async function _renderJoueursXP() {
  const list = document.getElementById('mj-xp-joueurs-list');
  if (!list) return;
  if (!_joueursSession.length) {
    list.innerHTML = '<div style="font-size:0.78rem;color:#555;">Aucun joueur avec personnage.</div>';
    return;
  }
  // Charger les persos pour avoir XP/niveau
  const items = [];
  for (const j of _joueursSession) {
    try {
      const r = await fetch(`${API}/Personnages/${j.personnage_id}`, { headers: authHeaders() });
      if (r.ok) {
        const p = await r.json();
        const xp = p.experience || 0;
        const niv = p.niveau || 1;
        const xpNext = niv < 20 ? XP_PAR_NIVEAU_MJ[niv + 1] : null;
        const levelUp = xpNext && xp >= xpNext;
        items.push(`<div class="mj-xp-joueur-row">
          <span class="mj-xp-joueur-nom">${p.nom}</span>
          <span class="mj-xp-joueur-niv">Niv ${niv}</span>
          <span class="mj-xp-joueur-xp">${xp.toLocaleString('fr')} XP</span>
          ${levelUp ? '<span class="mj-xp-joueur-levelup">⬆️ Level up !</span>' : ''}
        </div>`);
      }
    } catch {}
  }
  list.innerHTML = items.join('');
}

async function distribuerXP() {
  const montant = parseInt(document.getElementById('mj-xp-montant')?.value) || 0;
  if (!montant) return;
  const result = document.getElementById('mj-xp-result');
  result.className = 'info';
  result.textContent = '⏳ Distribution en cours…';
  result.style.display = 'block';
  try {
    const r = await fetch(`${API}/Sessions/${sessionId}/xp`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ xp_total: montant, distribution: 'egal' })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    const niveaux = d.distribues.filter(j => j.level_up).map(j => `${j.nom} → Niv ${j.niveau}`);
    result.className = 'succes';
    result.textContent = `🌟 ${montant} XP distribués !${niveaux.length ? ' ⬆️ ' + niveaux.join(', ') : ''}`;
    document.getElementById('mj-xp-montant').value = '';
    await _renderJoueursXP();
  } catch (e) {
    result.className = '';
    result.style.background = 'rgba(248,113,113,0.1)';
    result.style.color = '#f87171';
    result.textContent = 'Erreur : ' + e.message;
  }
}

async function monterNiveauJalon() {
  const result = document.getElementById('mj-xp-result');
  result.className = 'info';
  result.textContent = '⏳ Montée en niveau…';
  result.style.display = 'block';
  try {
    const r = await fetch(`${API}/Sessions/${sessionId}/jalon`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({})
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    const noms = (d.montes || []).map(j => `${j.nom} → Niv ${j.nouveau_niveau}`).join(', ');
    result.className = 'succes';
    result.textContent = `⬆️ Monté${d.montes?.length > 1 ? 's' : ''} : ${noms || 'Aucun'}`;
    await _renderJoueursXP();
  } catch (e) {
    result.className = '';
    result.style.background = 'rgba(248,113,113,0.1)';
    result.style.color = '#f87171';
    result.textContent = 'Erreur : ' + e.message;
  }
}

async function refresh() {
  await _origRefresh();
  await chargerJournal();
  await chargerVoteReposMJ();
  await chargerJoueursXP();
}

// Exposer pour les onclick HTML inline
window.majInitiative = majInitiative;
window.majPvDirect = majPvDirect;
window.appliquerDelta = appliquerDelta;
window.getDelta = getDelta;
window.ajouterCondition = ajouterCondition;
window.retirerCondition = retirerCondition;
window.toggleVisible = toggleVisible;
window.majNotes = majNotes;
window.supprimerParticipant = supprimerParticipant;
window.distribuerXP = distribuerXP;
window.monterNiveauJalon = monterNiveauJalon;
window.reinitialiserInitiative = reinitialiserInitiative;
window.ouvrirModalFinCombat = ouvrirModalFinCombat;
window.majFinCombatUI = majFinCombatUI;
window.confirmerFinCombat = confirmerFinCombat;
window.tuerMonstre = tuerMonstre;
window.fuirParticipant = fuirParticipant;
window.neutraliserMonstre = neutraliserMonstre;
window.ouvrirModifPvManuel = ouvrirModifPvManuel;
window.confirmerModifPvManuel = confirmerModifPvManuel;
