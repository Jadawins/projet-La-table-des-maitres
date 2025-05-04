import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

let supabase;

async function initSupabase() {
  const res = await fetch("https://lampion-api.azurewebsites.net/api/GetSupabaseKey");
  const { url, key } = await res.json();
  supabase = createClient(url, key);
}

function setupTabSwitching() {
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Activer le bouton cliqué
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Afficher le contenu correspondant
      const target = tab.getAttribute("data-tab");
      contents.forEach((section) => {
        section.style.display = section.id === target ? "block" : "none";
      });
    });
  });
}

// Fonction appelée après chargement DOM
document.addEventListener("DOMContentLoaded", async () => {
  await initSupabase();
  await afficherInfosPerso();
  setupTabSwitching();

  const { data: { session } } = await supabase.auth.getSession();
  const provider = session?.user?.app_metadata?.provider;

  if (provider !== "email") {
    // Cacher l'onglet mot de passe
    const tabBtn = document.querySelector('[data-tab="password"]');
    if (tabBtn) tabBtn.style.display = "none";

    const tabContent = document.getElementById("password");
    if (tabContent) tabContent.style.display = "none";

    // Ajouter un message d'info
    const infoDiv = document.getElementById("infos");
    const notice = document.createElement("p");
    notice.textContent = "🔒 Le changement de mot de passe n'est pas disponible avec votre méthode de connexion.";
    notice.style.fontStyle = "italic";
    notice.style.marginTop = "1rem";
    infoDiv.appendChild(notice);
  }

  const saveBtn = document.getElementById("save-pseudo");
  if (saveBtn) {
    saveBtn.addEventListener("click", enregistrerPseudoEtDiscord);
  }

  const changePwdBtn = document.getElementById("change-password");
  if (changePwdBtn) {
    changePwdBtn.addEventListener("click", async () => {
      const oldPwd = document.getElementById("old-password").value;
      const newPwd = document.getElementById("new-password").value;
      const confirmPwd = document.getElementById("confirm-password").value;

      if (newPwd !== confirmPwd) {
        alert("Les mots de passe ne correspondent pas.");
        return;
      }

      if (newPwd.length < 6) {
        alert("Le mot de passe doit contenir au moins 6 caractères.");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: oldPwd
        });

        if (loginError) {
          alert("Ancien mot de passe incorrect.");
          return;
        }

        const { error } = await supabase.auth.updateUser({
          password: newPwd
        });

        if (error) {
          alert("Erreur lors du changement de mot de passe.");
        } else {
          alert("Mot de passe mis à jour avec succès !");
          document.getElementById("old-password").value = "";
          document.getElementById("new-password").value = "";
          document.getElementById("confirm-password").value = "";
        }
      } catch (err) {
        alert("Une erreur est survenue.");
      }
    });
  }
  const logoutBtn = document.getElementById("logout-button");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html"; // redirection après déconnexion
  });
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
