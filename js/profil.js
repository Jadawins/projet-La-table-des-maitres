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
  const usernameInput = document.getElementById('pseudo');
  const emailDisplay = document.getElementById('email');
  const profileAvatar = document.getElementById('profile-avatar');

  if (session && session.user) {
    const { user_metadata, email } = session.user;

    usernameInput.value = user_metadata.username || "";
    emailDisplay.value = email;

    if (user_metadata.avatar_url) {
      profileAvatar.src = user_metadata.avatar_url;
    }
  }
}

async function saveUsername() {
  const usernameInput = document.getElementById('pseudo');
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
  document.getElementById('save-pseudo').addEventListener('click', saveUsername);
  document.getElementById('logout-button').addEventListener('click', logout);
  document.getElementById('back-button').addEventListener('click', () => {
    window.location.href = 'home.html';
  });
}



// upload-avatar.js 

async function uploadAvatar() {
  const fileInput = document.getElementById("avatar-upload");
  const file = fileInput.files[0];

  if (!file) return alert("Veuillez sélectionner une image.");
  if (!file.type.startsWith("image/")) return alert("Format d'image invalide.");
  if (file.size > 500 * 1024) return alert("Image trop lourde (max 500 Ko).");

  const { data: { user } } = await supabase.auth.getUser();
  const filePath = `avatars/${user.id}/avatar-${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error(uploadError);
    return alert("Échec de l'envoi de l'image.");
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
  const publicUrl = data.publicUrl;

  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_url: publicUrl }
  });

  if (updateError) {
    console.error(updateError);
    return alert("Échec de la mise à jour du profil.");
  }

  // MAJ de l'image sur la page
  document.getElementById("profile-avatar").src = publicUrl;
  alert("Avatar mis à jour avec succès !");
}


document.getElementById("upload-avatar-btn")?.addEventListener("click", uploadAvatar);

// Initialisation

initSupabase().then(() => {
  loadUserInfo();
  setupButtons();
});