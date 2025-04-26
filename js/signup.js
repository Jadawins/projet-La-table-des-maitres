const { key, url } = await fetch("https://lampion-api.azurewebsites.net/api/GetSupabaseKey")
  .then(res => res.json());

const supabase = createClient(url, key);
function signInWithProvider(provider) {
  supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: "https://nice-island-0a49c7f03.6.azurestaticapps.net/home.html"
    }
  });
}
window.signInWithProvider = signInWithProvider;

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signup-form');
  
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
              username: username
            }
          }
        });
  
        if (error) {
          alert("Erreur : " + error.message);
        } else {
          alert("Inscription réussie ! Vérifie ton email pour confirmer ton compte.");
        }
      });
    }
  });
 