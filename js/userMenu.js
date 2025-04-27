document.addEventListener('DOMContentLoaded', () => {
  const avatarButton = document.getElementById('avatar-button');
  const userMenu = document.getElementById('user-menu');

  if (avatarButton && userMenu) {
    console.log("avatarButton et userMenu trouvés !");
    avatarButton.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu.classList.toggle('active');
    });

    // Fermer le menu si on clique ailleurs
    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target) && !avatarButton.contains(e.target)) {
        userMenu.classList.remove('active');
      }
    });
  } else {
    console.error("Erreur : avatarButton ou userMenu non trouvés !");
  }
});
