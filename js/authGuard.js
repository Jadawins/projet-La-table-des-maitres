// js/authGuard.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export async function checkSession() {
  const response = await fetch("https://myrpgtable.fr/api/GetSupabaseKey");
  const result = await response.json();
  const supabase = createClient(result.url, result.key);

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
  }

  return supabase;
}
