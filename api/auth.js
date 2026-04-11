'use strict';
const jwt    = require('jsonwebtoken');
const https  = require('https');
const crypto = require('crypto');

/**
 * Vérification JWT Supabase via JWKS public (ES256).
 * La clé publique est chargée une fois au démarrage depuis l'endpoint JWKS Supabase.
 * Fallback : decode-only avec vérification de l'expiration si JWKS indisponible.
 */

let publicKeys = [];   // tableau de KeyObject (ES256)

function fetchJwks() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return;

  const jwksUrl = supabaseUrl.replace(/\/$/, '') + '/auth/v1/.well-known/jwks.json';

  https.get(jwksUrl, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const { keys } = JSON.parse(data);
        if (!Array.isArray(keys) || !keys.length) return;
        publicKeys = keys.map(k => crypto.createPublicKey({ key: k, format: 'jwk' }));
        console.log(`[auth] JWKS chargé — ${publicKeys.length} clé(s) publique(s) Supabase (ES256)`);
      } catch (e) {
        console.error('[auth] Erreur parsing JWKS:', e.message);
      }
    });
  }).on('error', e => {
    console.error('[auth] Impossible de charger le JWKS:', e.message);
    // Retry after 10s
    setTimeout(fetchJwks, 10000);
  });
}

fetchJwks();

function getUserId(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);

  // Vérification complète avec clé(s) publique(s) JWKS
  if (publicKeys.length > 0) {
    for (const key of publicKeys) {
      try {
        const payload = jwt.verify(token, key, { algorithms: ['ES256', 'RS256'] });
        return payload.sub || null;
      } catch {}
    }
    return null; // Aucune clé n'a validé la signature
  }

  // Fallback si JWKS pas encore chargé : decode-only + contrôle expiration
  try {
    const payload = jwt.decode(token);
    if (!payload) return null;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub || null;
  } catch {
    return null;
  }
}

module.exports = { getUserId };
