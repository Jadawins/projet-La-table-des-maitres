import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

let supabase; // on prépare une variable globale

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

document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();

  const avatarButton = document.getElementById('avatar-button');
  const userMenu = document.getElementById('user-menu');
  const avatarImg = document.getElementById('avatar-img');

  if (avatarButton && userMenu && avatarImg) {
    console.log("avatarButton et userMenu trouvés !");

    const { data: { session } } = await supabase.auth.getSession();

    if (session && session.user && session.user.user_metadata && session.user.user_metadata.avatar_url) {
      avatarImg.src = session.user.user_metadata.avatar_url;
    }

    avatarButton.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target) && !avatarButton.contains(e.target)) {
        userMenu.classList.remove('active');
      }
    });
  } else {
    console.error("Erreur : avatarButton ou userMenu non trouvés !");
  }
});
