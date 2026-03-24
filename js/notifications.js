/* =============================================================
   NOTIFICATIONS.JS — Système de notifications centralisé
   ============================================================= */

const NOTIF_API = 'https://myrpgtable.fr/api';

const NOTIF_ICONES = {
  tour:               '🎯',
  level_up:           '⬆️',
  repos:              '🌙',
  message:            '💬',
  joueur_rejoint:     '👤',
  combat_debut:       '⚔️',
  combat_fin:         '🏁',
  mort:               '💀',
  soin_critique:      '💚',
  sort_concentration: '💨',
};

// ─── État ─────────────────────────────────────────────────────
let _notifUserId   = null;
let _notifToken    = null;
let _notifPanel    = false;
let _notifInterval = null;
let _notifIds      = new Set(); // IDs déjà connus
let _swRegistered  = false;

// ─── INITIALISATION ───────────────────────────────────────────
function initNotifications(userId, token) {
  _notifUserId = userId;
  _notifToken  = token;

  _injecterUI();
  _chargerNotifications();

  // Polling 10s
  _notifInterval = setInterval(_chargerNotifications, 10000);
  window.addEventListener('beforeunload', () => clearInterval(_notifInterval));

  // Service Worker
  _initServiceWorker();

  // Demande de permission (différée 3s)
  setTimeout(_proposerPermission, 3000);
}

// ─── INJECTION UI ────────────────────────────────────────────
function _injecterUI() {
  // Injecter le conteneur toasts
  if (!document.getElementById('notif-toasts')) {
    const t = document.createElement('div');
    t.id = 'notif-toasts';
    document.body.appendChild(t);
  }

  // Injecter le panneau
  if (!document.getElementById('notif-panneau')) {
    const p = document.createElement('div');
    p.id = 'notif-panneau';
    p.innerHTML = `
      <div class="notif-panneau-header">
        <span class="notif-panneau-titre">🔔 Notifications</span>
        <button class="notif-btn-tout-lu" onclick="notifToutMarquerLu()">Tout marquer comme lu</button>
      </div>
      <div class="notif-liste" id="notif-liste-inner"></div>
      <div class="notif-panneau-footer">
        <span class="notif-footer-lien" style="cursor:default;">Mise à jour automatique toutes les 10s</span>
      </div>`;
    document.body.appendChild(p);
  }

  // Injecter la modale permission push
  if (!document.getElementById('notif-permission-modal')) {
    const m = document.createElement('div');
    m.id = 'notif-permission-modal';
    m.innerHTML = `
      <div class="notif-perm-titre">🔔 Notifications de jeu</div>
      <div class="notif-perm-msg">Autorisez les notifications pour ne pas manquer votre tour, un niveau disponible ou un message du MJ — même si l'onglet est en arrière-plan.</div>
      <div class="notif-perm-btns">
        <button class="notif-perm-btn plus-tard" onclick="notifRefuserPermission()">Plus tard</button>
        <button class="notif-perm-btn autoriser" onclick="notifAutoriseerPermission()">Autoriser</button>
      </div>`;
    document.body.appendChild(m);
  }

  // Injecter la cloche dans la sidebar si elle existe
  const sidebarHeader = document.querySelector('.sidebar-header.sidebar-header-flex');
  if (sidebarHeader && !document.getElementById('notif-btn')) {
    const btn = document.createElement('button');
    btn.id = 'notif-btn';
    btn.setAttribute('aria-label', 'Notifications');
    btn.setAttribute('onclick', 'notifTogglePanneau()');
    btn.innerHTML = `🔔<span id="notif-badge"></span>`;
    sidebarHeader.insertBefore(btn, sidebarHeader.children[1] || null);
  }

  // Cloche dans la topbar MJ (si pas de sidebar)
  const mjTopbarRight = document.querySelector('.topbar-right');
  if (mjTopbarRight && !document.getElementById('notif-btn')) {
    const btn = document.createElement('button');
    btn.id = 'notif-btn';
    btn.setAttribute('aria-label', 'Notifications');
    btn.setAttribute('onclick', 'notifTogglePanneau()');
    btn.style.cssText = 'background:none;border:none;color:#ccc;font-size:1.1rem;cursor:pointer;padding:4px 8px;border-radius:6px;position:relative;';
    btn.innerHTML = `🔔<span id="notif-badge" style="position:absolute;top:0;right:0;background:#dc2626;color:#fff;font-size:0.58rem;font-weight:bold;border-radius:10px;min-width:14px;height:14px;display:none;align-items:center;justify-content:center;padding:0 3px;"></span>`;
    mjTopbarRight.prepend(btn);
  }

  // Cloche dans la topbar fiche personnage (si pas de sidebar, pas de .topbar-right)
  const ficheTopbar = document.querySelector('.fiche-topbar');
  if (ficheTopbar && !document.getElementById('notif-btn')) {
    const btn = document.createElement('button');
    btn.id = 'notif-btn';
    btn.setAttribute('aria-label', 'Notifications');
    btn.setAttribute('onclick', 'notifTogglePanneau()');
    btn.style.cssText = 'background:none;border:none;color:#ccc;font-size:1.1rem;cursor:pointer;padding:4px 8px;border-radius:6px;position:relative;';
    btn.innerHTML = `🔔<span id="notif-badge" style="position:absolute;top:0;right:0;background:#dc2626;color:#fff;font-size:0.58rem;font-weight:bold;border-radius:10px;min-width:14px;height:14px;display:none;align-items:center;justify-content:center;padding:0 3px;"></span>`;
    ficheTopbar.appendChild(btn);
  }

  // Fermer panneau si clic dehors
  document.addEventListener('click', (e) => {
    const panneau = document.getElementById('notif-panneau');
    const btn = document.getElementById('notif-btn');
    if (panneau && btn && !panneau.contains(e.target) && !btn.contains(e.target)) {
      panneau.classList.remove('ouvert');
      _notifPanel = false;
    }
  });
}

// ─── TOGGLE PANNEAU ──────────────────────────────────────────
function notifTogglePanneau() {
  const panneau = document.getElementById('notif-panneau');
  if (!panneau) return;
  _notifPanel = !_notifPanel;
  panneau.classList.toggle('ouvert', _notifPanel);
  if (_notifPanel) _chargerNotifications();
}

// ─── CHARGER NOTIFICATIONS ───────────────────────────────────
async function _chargerNotifications() {
  if (!_notifUserId || !_notifToken) return;
  try {
    const r = await fetch(`${NOTIF_API}/Notifications?user_id=${_notifUserId}&lu=false&limit=20`, {
      headers: { 'Authorization': `Bearer ${_notifToken}` }
    });
    if (!r.ok) return;
    const notifs = await r.json();

    _majBadge(notifs.length);
    _renderPanneau(notifs);

    // Détecter nouvelles notifications (apparues depuis dernier polling)
    notifs.forEach(n => {
      if (!_notifIds.has(n._id)) {
        _notifIds.add(n._id);
        if (_notifIds.size > 1) { // Pas le premier chargement
          afficherToast(n);
          _notifPush(n);
        }
      }
    });

    // Premier chargement : juste mémoriser les IDs
    if (_notifIds.size === 0) notifs.forEach(n => _notifIds.add(n._id));

  } catch {}
}

function _majBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = 'flex';
    badge.classList.add('visible');
  } else {
    badge.style.display = 'none';
    badge.classList.remove('visible');
  }
}

function _renderPanneau(notifs) {
  const inner = document.getElementById('notif-liste-inner');
  if (!inner) return;
  if (!notifs.length) {
    inner.innerHTML = '<div class="notif-vide">Aucune nouvelle notification 🎉</div>';
    return;
  }
  inner.innerHTML = notifs.map(n => {
    const icone = NOTIF_ICONES[n.type] || '🔔';
    const dateRel = _dateRelative(n.date);
    return `<div class="notif-item ${n.lu ? '' : 'non-lu'}" data-type="${n.type}" data-id="${n._id}"
              onclick="notifClicItem('${n._id}','${_esc(n.lien || '')}')" style="cursor:pointer;">
      <div class="notif-icone">${icone}</div>
      <div class="notif-corps">
        <div class="notif-titre">${_esc(n.titre)}</div>
        <div class="notif-message">${_esc(n.message || '')}</div>
        <div class="notif-date">${dateRel}</div>
      </div>
      <button class="notif-lu-btn" onclick="event.stopPropagation();notifMarquerLu('${n._id}')" title="Marquer comme lu">✓</button>
    </div>`;
  }).join('');
}

// ─── ACTIONS ─────────────────────────────────────────────────
async function notifClicItem(id, lien) {
  await notifMarquerLu(id);
  if (lien) window.location.href = lien;
}

async function notifMarquerLu(id) {
  if (!_notifToken) return;
  try {
    await fetch(`${NOTIF_API}/Notifications/${id}/lu`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${_notifToken}` }
    });
    _notifIds.delete(id);
    await _chargerNotifications();
  } catch {}
}

async function notifToutMarquerLu() {
  if (!_notifUserId || !_notifToken) return;
  try {
    await fetch(`${NOTIF_API}/Notifications/lu-tout`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_notifToken}` },
      body: JSON.stringify({ user_id: _notifUserId })
    });
    _notifIds.clear();
    await _chargerNotifications();
  } catch {}
}

// ─── CRÉER NOTIFICATION (fonction centrale) ──────────────────
async function createNotification(opts) {
  // opts: { user_id, session_id, type, titre, message, lien }
  if (!_notifToken) return;
  try {
    await fetch(`${NOTIF_API}/Notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_notifToken}` },
      body: JSON.stringify(opts)
    });
  } catch {}
}

// ─── TOAST ───────────────────────────────────────────────────
function afficherToast(notif) {
  const container = document.getElementById('notif-toasts');
  if (!container) return;
  const icone = NOTIF_ICONES[notif.type] || '🔔';
  const el = document.createElement('div');
  el.className = 'notif-toast';
  el.dataset.type = notif.type;
  el.innerHTML = `
    <div class="notif-toast-icone">${icone}</div>
    <div class="notif-toast-body">
      <div class="notif-toast-titre">${_esc(notif.titre)}</div>
      <div class="notif-toast-msg">${_esc(notif.message || '')}</div>
    </div>`;
  el.onclick = () => {
    notifMarquerLu(notif._id);
    if (notif.lien) window.location.href = notif.lien;
    el.remove();
  };
  container.appendChild(el);

  // Son discret (si autorisé)
  _jouerSon(notif.type);

  // Disparaît après 4s sauf si hover
  let timer = setTimeout(() => _enleverToast(el), 4000);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(() => _enleverToast(el), 2000); });
}

function _enleverToast(el) {
  el.classList.add('sortie');
  setTimeout(() => el.remove(), 300);
}

// Toast rapide sans API (pour événements locaux)
function toastLocal(type, titre, message, lien) {
  afficherToast({ _id: null, type, titre, message, lien });
}
window.toastLocal = toastLocal;

// ─── SON ─────────────────────────────────────────────────────
let _audioCtx = null;
function _jouerSon(type) {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const freq = type === 'tour' ? 660 : type === 'mort' ? 220 : 440;
    const osc  = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain); gain.connect(_audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, _audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.4);
    osc.start(_audioCtx.currentTime);
    osc.stop(_audioCtx.currentTime + 0.4);
  } catch {}
}

// ─── SERVICE WORKER ──────────────────────────────────────────
async function _initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/service-worker.js');
    _swRegistered = true;
    window._swReg = reg;
  } catch {}
}

// ─── PERMISSION PUSH ─────────────────────────────────────────
function _proposerPermission() {
  if (localStorage.getItem('notif_permission_repondu')) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') {
    localStorage.setItem('notif_permission_repondu', '1');
    return;
  }
  document.getElementById('notif-permission-modal')?.classList.add('visible');
}

async function notifAutoriseerPermission() {
  document.getElementById('notif-permission-modal')?.classList.remove('visible');
  localStorage.setItem('notif_permission_repondu', '1');
  try {
    const perm = await Notification.requestPermission();
    localStorage.setItem('notif_permission', perm);
  } catch {}
}

function notifRefuserPermission() {
  document.getElementById('notif-permission-modal')?.classList.remove('visible');
  localStorage.setItem('notif_permission_repondu', 'plus_tard');
  // Proposer à nouveau dans 24h
  setTimeout(() => localStorage.removeItem('notif_permission_repondu'), 86400000);
}

// Notification push système
function _notifPush(notif) {
  if (Notification.permission !== 'granted') return;
  const icone = NOTIF_ICONES[notif.type] || '🔔';
  try {
    const n = new Notification(`${icone} ${notif.titre}`, {
      body: notif.message || '',
      icon: '/assets/icone/favicon-192.png',
      tag: notif._id || notif.type,
      renotify: true
    });
    if (notif.lien) n.onclick = () => { window.focus(); window.location.href = notif.lien; };
  } catch {}
}

// ─── UTILITAIRES ─────────────────────────────────────────────
function _dateRelative(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'À l\'instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── INTÉGRATION AUTH ────────────────────────────────────────
// Auto-init quand le token Supabase est disponible
function _autoInit() {
  const userId = localStorage.getItem('userId');
  const token  = window.SUPABASE_TOKEN;
  if (userId && token) {
    initNotifications(userId, token);
    return true;
  }
  return false;
}

if (!_autoInit()) {
  if (window.SUPABASE_TOKEN) {
    _autoInit();
  } else {
    window.addEventListener('supabase-ready', () => _autoInit(), { once: true });
    // Polling fallback
    let n = 0;
    const t = setInterval(() => {
      if (_autoInit() || ++n > 100) clearInterval(t);
    }, 200);
  }
}

// ─── EXPORTS ─────────────────────────────────────────────────
window.initNotifications        = initNotifications;
window.createNotification       = createNotification;
window.afficherToast            = afficherToast;
window.notifTogglePanneau       = notifTogglePanneau;
window.notifMarquerLu           = notifMarquerLu;
window.notifToutMarquerLu       = notifToutMarquerLu;
window.notifAutoriseerPermission= notifAutoriseerPermission;
window.notifRefuserPermission   = notifRefuserPermission;
window.notifClicItem            = notifClicItem;
