// profil.js

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

let supabase;

async function initSupabase() {
  try {
    const response = await fetch('https://lampion-api.azurewebsites.net/api/GetSupabaseKey');
    const { url, key } = await response.json();
    supabase = createClient(url, key);
    console.log("Supabase connecté !");
  } catch (error) {
    console.error("Erreur connexion Supabase:", error);
  }
}

async function loadUserInfo() {
  const { data: { session } } = await supabase.auth.getSession();
  const usernameInput = document.getElementById('username');
  const emailDisplay = document.getElementById('email-display');
  const profileAvatar = document.getElementById('profile-avatar');

  if (session && session.user) {
    const { user_metadata, email } = session.user;

    usernameInput.value = user_metadata.username || "";
    emailDisplay.textContent = `Email : ${email}`;

    if (user_metadata.avatar_url) {
      profileAvatar.src = user_metadata.avatar_url;
    }
  }
}

async function saveUsername() {
  const usernameInput = document.getElementById('username');
  const newUsername = usernameInput.value.trim();

  if (newUsername.length === 0) {
    alert("Le pseudo ne peut pas être vide.");
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    const { error } = await supabase.auth.updateUser({
      data: { username: newUsername }
    });

    if (error) {
      alert("Erreur lors de la sauvegarde du pseudo : " + error.message);
    } else {
      alert("Pseudo sauvegardé avec succès !");
    }
  }
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

function setupButtons() {
  document.getElementById('save-button').addEventListener('click', saveUsername);
  document.getElementById('logout-button').addEventListener('click', logout);
  document.getElementById('back-button').addEventListener('click', () => {
    window.location.href = 'home.html';
  });
}

// Initialisation

initSupabase().then(() => {
  loadUserInfo();
  setupButtons();
});
