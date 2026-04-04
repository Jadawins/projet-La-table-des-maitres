/* ── Panneau combat dans session-detail ── */
const API_DETAIL = 'https://myrpgtable.fr/api';
let combatPanelId = null;
let combatRefreshInterval = null;

function authHdrs() {
  return { 'Content-Type':'application/json', 'Authorization':`Bearer ${window.SUPABASE_TOKEN||''}` };
}

async function chargerCombatPanel() {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get('id');
  if (!sid || !window.SESSION_ID) return;

  try {
    const res = await fetch(`${API_DETAIL}/Combats/${sid}`, { headers: authHdrs() });
    if (!res.ok) { hideCombatPanels(); return; }
    const combat = await res.json();
    combatPanelId = combat._id;

    if (combat.est_mj) {
      document.getElementById('block-combat-mj').style.display = 'block';
      document.getElementById('block-combat-joueur').style.display = 'none';
      document.getElementById('btn-ecran-mj').href = `ecran-mj.html?session=${sid}`;
      const sorted = [...combat.participants].sort((a,b) => b.initiative - a.initiative);
      const actuel = sorted[combat.tour_actuel];
      document.getElementById('combat-summary-mj').innerHTML =
        `⚔️ Round <strong>${combat.round}</strong> — Tour de <strong>${actuel?.nom || '?'}</strong><br>` +
        `${combat.participants.length} participant(s)`;
    } else if (combat.est_joueur !== false) {
      document.getElementById('block-combat-joueur').style.display = 'block';
      document.getElementById('block-combat-mj').style.display = 'none';
      renderJoueurCombatPanel(combat);
    }
  } catch (e) {
    hideCombatPanels();
  }
}

function hideCombatPanels() {
  document.getElementById('block-combat-mj').style.display = 'none';
  document.getElementById('block-combat-joueur').style.display = 'none';
}

function renderJoueurCombatPanel(combat) {
  const monEntree = (combat.participants||[]).find(p => p.user_id === window.USER_ID);

  const pvEl = document.getElementById('joueur-pv-combat');
  if (monEntree) {
    const pct = monEntree.pv_max ? Math.round((monEntree.pv_actuels/monEntree.pv_max)*100) : 0;
    const pvC = pct <= 0 ? 'zero' : pct < 25 ? 'bas' : pct < 50 ? 'moyen' : 'haut';
    pvEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:0.82rem;color:#aaa;margin-bottom:0.25rem;">
        <span>Mes PV</span><span style="color:#d5d1a9">${monEntree.pv_actuels} / ${monEntree.pv_max}</span>
      </div>
      <div class="pv-bar"><div class="pv-bar-fill ${pvC}" style="width:${pct}%"></div></div>`;

    const condEl = document.getElementById('joueur-conditions-combat');
    condEl.innerHTML = (monEntree.conditions||[]).map(c => {
      const lab = {a_terre:'À terre',agrippe:'Agrippé',assourdi:'Assourdi',aveugle:'Aveuglé',
        charme:'Charmé',effraye:'Effrayé',empoisonne:'Empoisonné',entrave:'Entravé',
        epuisement:'Épuisement',etourdi:'Étourdi',inconscient:'Inconscient',
        invisible:'Invisible',neutralise:'Neutralisé',paralyse:'Paralysé',petrifie:'Pétrifié'}[c] || c;
      return `<span class="session-tag" style="font-size:0.72rem;">${lab}</span>`;
    }).join('');
  }

  const visibles = (combat.participants||[]).filter(p => p.visible_joueurs && p.user_id !== window.USER_ID);
  const visEl = document.getElementById('joueur-participants-visibles');
  visEl.innerHTML = visibles.map(p => {
    const pct = p.pv_max ? Math.round((p.pv_actuels/p.pv_max)*100) : 0;
    const pvC = pct <= 0 ? 'zero' : pct < 25 ? 'bas' : pct < 50 ? 'moyen' : 'haut';
    return `<div style="margin-bottom:0.4rem;">
      <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:#aaa;">
        <span>${p.nom}</span><span>${pct}%</span>
      </div>
      <div class="pv-bar" style="height:4px;">
        <div class="pv-bar-fill ${pvC}" style="width:${pct}%"></div>
      </div>
    </div>`;
  }).join('') || '<p style="font-size:0.78rem;color:#555;">Aucun participant visible.</p>';

  const msgs = (combat.messages||[])
    .filter(m => m.destinataire === 'tous' || m.destinataire === window.USER_ID || m.expediteur_id === window.USER_ID)
    .slice(-20);
  const msgEl = document.getElementById('joueur-messages-list');
  msgEl.innerHTML = msgs.map(m => `
    <div class="message-item ${m.type}" style="margin-bottom:0.3rem;padding:0.3rem 0.5rem;">
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:0.72rem;font-weight:bold;color:${m.type==='secret'?'#c9b8ff':'#c9a84c'}">${m.expediteur_nom}</span>
        <span style="font-size:0.65rem;color:#555;">${new Date(m.timestamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
      </div>
      <div style="font-size:0.8rem;color:${m.type==='systeme'?'#666':m.type==='secret'?'#b0a0ff':'#ccc'}">${(m.contenu||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>
    </div>`).join('');
  msgEl.scrollTop = msgEl.scrollHeight;
}

async function joueurEnvoyerMessage() {
  const input = document.getElementById('joueur-msg-input');
  const contenu = input.value.trim();
  if (!contenu || !combatPanelId) return;
  try {
    await fetch(`${API_DETAIL}/Combats/${combatPanelId}/message`, {
      method: 'POST',
      headers: authHdrs(),
      body: JSON.stringify({ contenu, destinataire: 'tous', type: 'normal', expediteur_nom: window.USER_PSEUDO || 'Joueur' })
    });
    input.value = '';
    await chargerCombatPanel();
  } catch(e) {}
}
window.joueurEnvoyerMessage = joueurEnvoyerMessage;

async function lancerCombat() {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get('id');
  if (!sid) return;
  try {
    const res = await fetch(`${API_DETAIL}/Combats`, {
      method: 'POST',
      headers: authHdrs(),
      body: JSON.stringify({ session_id: sid })
    });
    if (res.ok) window.location.href = `ecran-mj.html?session=${sid}`;
  } catch(e) {}
}
window.lancerCombat = lancerCombat;

function waitAndLoad(tries = 0) {
  if (window.SUPABASE_TOKEN && window.SESSION_ID) {
    chargerCombatPanel();
    combatRefreshInterval = setInterval(() => {
      if (!document.hidden) chargerCombatPanel();
    }, 5000);
  } else if (tries < 40) {
    setTimeout(() => waitAndLoad(tries + 1), 150);
  }
}
document.addEventListener('DOMContentLoaded', () => waitAndLoad());
window.addEventListener('beforeunload', () => clearInterval(combatRefreshInterval));
