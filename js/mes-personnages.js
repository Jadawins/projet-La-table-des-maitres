import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://<TON-PROJET>.supabase.co",
  "<PUBLIC-ANON-KEY>"
);

async function chargerPersonnages() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert("Veuillez vous connecter.");
    return;
  }

  const res = await fetch(`/api/characters?userId=${user.id}`);
  const personnages = await res.json();

  const container = document.getElementById("character-list");
  container.innerHTML = "";

  if (!personnages.length) {
    container.innerHTML = "<p>Aucun personnage pour l'instant.</p>";
    return;
  }

  personnages.forEach(p => {
    const card = document.createElement("div");
    card.className = "character-card";
    card.innerHTML = `
      <h3>${p.name || "Sans nom"}</h3>
      <p>Race : ${p.race || "-"}</p>
      <p>Classe : ${p.class || "-"}</p>
      <p>Niveau : ${p.level || "-"}</p>
    `;
    container.appendChild(card);
  });
}

chargerPersonnages();
