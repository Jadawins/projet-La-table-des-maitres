/* =============================================================
   SERVICE WORKER — myrpgtable.fr
   Gère les notifications push et le cache de base
   ============================================================= */

const CACHE_NAME = 'myrpgtable-v1';
const CACHE_STATIC = [
  '/',
  '/home.html',
  '/css/theme.css',
  '/assets/icone/favicon-192.png',
];

// ─── INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Tenter de cacher les assets statiques (silencieux si erreur)
      return Promise.allSettled(CACHE_STATIC.map(url => cache.add(url)));
    })
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH — network-first ───────────────────────────────────
self.addEventListener('fetch', event => {
  // Ne pas intercepter les requêtes API ou non-GET
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cacher les assets statiques CSS/JS/images
        if (response.ok && (
          event.request.url.includes('/css/') ||
          event.request.url.includes('/assets/')
        )) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ─── PUSH NOTIFICATION ───────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { titre: '🔔 Notification', message: event.data.text() }; }

  const ICONES = {
    tour:'🎯', level_up:'⬆️', repos:'🌙', message:'💬',
    joueur_rejoint:'👤', combat_debut:'⚔️', combat_fin:'🏁',
    mort:'💀', soin_critique:'💚', sort_concentration:'💨'
  };
  const icone = ICONES[data.type] || '🔔';

  event.waitUntil(
    self.registration.showNotification(`${icone} ${data.titre || 'Notification'}`, {
      body: data.message || '',
      icon: '/assets/icone/favicon-192.png',
      badge: '/assets/icone/favicon-96.png',
      tag: data._id || data.type || 'notif',
      renotify: true,
      data: { lien: data.lien || '/home.html' }
    })
  );
});

// ─── NOTIFICATION CLICK ──────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const lien = event.notification.data?.lien || '/home.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const existing = windowClients.find(c => c.url.includes(lien) && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(lien);
    })
  );
});
