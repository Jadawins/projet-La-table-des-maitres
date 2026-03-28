// Corrige renderBgBonusInputs, applyBgBonus2plus1 et bgBonusIsValid
// pour se conformer à PHB 2024 : mode +2/+1 fixé aux 2 stats du background
const fs   = require('fs');
const path = require('path');
const file = path.join(__dirname, '../js/creer-personnage.js');
let c = fs.readFileSync(file, 'utf8');

// ── 1. Remplacer renderBgBonusInputs + applyBgBonus2plus1 ─────
// On remplace le bloc : de "function renderBgBonusInputs" jusqu'à juste avant "function applyBgBonus3fois1"
const A = c.indexOf('function renderBgBonusInputs()');
const B = c.indexOf('function applyBgBonus3fois1(');
if (A === -1 || B === -1) { console.error('Markers A/B not found'); process.exit(1); }

const newBlock = `function renderBgBonusInputs() {
  const el = document.getElementById('bg-bonus-inputs');
  if (!el) return;
  const sug = W.bg_data?.bonus_caracteristiques?.suggerees || [];
  const [s0, s1] = sug;

  if (W.bg_bonus_mode === '2plus1') {
    // PHB 2024 : +2/+1 fixé aux 2 caracs du background, joueur choisit seulement l'ordre
    if (!s0 || !s1) {
      el.innerHTML = '<div style="font-size:0.78rem;color:#f87171;">Donn\\u00e9es manquantes pour ce background.</div>';
      return;
    }
    el.innerHTML =
      '<div style="font-size:0.78rem;color:#aaa;margin-bottom:0.6rem;">R\\u00e9partissez entre ' +
      '<strong style="color:#e0e0e0;">' + s0 + '</strong> et <strong style="color:#e0e0e0;">' + s1 + '</strong>\\u00a0:</div>' +
      '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
        '<label class="bg-bonus-radio-row">' +
          '<input type="radio" name="bg-bonus-order" value="A" onchange="applyBgBonus2plus1(\'A\')" />' +
          '<span class="bg-bonus-radio-label">' +
            '<span class="bg-bonus-tag bg-bonus-tag-2">+2</span>\\u00a0' + s0 +
            '\\u00a0\\u00b7\\u00a0<span class="bg-bonus-tag bg-bonus-tag-1">+1</span>\\u00a0' + s1 +
          '</span>' +
        '</label>' +
        '<label class="bg-bonus-radio-row">' +
          '<input type="radio" name="bg-bonus-order" value="B" onchange="applyBgBonus2plus1(\'B\')" />' +
          '<span class="bg-bonus-radio-label">' +
            '<span class="bg-bonus-tag bg-bonus-tag-1">+1</span>\\u00a0' + s0 +
            '\\u00a0\\u00b7\\u00a0<span class="bg-bonus-tag bg-bonus-tag-2">+2</span>\\u00a0' + s1 +
          '</span>' +
        '</label>' +
      '</div>';
  } else if (W.bg_bonus_mode === '3fois1') {
    const opts = STAT_KEYS.map(k => '<option value="' + k + '">' + k + '</option>').join('');
    el.innerHTML =
      '<div style="font-size:0.78rem;color:#aaa;margin-bottom:0.5rem;">Choisissez 3 caract\\u00e9ristiques diff\\u00e9rentes (+1 chacune).</div>' +
      '<div style="display:flex;gap:0.75rem;flex-wrap:wrap;">' +
      [0,1,2].map(i =>
        '<div>' +
          '<div style="font-size:0.72rem;color:#c9a84c;margin-bottom:0.25rem;">+1 \\u00e0 :</div>' +
          '<select class="bg-bonus-select" id="bg-sel-3-' + i + '" onchange="applyBgBonus3fois1()">' +
            '<option value="">\\u2014 choisir \\u2014</option>' + opts +
          '</select>' +
        '</div>'
      ).join('') +
      '</div>';
  }
}

function applyBgBonus2plus1(order) {
  const sug = W.bg_data?.bonus_caracteristiques?.suggerees || [];
  const [s0, s1] = sug;
  if (!s0 || !s1) return;
  W.bg_bonus = { FOR:0, DEX:0, CON:0, INT:0, SAG:0, CHA:0 };
  if (order === 'A') { W.bg_bonus[s0] = 2; W.bg_bonus[s1] = 1; }
  else               { W.bg_bonus[s0] = 1; W.bg_bonus[s1] = 2; }
  renderBgBonusPreview();
}

`;

c = c.slice(0, A) + newBlock + c.slice(B);

// ── 2. Remplacer bgBonusIsValid ───────────────────────────────
const V1 = c.indexOf('function bgBonusIsValid()');
const V2 = c.indexOf('\nfunction renderBgBonusPreview');
if (V1 === -1 || V2 === -1) { console.error('bgBonusIsValid markers not found'); process.exit(1); }

const newValid = `function bgBonusIsValid() {
  if (!W.bg_bonus_mode) return false;
  const total = Object.values(W.bg_bonus).reduce((s, v) => s + v, 0);
  if (W.bg_bonus_mode === '2plus1') {
    return total === 3 && Object.values(W.bg_bonus).some(v => v === 2);
  }
  if (W.bg_bonus_mode === '3fois1') {
    return Object.values(W.bg_bonus).filter(v => v > 0).length === 3 && total === 3;
  }
  return false;
}
`;

c = c.slice(0, V1) + newValid + c.slice(V2);

fs.writeFileSync(file, c, 'utf8');
console.log('Done - functions replaced successfully');
