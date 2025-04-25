import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://gdjkaxiyztxkmymlzedg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkamtheGl5enR4a215bWx6ZWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1ODUxNTgsImV4cCI6MjA2MTE2MTE1OH0.HiGSgug1FAARinC2R8-Obtj1myx2s4ab1KO2Td171SY'
);

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
  function signInWithProvider(provider) {
    supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: "https://nice-island-0a49c7f03.6.azurestaticapps.net/home.html"
      }
    });
  }
  window.signInWithProvider = signInWithProvider;