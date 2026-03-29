// Ajoute la gestion des lanceurs via sous-classe (Chevalier occulte, Arnaqueur arcanique)
// - getCasterKey() retourne W.classe ou W.sous_classe selon qui est le lanceur
// - isCaster() verifie aussi W.sc_data
// - Toutes les references W.classe dans le contexte magie -> getCasterKey()
// - getCaracIncantation() verifie aussi la sous-classe
const fs   = require('fs');
const path = require('path');
const file = path.join(__dirname, '../js/creer-personnage.js');
let c = fs.readFileSync(file, 'utf8');

// ── 1. Remplacer isCaster + getCaracIncantation ──────────────────────────────
const OLD_CASTER = `function isCaster(classeData) {
  return !!(classeData?.incantation);
}

function getCaracIncantation(classeData) {
  return classeData?.caracteristique_incantation || null;
}`;

const NEW_CASTER = `function isCaster(classeData, scData) {
  return !!(classeData?.incantation || scData?.incantation);
}

function getCaracIncantation(classeData, scData) {
  return classeData?.caracteristique_incantation || scData?.caracteristique_incantation || null;
}

// Retourne la cle a utiliser pour les tables de magie (classe ou sous-classe)
function getCasterKey() {
  if (W.classe_data?.incantation) return W.classe;
  if (W.sc_data?.incantation)     return W.sous_classe;
  return W.classe;
}`;

if (c.indexOf(OLD_CASTER) === -1) { console.error('isCaster block not found'); process.exit(1); }
c = c.replace(OLD_CASTER, NEW_CASTER);

// ── 2. Dans loadSorts : isCaster(W.classe_data) -> isCaster(W.classe_data, W.sc_data) ──
c = c.replaceAll('isCaster(W.classe_data)', 'isCaster(W.classe_data, W.sc_data)');
// renderClassesGrid utilise isCaster(c) - laisser tel quel (c = classeData dans le map)

// ── 3. Dans loadSorts/render : W.classe (magie context) -> getCasterKey() ─────
// On cible les occurrences dans le contexte magie uniquement
// Les patterns specifiques :
const replacements = [
  // MAGIE_CANTRIPS[W.classe]
  ['(MAGIE_CANTRIPS[W.classe] !== undefined) ? getNbCantrips(W.classe,', '(MAGIE_CANTRIPS[getCasterKey()] !== undefined) ? getNbCantrips(getCasterKey(),'],
  // getNbCantrips(W.classe, W.niveau)
  ['getNbCantrips(W.classe, W.niveau)', 'getNbCantrips(getCasterKey(), W.niveau)'],
  // getNiveauxSortsDisponibles(W.classe, W.niveau)
  ['getNiveauxSortsDisponibles(W.classe, W.niveau)', 'getNiveauxSortsDisponibles(getCasterKey(), W.niveau)'],
  // MAGIE_MODE[W.classe]
  ["MAGIE_MODE[W.classe] || ''", "MAGIE_MODE[getCasterKey()] || ''"],
  ["MAGIE_MODE[W.classe];", "MAGIE_MODE[getCasterKey()];"],
  // getNbSortsConnus(W.classe, W.niveau)
  ['getNbSortsConnus(W.classe, W.niveau)', 'getNbSortsConnus(getCasterKey(), W.niveau)'],
  // getNbSortsPrepares(W.classe, W.niveau, W.stats)
  ['getNbSortsPrepares(W.classe, W.niveau, W.stats)', 'getNbSortsPrepares(getCasterKey(), W.niveau, finalStats())'],
];

for (const [oldStr, newStr] of replacements) {
  const count = (c.split(oldStr).length - 1);
  if (count === 0) { console.warn(`Warning: "${oldStr}" not found`); continue; }
  c = c.replaceAll(oldStr, newStr);
  console.log(`Replaced ${count}x: ${oldStr.slice(0,50)}...`);
}

// ── 4. Mettre a jour le sous-titre sorts pour afficher la carac de la sous-classe ──
const OLD_CARKEY = `const carKey = W.classe_data?.caracteristique_incantation || 'INT';`;
const NEW_CARKEY = `const carKey = getCaracIncantation(W.classe_data, W.sc_data) || 'INT';`;
if (c.indexOf(OLD_CARKEY) === -1) { console.warn('carKey not found'); }
else { c = c.replace(OLD_CARKEY, NEW_CARKEY); console.log('Replaced carKey'); }

// ── 5. Filtre sorts par classe pour lanceurs tiers : utiliser filtre_sorts_classe ──
// Dans _renderListeNiveau, le filtre compare s.classes au nom de la classe
// Pour les lanceurs tiers, les sorts viennent d'une autre classe (ex: magicien)
// Remplacer nomClasse dans le filtre pour qu'il utilise sc_data.filtre_sorts_classe si dispo
const OLD_FILTER = `  const nomClasse = W.classe_data?.nom || '';`;
const NEW_FILTER = `  // Pour les lanceurs tiers (sous-classe), les sorts viennent d'une autre classe
  const _filtreSortsClasse = W.sc_data?.filtre_sorts_classe;
  const nomClasse = _filtreSortsClasse
    ? (_filtreSortsClasse.charAt(0).toUpperCase() + _filtreSortsClasse.slice(1))
    : (W.classe_data?.nom || '');`;
// Ce pattern apparait dans plusieurs fonctions, on cible _renderSortsStep8 et _renderListeNiveau
// On utilise replaceAll mais le contexte est suffisamment unique
const occurrences = (c.split(OLD_FILTER).length - 1);
if (occurrences === 0) { console.warn('nomClasse filter not found'); }
else { c = c.replaceAll(OLD_FILTER, NEW_FILTER); console.log(`Replaced ${occurrences}x nomClasse filter`); }

fs.writeFileSync(file, c, 'utf8');
console.log('Done - sous-classe caster implemented');
