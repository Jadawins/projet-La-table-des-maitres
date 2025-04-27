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
    // Si pas connecté ➔ redirection vers login
    window.location.href = "login.html";
  } else {
    console.log("Connecté !"); // Pour test
  }
});
