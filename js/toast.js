/* ================================================================
   TOAST — Composant vanilla JS
   Usage : toast('Message', 'success')  // 'success'|'error'|'warning'|'info'
   ================================================================ */

(function () {
  const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const DEFAULT_DURATION = 3500;

  function getContainer() {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  window.toast = function (msg, type = 'info', duration = DEFAULT_DURATION) {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `
      <span class="toast__icon">${ICONS[type] || ICONS.info}</span>
      <span class="toast__msg">${String(msg).replace(/</g,'&lt;')}</span>
      <button class="toast__close" aria-label="Fermer">✕</button>`;

    el.querySelector('.toast__close').addEventListener('click', () => dismiss(el));
    getContainer().appendChild(el);

    const timer = setTimeout(() => dismiss(el), duration);
    el._timer = timer;
    return el;
  };

  function dismiss(el) {
    clearTimeout(el._timer);
    el.classList.add('toast--out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    // Fallback si animation désactivée
    setTimeout(() => el.remove(), 600);
  }

  // Expose aussi sous forme utilitaire
  window.toastSuccess = (msg) => toast(msg, 'success');
  window.toastError   = (msg) => toast(msg, 'error');
  window.toastWarning = (msg) => toast(msg, 'warning');
  window.toastInfo    = (msg) => toast(msg, 'info');
})();
