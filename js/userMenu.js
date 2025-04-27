import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

let supabase;

async function initSupabase() {
  try {
    const response = await fetch('https://lampion-api.azurewebsites.net/api/GetSupabaseKey');
    const { url, key } = await response.json();
    supabase = createClient(url, key);
    console.log("Connexion Supabase initialisée ✅");
  } catch (error) {
    console.error("Erreur lors de la récupération de la clé Supabase :", error);
  }
}

function setupUserMenu() {
  const avatarButton = document.getElementById('avatar-button');
  const userMenu = document.getElementById('user-menu');
  const profileButton = document.getElementById('profile-button');
  const logoutButton = document.getElementById('logout-button');

  if (avatarButton && userMenu) {
    avatarButton.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target) && !avatarButton.contains(e.target)) {
        userMenu.classList.remove('active');
      }
    });
  }

  if (profileButton) {
    profileButton.addEventListener('click', () => {
      window.location.href = "profil.html";
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      if (!supabase) await initSupabase();
      await supabase.auth.signOut();
      window.location.href = "login.html";
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  setupUserMenu();
  await initSupabase();

  const avatarImg = document.getElementById('avatar-img');
  const { data: { session } } = await supabase.auth.getSession();

  if (session && session.user && session.user.user_metadata && session.user.user_metadata.avatar_url) {
    avatarImg.src = session.user.user_metadata.avatar_url;
  }
});
