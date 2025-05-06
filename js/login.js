// login.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

async function initSupabase() {
  const response = await fetch("https://lampion-api.azurewebsites.net/api/GetSupabaseKey");
  const result = await response.json();
  supabase = createClient(result.url, result.key);
}

document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();

  const loginForm = document.getElementById('login-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = loginForm.querySelector('input[name="email"]').value;
      const password = loginForm.querySelector('input[name="password"]').value;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        alert("Erreur : " + error.message);
      } else {
        const user = data.user;
        if (user) {
          localStorage.setItem("userId", user.id); // 🔐 Sauvegarde l'UID du joueur
        }
        window.location.href = "home.html";
      }
    });
  }
});

// Fonction pour connexion Google/Discord
async function signInWithProvider(provider) {
  if (!supabase) {
    await initSupabase();
  }
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: "https://nice-island-0a49c7f03.6.azurestaticapps.net/home.html"
    }
  });
}

document.getElementById("reset-password-link").addEventListener("click", async (e) => {
  e.preventDefault();

  const email = prompt("Entrez votre adresse email pour réinitialiser votre mot de passe :");

  if (email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://ton-site.web.app/reset.html" // ou ton URL Azure de redirection
    });

    if (error) {
      alert("Erreur : " + error.message);
    } else {
      alert("Un lien de réinitialisation vous a été envoyé par email.");
    }
  }
});

// Rendre accessible au HTML
window.signInWithProvider = signInWithProvider;
