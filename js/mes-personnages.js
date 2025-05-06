document.addEventListener("DOMContentLoaded", async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Utilisateur non identifié.");
      return;
    }
  
    try {
      const res = await fetch(`/api/characters?userId=${userId}`);
      const personnages = await res.json();
  
      const tbody = document.getElementById("character-list");
      tbody.innerHTML = "";
  
      if (personnages.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML = `<td colspan="5">Aucun personnage pour l'instant.</td>`;
        tbody.appendChild(row);
        return;
      }
  
      personnages.forEach(p => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${p.name || "-"}</td>
          <td>${p.race || "-"}</td>
          <td>${p.class || "-"}</td>
          <td>${p.level || "-"}</td>
          <td>
            <button onclick="window.location.href='fiche-personnage.html?id=${p._id}'">👁 Voir</button>
          </td>
        `;
        tbody.appendChild(row);
      });
    } catch (err) {
      console.error("Erreur chargement personnages :", err);
    }
  });
  