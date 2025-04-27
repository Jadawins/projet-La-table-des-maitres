// js/userMenu.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { checkSession } from './authGuard.js';

document.addEventListener('DOMContentLoaded', async () => {
  const supabase = await checkSession();

  // Charger l'avatar utilisateur
  const user = (await supabase.auth.getSession()).data.session.user;
  const avatarUrl = user.user_metadata?.avatar_url || 'assets/img/default-avatar.png';
  const avatarImg = document.getElementById('avatar-img');
  if (avatarImg) {
    avatarImg.src = avatarUrl;
  }

  // Ouvrir/fermer le menu utilisateur
  const avatarButton = document.getElementById('avatar-button');
  const userMenu = document.getElementById('user-menu');

  if (avatarButton && userMenu) {
    avatarButton.addEventListener('click', () => {
      userMenu.classList.toggle('hidden');
    });
  }

  // Gestion du bouton déconnexion
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = "login.html";
    });
  }
});
