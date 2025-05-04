import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

async function init() {
  console.log("Requête envoyée...");
  const { key, url } = await fetch("https://lampion-api.azurewebsites.net/api/GetSupabaseKey")
    .then(res => res.json());
  console.log("Résultat de l’API :", { url, key });

  supabase = createClient(url, key);
}

function signInWithProvider(provider) {
  supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: "https://nice-island-0a49c7f03.6.azurestaticapps.net/home.html"
    }
  });
}
window.signInWithProvider = signInWithProvider;

document.addEventListener('DOMContentLoaded', async () => {
  await init(); // 👈 important

  const form = document.getElementById('signup-form');
  console.log("Form:", form);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = form.querySelector('input[name="username"]').value;
      const email = form.querySelector('input[name="email"]').value;
      const password = form.querySelector('input[name="password"]').value;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username
          }
        }
      });
      console.log("Résultat Supabase :", data, error);

      if (error) {
        alert("Erreur : " + error.message);
      } else {
        alert("Inscription réussie ! Vérifie ton email pour confirmer ton compte.");
      }
    });
  }
});
