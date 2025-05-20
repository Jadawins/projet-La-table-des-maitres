const tabs = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const target = tab.getAttribute('data-target');
    tabContents.forEach(tc => {
      tc.classList.toggle('active', tc.id === target);
    });
  });
});

function toggleSection(checkboxId, sectionId) {
  const checkbox = document.getElementById(checkboxId);
  const section = document.getElementById(sectionId);

  // Initial state
  section.style.display = checkbox.checked ? 'block' : 'none';

  // On change
  checkbox.addEventListener('change', () => {
    section.style.display = checkbox.checked ? 'block' : 'none';
  });
}

// Appliquer pour chaque couple
toggleSection('ability_score_fr', 'bonus_details_fr');
toggleSection('darkvision_fr', 'darkvision_details_fr');
toggleSection('show_weapon_section_fr', 'weapon_section_fr');
toggleSection('ability_score_en', 'bonus_details_en');
toggleSection('darkvision_en', 'darkvision_details_en');

document.getElementById('add_weapon').addEventListener('click', () => {
  const select = document.getElementById('weapon_select');
  if (!select) {
    // Si le menu n'existe pas encore, on le génère
    genererMenuDeroulant();
    return;
  }

  const weaponName = select.value;
  if (weaponName) {
    const weaponList = document.getElementById('weapon_list');

    // Évite les doublons
    const exists = Array.from(weaponList.children).some(
      item => item.dataset.weapon === weaponName
    );
    if (exists) return;

    const item = document.createElement('div');
    item.classList.add('weapon-item');
    item.dataset.weapon = weaponName;
    item.textContent = weaponName;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '❌';
    removeBtn.classList.add('remove-weapon-btn');
    removeBtn.addEventListener('click', () => item.remove());

    item.appendChild(removeBtn);
    weaponList.appendChild(item);
  }
});

let toutesLesArmes = [];

async function chargerArmesDepuisAPI() {
  try {
    const response = await fetch('/api/GetCategories/');
    if (!response.ok) throw new Error('Erreur API');

    const data = await response.json();
    const armes = data.find(d => d.index === "weapon")?.equipment || [];

    toutesLesArmes = armes.map(a => ({
      nom: a.name?.fr || a.name?.en || a.index
    }));

    console.log('✅ Armes chargées depuis la BDD :', toutesLesArmes);
  } catch (err) {
    console.error('❌ Erreur lors du chargement des armes :', err);
  }
}
window.genererMenuDeroulant = function genererMenuDeroulant() {
  const container = document.getElementById('weapon_dropdown_container');
  container.innerHTML = ''; // Vide le conteneur au cas où

  const nomsArmes = toutesLesArmes.map(a => a.nom).sort();

  const select = document.createElement('select');
  select.id = 'weapon_select';
  select.classList.add('dropdown-style');
  select.style.width = 'auto';

  nomsArmes.forEach(nom => {
    const option = document.createElement('option');
    option.value = nom;
    option.textContent = nom;
    select.appendChild(option);
  });

  container.appendChild(select);
}
document.addEventListener("DOMContentLoaded", async function () {
 await chargerArmesDepuisAPI();
  genererMenuDeroulant();
  // Affiche ou régénère le menu déroulant d'armes quand on clique sur le bouton
  document.getElementById('show_weapon_select').addEventListener('click', () => {
  genererMenuDeroulant();
  });
 
  });
 /**
 * Remplace les virgules par des points dans un champ input
 * Utile pour les champs numériques comme la vitesse
 */
  function convertirVirguleEnPoint(id) {
  const input = document.getElementById(id);
  if (input && input.value.includes(',')) {
    input.value = input.value.replace(',', '.');
  }
}
// Gestion du formulaire : correction de la virgule dans les champs vitesse
document.getElementById('raceForm').addEventListener('submit', function (e) {
  e.preventDefault(); // empêche la soumission par défaut

  // 🔁 Corrige les champs "vitesse" avec des virgules
  convertirVirguleEnPoint('speed_fr');
  convertirVirguleEnPoint('speed_en');

  // TODO : ici tu pourras ajouter le code pour envoyer les données à ton API
  console.log('Formulaire prêt à être envoyé avec vitesses corrigées.');
});

/**
 * Récupère les armes sélectionnées par catégorie ET par nom
 * Retourne un objet avec deux tableaux : categories[] et armes[]
 */
function getArmesSelectionnees() {
  // Catégories cochées
  const categories = Array.from(document.querySelectorAll('input[name="catégorie"]:checked'))
    .map(cb => cb.value);

  // Armes précises ajoutées
  const armes = Array.from(document.querySelectorAll('#weapon_list .weapon-item'))
    .map(div => div.dataset.weapon);

  return { categories, armes };
}
// Stocke les bonus ajoutés
const bonusStats = [];

async function chargerCaracteristiques() {
  try {
    const res = await fetch('/api/GetStats');
    if (!res.ok) throw new Error('Erreur API GetStats');
    const stats = await res.json();

    const select = document.getElementById('select_stat');
    select.innerHTML = ''; // Vide d’abord

    stats.forEach(stat => {
      const option = document.createElement('option');
      option.value = stat.index;
      option.textContent = stat.name.toUpperCase();
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Erreur chargement caractéristiques:', err);
  }
}

function ajouterBonusStat(index, name, value) {
  // Empêche les doublons
  const alreadyExists = bonusStats.some(item => item.index === index);
  if (alreadyExists) return;

  const statList = document.getElementById('stat_bonus_list');

  const div = document.createElement('div');
  div.className = 'stat-item';
  div.dataset.stat = index;

  const span = document.createElement('span');
  span.textContent = `${name.toUpperCase()} +${value}`;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.className = 'remove-stat-btn';
  btn.onclick = () => {
    div.remove();
    const i = bonusStats.findIndex(s => s.index === index);
    if (i !== -1) bonusStats.splice(i, 1);
  };

  div.appendChild(span);
  div.appendChild(btn);
  statList.appendChild(div);

  bonusStats.push({ index, value });
}

document.getElementById('add_stat_bonus').addEventListener('click', async () => {
  const value = parseInt(document.getElementById('stat_bonus_value').value);
  if (isNaN(value) || value < 1) return;

  const applyToAll = document.getElementById('apply_to_all_stats').checked;

  const select = document.getElementById('select_stat');
  const selectedIndex = select.value;
  const selectedText = select.options[select.selectedIndex].text;

  if (applyToAll) {
    const allOptions = Array.from(select.options);
    allOptions.forEach(opt => {
      ajouterBonusStat(opt.value, opt.textContent, value);
    });
  } else {
    ajouterBonusStat(selectedIndex, selectedText, value);
  }
});

// Charger automatiquement les caractéristiques au chargement de la page
document.addEventListener("DOMContentLoaded", async function () {
  await chargerCaracteristiques();
});
document.addEventListener("DOMContentLoaded", async function () {
  await chargerCaracteristiques();

  // 👇 Cacher/afficher le select selon état de la checkbox
  const applyCheckbox = document.getElementById('apply_to_all_stats');
  const selectStat = document.getElementById('select_stat_group');

  applyCheckbox.addEventListener('change', () => {
    selectStat.style.display = applyCheckbox.checked ? 'none' : 'block';
  });
});

window.toutesLesArmes = toutesLesArmes;