function _getSidebarOverlay() {
  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:999;display:none;';
    overlay.addEventListener('click', () => toggleSidebar());
    document.body.appendChild(overlay);
  }
  return overlay;
}

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const openBookIcon = document.getElementById('book-icon');
  const closedBookButton = document.getElementById('closed-book-button');
  const isMobile = window.innerWidth <= 768;
  const overlay = _getSidebarOverlay();

  if (sidebar.classList.contains('hidden')) {
    sidebar.classList.remove('hidden');
    if (closedBookButton) closedBookButton.classList.add('hidden');
    if (openBookIcon) openBookIcon.src = 'assets/icone/livremagie.png';
    if (isMobile) overlay.style.display = 'block';
  } else {
    sidebar.classList.add('hidden');
    if (closedBookButton) closedBookButton.classList.remove('hidden');
    if (openBookIcon) openBookIcon.src = 'assets/icone/livrefermer.png';
    overlay.style.display = 'none';
  }
}

// Sur mobile, la sidebar démarre fermée
document.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    const closedBookButton = document.getElementById('closed-book-button');
    if (sidebar) sidebar.classList.add('hidden');
    if (closedBookButton) closedBookButton.classList.remove('hidden');
  }
});
  