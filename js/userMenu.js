document.addEventListener('DOMContentLoaded', () => {
  const avatarButton = document.getElementById('avatar-button');
  const userMenu = document.getElementById('user-menu');

  if (avatarButton && userMenu) {
    console.log("avatarButton et userMenu trouvés !");
    avatarButton.addEventListener('click', () => {
      console.log("Clic sur avatarButton : toggle menu !");
      userMenu.classList.toggle('hidden');
    });
  } else {
    console.error("Erreur : avatarButton ou userMenu non trouvés !");
  }
});
