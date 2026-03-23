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

        <div class="participant-row" style="gap:0.4rem;flex-wrap:wrap;">
          <button class="btn-action-combat attaque" style="font-size:0.7rem;padding:0.2rem 0.6rem;" onclick="ouvrirModalDegats('${p.id}')">⚔️ Dégâts</button>
          <button class="btn-action-combat soin" style="font-size:0.7rem;padding:0.2rem 0.6rem;" onclick="ouvrirModalSoin('${p.id}')">💚 Soin</button>
        </div>

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
  p.initiative = parseInt(val) || 0;
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
  if (p.pv_actuels === 0) envoyerMsgSysteme(`${p.nom} tombe à 0 PV !`);
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
  if (avant > 0 && p.pv_actuels === 0) envoyerMsgSysteme(`${p.nom} tombe à 0 PV !`);
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
    renderInitiativeList();
    await chargerMessages();
  } catch (e) { console.error(e); }
}
window.tourSuivant = tourSuivant;

// ─── MODALE PARTICIPANT ───────────────────────────────────────

function ouvrirModalParticipant() {
  document.getElementById('p-nom').value = '';
  document.getElementById('p-type').value = 'monstre';
  document.getElementById('p-init').value = '10';
  document.getElementById('p-pv').value = '10';
  document.getElementById('p-ca').value = '10';
  document.getElementById('modal-participant').classList.remove('hidden');
}
window.ouvrirModalParticipant = ouvrirModalParticipant;

function fermerModal() {
  document.getElementById('modal-participant').classList.add('hidden');
}
window.fermerModal = fermerModal;

async function ajouterParticipant() {
  if (!combatId) return;
  const body = {
    nom: document.getElementById('p-nom').value || 'Inconnu',
    type: document.getElementById('p-type').value,
    initiative: parseInt(document.getElementById('p-init').value) || 0,
    pv_max: parseInt(document.getElementById('p-pv').value) || 10,
    ca: parseInt(document.getElementById('p-ca').value) || 10,
    visible_joueurs: document.getElementById('p-visible').value !== 'false'
  };
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

// ─── TERMINER COMBAT ─────────────────────────────────────────

async function terminerCombat() {
  if (!confirm('Terminer le combat ? Il sera archivé.')) return;
  try {
    await fetch(`${API}/Combats/${combatId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ statut: 'termine' })
    });
    clearInterval(refreshInterval);
    window.location.href = `session-detail.html?id=${sessionId}`;
  } catch (e) { console.error(e); }
}
window.terminerCombat = terminerCombat;

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

// ─── ATTAQUE MONSTRE → JOUEUR (depuis MJ) ─────────────────────

let _mjAtkSource = null;
let _mjAtkTarget = null;

function ouvrirModalAttaqueMJ() {
  if (!combatData) return;
  _mjAtkSource = null; _mjAtkTarget = null;

  const monstres = combatData.participants.filter(p => p.type !== 'joueur');
  const joueurs  = combatData.participants.filter(p => p.type === 'joueur');

  document.getElementById('mj-atk-source-list').innerHTML = monstres.length
    ? monstres.map(p => `<div class="cible-item" data-pid="${p.id}" onclick="selMJAtkSource('${p.id}')">${escapeHtml(p.nom)}</div>`).join('')
    : '<div style="color:#555;font-size:0.78rem;">Aucun monstre</div>';

  document.getElementById('mj-atk-target-list').innerHTML = joueurs.length
    ? joueurs.map(p => `<div class="cible-item" data-pid="${p.id}" onclick="selMJAtkTarget('${p.id}')">${escapeHtml(p.nom)} <span class="cible-ca">CA ${p.ca}</span></div>`).join('')
    : '<div style="color:#555;font-size:0.78rem;">Aucun joueur</div>';

  document.getElementById('mj-atk-d20').value = '';
  document.getElementById('mj-atk-degats').value = '';
  document.getElementById('mj-atk-type').value = '';
  document.getElementById('modal-attaque-mj').classList.remove('hidden');
}
window.ouvrirModalAttaqueMJ = ouvrirModalAttaqueMJ;

function selMJAtkSource(pid) {
  _mjAtkSource = pid;
  document.querySelectorAll('#mj-atk-source-list .cible-item').forEach(el => el.classList.toggle('selected', el.dataset.pid === pid));
}
window.selMJAtkSource = selMJAtkSource;

function selMJAtkTarget(pid) {
  _mjAtkTarget = pid;
  document.querySelectorAll('#mj-atk-target-list .cible-item').forEach(el => el.classList.toggle('selected', el.dataset.pid === pid));
}
window.selMJAtkTarget = selMJAtkTarget;

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
        type_degats: type
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
async function refresh() {
  await _origRefresh();
  await chargerJournal();
  await chargerVoteReposMJ();
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
