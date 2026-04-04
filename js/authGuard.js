// js/authGuard.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

async function _initAuth() {
  const response = await fetch("https://myrpgtable.fr/api/GetSupabaseKey");
  const result = await response.json();
  const supabase = createClient(result.url, result.key);

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
  } else {
    window.SUPABASE_TOKEN = session.access_token;
    if (session.user) {
      window.USER_ID = session.user.id;
      localStorage.setItem('userId', session.user.id);
    }
    window.dispatchEvent(new Event('supabase-ready'));
  }

  return supabase;
}

// Auto-exécution dès le chargement du module
const _supabasePromise = _initAuth();

export async function checkSession() {
  return _supabasePromise;
}
