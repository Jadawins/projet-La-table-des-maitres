document.getElementById("login-form").addEventListener("submit", async function (e) {
    e.preventDefault();
  
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
  
    const response = await fetch("https://lampion-api.azurewebsites.net/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });
  
    const result = await response.json();
  
    const messageBox = document.getElementById("login-message");
    if (response.ok) {
      messageBox.textContent = "✅ Connexion réussie";
      localStorage.setItem("userId", result.userId); // Stock l’ID pour la session
      // Rediriger vers une autre page ? Exemple :
      // window.location.href = "choix-personnage.html";
    } else {
      messageBox.textContent = "❌ " + (result.error || "Échec de la connexion");
    }
  });
  