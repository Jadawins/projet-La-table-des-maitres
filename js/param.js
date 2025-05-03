import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

let supabase;

async function initSupabase() {
  const res = await fetch("https://lampion-api.azurewebsites.net/api/GetSupabaseKey");
  const { url, key } = await res.json();
  supabase = createClient(url, key);
}

// Fonction appelée après chargement DOM
document.addEventListener("DOMContentLoaded", async () => {
    await initSupabase();
    await afficherInfosPerso();
    setupTabSwitching(); // <== ✅ C'est ça qui manquait !
    loadAvatar();
  
    const uploadBtn = document.getElementById("upload-avatar");
    if (uploadBtn) {
      uploadBtn.addEventListener("click", uploadAvatar);
    }
  
    const saveBtn = document.getElementById("save-pseudo");
    if (saveBtn) {
      saveBtn.addEventListener("click", enregistrerPseudoEtDiscord);
    }
  });

// Afficher les infos existantes
async function afficherInfosPerso() {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) return;

  document.getElementById("email").value = user.email;
  document.getElementById("pseudo").value = user.user_metadata?.pseudo || "";
  document.getElementById("discord").value = user.user_metadata?.discord || "";
}

// Sauvegarder le pseudo + discord
async function enregistrerPseudoEtDiscord() {
  const pseudo = document.getElementById("pseudo").value;
  const discord = document.getElementById("discord").value;

  const { error } = await supabase.auth.updateUser({
    data: { pseudo, discord }
  });

  if (error) {
    alert("Erreur lors de l'enregistrement.");
  } else {
    alert("Informations mises à jour !");
  }
}

  async function loadAvatar() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
  
    if (user?.user_metadata?.avatar_url) {
      document.querySelectorAll('#avatar-img').forEach(img => {
        img.src = user.user_metadata.avatar_url;
      });
    }
  }
  
  async function uploadAvatar() {
    const fileInput = document.getElementById('avatar-input');
    const file = fileInput.files[0];
    if (!file) return alert("Sélectionne un fichier d'abord.");
  
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
  
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}.${fileExt}`; // sans "avatars/"
  
    // Upload dans Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });
  
    if (uploadError) return alert("Erreur d’upload : " + uploadError.message);
  
    // Récupérer l'URL publique
    const { data: { publicUrl } } = supabase
      .storage
      .from('avatars')
      .getPublicUrl(filePath);
  
    // Mise à jour du profil utilisateur
    const { error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl }
    });
  
    if (updateError) return alert("Erreur mise à jour profil : " + updateError.message);
  
    // Met à jour les images affichées
    document.querySelectorAll('#avatar-img').forEach(img => {
      img.src = publicUrl;
    });
  
    alert("Avatar mis à jour avec succès !");
  };
function setupTabSwitching() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.style.display = "none");

      button.classList.add("active");
      const target = button.getAttribute("data-tab");
      document.getElementById(target).style.display = "block";
    });
  });
}