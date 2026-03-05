import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

async function init() {
  console.log("Requête envoyée...");
  const { key, url } = await fetch("https://myrpgtable.fr/api/GetSupabaseKey")
    .then(res => res.json());
  console.log("Résultat de l’API :", { url, key });

  supabase = createClient(url, key);
}

async function signInWithProvider(provider) {
  try {
    if (!supabase) await init();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: "https://myrpgtable.fr/home.html"
      }
    });
  } catch (err) {
    console.error("Erreur OAuth :", err);
    alert("Erreur de connexion : " + err.message);
  }
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
        window.location.href = "check-email.html";
      }
    });
  }
});
