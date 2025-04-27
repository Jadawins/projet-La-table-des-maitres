import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

async function initSupabase() {
  const response = await fetch("https://lampion-api.azurewebsites.net/api/GetSupabaseKey");
  const result = await response.json();
  supabase = createClient(result.url, result.key);
}

document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
  } else {
    // 1. Charger l'avatar
    const user = session.user;
    const avatarUrl = user.user_metadata?.avatar_url || 'assets/img/default-avatar.png';
    document.getElementById('avatar-img').src = avatarUrl;
  }

  // 2. Ouvrir/fermer le menu
  document.getElementById('avatar-button').addEventListener('click', () => {
    document.getElementById('user-menu').classList.toggle('hidden');
  });

  // 3. Déconnexion
  document.getElementById('logout-button').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
});
