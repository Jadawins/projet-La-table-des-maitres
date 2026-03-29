// Corrections step sorts (étape 9) :
// 1. updateNav : exclure step 9 du reset btn-next (comme step 5)
// 2. _updateBtnSuivant8 → renommer en _updateBtnSuivant9 + corriger step check
// 3. Supprimer dead code getNombreMineurs + getNombreNiv1
const fs   = require('fs');
const path = require('path');
const file = path.join(__dirname, '../js/creer-personnage.js');
let c = fs.readFileSync(file, 'utf8');

// ── 1. updateNav : reset btn-next uniquement si pas step 5 NI step 9 ────────
const OLD_NAV = `  // Reset btn-next state (step 5 may have disabled it)
  if (W.step !== 5) {
    next.disabled = false;
    next.style.opacity = '';
    next.style.cursor = '';
  }`;
const NEW_NAV = `  // Reset btn-next state (step 5 et 9 gèrent leur propre verrouillage)
  if (W.step !== 5 && W.step !== 9) {
    next.disabled = false;
    next.style.opacity = '';
    next.style.cursor = '';
  }`;
if (c.indexOf(OLD_NAV) === -1) { console.error('updateNav marker not found'); process.exit(1); }
c = c.replace(OLD_NAV, NEW_NAV);

// ── 2. Renommer _updateBtnSuivant8 → _updateBtnSuivant9 partout ─────────────
c = c.replaceAll('_updateBtnSuivant8', '_updateBtnSuivant9');

// ── 3. Corriger le check W.step !== 8 → W.step !== 9 ────────────────────────
const OLD_STEP = `function _updateBtnSuivant9() {
  if (W.step !== 8) return;`;
const NEW_STEP = `function _updateBtnSuivant9() {
  if (W.step !== 9) return;`;
if (c.indexOf(OLD_STEP) === -1) { console.error('_updateBtnSuivant9 step check not found'); process.exit(1); }
c = c.replace(OLD_STEP, NEW_STEP);

// ── 4. Supprimer dead code getNombreMineurs + getNombreNiv1 ──────────────────
const DEAD_START = 'function getNombreMineurs(classeId, niveau) {';
const DEAD_END   = '\n// \u2500\u2500\u2500 BARRE DE PROGRESSION';
const idxA = c.indexOf(DEAD_START);
const idxB = c.indexOf(DEAD_END);
if (idxA === -1 || idxB === -1 || idxA >= idxB) { console.error('Dead code markers not found'); process.exit(1); }
c = c.slice(0, idxA) + c.slice(idxB + 1); // +1 pour le \n

fs.writeFileSync(file, c, 'utf8');
console.log('Done - sorts step 9 fixes applied');
