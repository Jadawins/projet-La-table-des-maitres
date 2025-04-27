export function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const openBookIcon = document.getElementById('book-icon');
    const closedBookButton = document.getElementById('closed-book-button');
  
    if (sidebar.classList.contains('hidden')) {
      // Réouvrir la sidebar
      sidebar.classList.remove('hidden');
      closedBookButton.classList.add('hidden');
      openBookIcon.src = "assets/icone/livremagie.png"; // --> Glow intégré
    } else {
      // Fermer la sidebar
      sidebar.classList.add('hidden');
      closedBookButton.classList.remove('hidden');
      openBookIcon.src = "assets/icone/livrefermer.png"; // --> Livre fermé
    }
  }
  