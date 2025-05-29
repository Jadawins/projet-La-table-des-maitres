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

  if (!checkbox || !section) return;

  // Applique l'état correct au chargement
  const appliquerToggle = () => {
    section.style.display = checkbox.checked ? 'block' : 'none';
  };

  appliquerToggle(); // dès le chargement

  // Mets à jour dynamiquement quand l'utilisateur coche/décoche
  checkbox.addEventListener('change', appliquerToggle);
}

// Appliquer pour chaque couple
toggleSection('ability_score_fr', 'bonus_details_fr');
toggleSection('darkvision_fr', 'darkvision_details_fr');
toggleSection('show_weapon_section_fr', 'weapon_section_fr');
toggleSection('show_armor_section_fr', 'armor_section_fr');
toggleSection('show_damage_type_select_fr', 'damage_type_section_fr');
toggleSection('show_tools_section_fr', 'tools_section_fr');
toggleSection('show_languages_section_fr', 'languages_section_fr');
toggleSection('show_skills_section_fr', 'skills_section_fr');
toggleSection('fixed_skills_fr', 'fixed_skills_block_fr');
toggleSection('restrict_skill_choice_fr', 'restricted_skills_config_fr');
toggleSection('show_rp_traits_fr', 'rp_traits_section_fr');
toggleSection('show_condition_mastery_fr', 'condition_mastery_section_fr');
toggleSection('allow_language_choice_fr', 'language_choice_count_container_fr');
toggleSection('allow_skill_choice_fr', 'skill_choice_count_container_fr');
toggleSection('show_save_adv_magic_fr', 'save_adv_magic_section_fr');
toggleSection('show_racial_spells_fr', 'racial_spells_section_fr');
toggleSection('show_custom_traits_fr', 'custom_traits_section_fr');
toggleSection('ability_score_en', 'bonus_details_en');
toggleSection('darkvision_en', 'darkvision_details_en');



document.getElementById('add_rp_trait_fr').addEventListener('click', () => {
  const name = document.getElementById('rp_trait_name_fr').value.trim();
  const desc = document.getElementById('rp_trait_desc_fr').value.trim();
  const list = document.getElementById('rp_traits_list_fr');

  if (!name || !desc) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.traitName = name;
  item.dataset.traitDesc = desc;
  item.textContent = `${name} : ${desc}`;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.classList.add('remove-weapon-btn');
  btn.addEventListener('click', () => item.remove());

  item.appendChild(btn);
  list.appendChild(item);

  // reset les champs
  document.getElementById('rp_trait_name_fr').value = '';
  document.getElementById('rp_trait_desc_fr').value = '';
});

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
let toutesLesArmures = [];
const bonusArmures = [];
let allDamageTypes = [];
const damageTraits = [];
let tousLesOutils = [];
let toutesLesLangues = [];
let toutesLesCompetences = [];
let toutesLesConditions = [];

async function chargerSortsRaciauxDepuisAPI() {
  try {
    const response = await fetch('/api/GetSpells2014');
    if (!response.ok) throw new Error('Erreur lors du chargement des sorts raciaux');

    const sorts = await response.json();
    chargerSortsPourSortsRaciaux(sorts);
  } catch (err) {
    console.error('❌ Erreur API sorts raciaux :', err);
  }
}

function chargerSortsPourSortsRaciaux(sorts) {
  const datalist = document.getElementById('racial_spell_list_fr');
  datalist.innerHTML = '';

  const noms = sorts
    .map(s => s.name?.fr || s.name?.en)
    .filter(Boolean)
    .sort();

  noms.forEach(nom => {
    const option = document.createElement('option');
    option.value = nom;
    datalist.appendChild(option);
  });
}

async function chargerLanguesDepuisAPI() {
  try {
    const response = await fetch('/api/GetLanguages');
    if (!response.ok) throw new Error('Erreur API langues');
    toutesLesLangues = await response.json();
    console.log('✅ Langues chargées :', toutesLesLangues);
    genererMenuLangues(); // 🟢 même logique que types de dégâts
  } catch (err) {
    console.error('❌ Erreur chargement langues :', err);
  }
}

async function chargerCompetencesDepuisAPI() {
  try {
    const response = await fetch('/api/GetSkills');
    if (!response.ok) throw new Error('Erreur API compétences');
    toutesLesCompetences = await response.json();
    console.log('✅ Compétences chargées :', toutesLesCompetences);
    genererMenuCompetences(); // 🟢 ici aussi
  } catch (err) {
    console.error('❌ Erreur chargement compétences :', err);
  }
}

function genererMenuLangues() {
  const select = document.getElementById('languages_select');
  select.innerHTML = '';

  toutesLesLangues
    .map(l => l.name.fr || l.name.en)
    .sort()
    .forEach(nom => {
      const option = document.createElement('option');
      option.value = nom;
      option.textContent = nom;
      select.appendChild(option);
    });
}


function genererMenuCompetences() {
  const noms = toutesLesCompetences.map(c => c.name.fr || c.name.en).sort();

  const menus = ['skills_select', 'fixed_skills_select_fr', 'restricted_skills_select_fr'];
  menus.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = '';
    noms.forEach(nom => {
      const option = document.createElement('option');
      option.value = nom;
      option.textContent = nom;
      select.appendChild(option);
    });
  });
}


async function chargerOutilsDepuisAPI() {
  try {
    const response = await fetch('/api/GetCategories/');
    if (!response.ok) throw new Error('Erreur API outils');

    const data = await response.json();
    const outils = data.find(d => d.index === "tools")?.equipment || [];

    tousLesOutils = outils.map(o => ({
      nom: o.name?.fr || o.name?.en || o.index
    }));

    console.log('✅ Outils chargés :', tousLesOutils);
  } catch (err) {
    console.error('❌ Erreur lors du chargement des outils :', err);
  }
}

async function chargerTypesDegatsDepuisAPI() {
  try {
    const response = await fetch('/api/GetDamageTypes/');
    if (!response.ok) throw new Error("Erreur lors du chargement des types de dégâts");
    allDamageTypes = await response.json();

    console.log("✅ Types de dégâts chargés :", allDamageTypes);
    genererMenuDegats();
  } catch (err) {
    console.error("❌ Impossible de charger les types de dégâts :", err);
  }
}

function genererMenuDegats() {
  const select = document.getElementById('damage_type_select');
  select.innerHTML = '';

  allDamageTypes.forEach(type => {
    const option = document.createElement('option');
    option.value = type.index;
    option.textContent = type.name?.fr || type.name?.en || type.index;
    select.appendChild(option);
  });
}

async function chargerConditionsDepuisAPI() {
  try {
    const response = await fetch('/api/GetConditions2014');
    if (!response.ok) throw new Error('Erreur API conditions');
    toutesLesConditions = await response.json();
    console.log('✅ Conditions chargées :', toutesLesConditions);
    genererMenuConditions(); // 🟢 comme les dégâts
  } catch (err) {
    console.error('❌ Erreur chargement conditions :', err);
  }
}

function genererMenuConditions() {
  const select = document.getElementById('condition_select_fr');
  select.innerHTML = '';

  toutesLesConditions
    .map(c => c.name.fr || c.name.en)
    .sort()
    .forEach(nom => {
      const option = document.createElement('option');
      option.value = nom;
      option.textContent = nom;
      select.appendChild(option);
    });
}


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
async function chargerArmuresDepuisAPI() {
  try {
    const response = await fetch('/api/GetCategories/');
    if (!response.ok) throw new Error('Erreur API armures');

    const data = await response.json();
    const armures = data.find(d => d.index === "armor")?.equipment || [];

    toutesLesArmures = armures.map(a => ({
      nom: a.name?.fr || a.name?.en || a.index
    }));

    console.log('✅ Armures chargées :', toutesLesArmures);
  } catch (err) {
    console.error('❌ Erreur chargement armures :', err);
  }
}
function genererMenuDeroulantArmures() {
  const container = document.getElementById('armor_dropdown_container');
  container.innerHTML = '';

  const nomsArmures = toutesLesArmures.map(a => a.nom).sort();

  const select = document.createElement('select');
  select.id = 'armor_select';
  select.classList.add('dropdown-style');
  select.style.width = 'auto';

  nomsArmures.forEach(nom => {
    const option = document.createElement('option');
    option.value = nom;
    option.textContent = nom;
    select.appendChild(option);
  });

  container.appendChild(select);
}
document.addEventListener("DOMContentLoaded", async function () {
  // Chargement dynamique
  await chargerArmesDepuisAPI();
  await chargerArmuresDepuisAPI();
  await chargerCaracteristiques();
  await chargerTypesDegatsDepuisAPI();
  await chargerOutilsDepuisAPI();
  await chargerLanguesDepuisAPI();
  await chargerCompetencesDepuisAPI();
  await chargerConditionsDepuisAPI();
  await chargerSortsRaciauxDepuisAPI();

  // Forcer affichage des menus au chargement
  genererMenuDeroulant();
  genererMenuDeroulantArmures();
  genererMenuDeroulantOutils();
  genererMenuLangues();
  genererMenuCompetences();
  genererMenuConditions();

  
  // Cacher le menu déroulant de caractéristiques si "Appliquer à toutes" est coché
  const applyCheckbox = document.getElementById('apply_to_all_stats');
  const selectStat = document.getElementById('select_stat_group');
  applyCheckbox.addEventListener('change', () => {
    selectStat.style.display = applyCheckbox.checked ? 'none' : 'block';
  });
});

document.getElementById('add_armor').addEventListener('click', () => {
  const select = document.getElementById('armor_select');
  if (select) {
    const nom = select.value;
    if (nom) ajouterArmure(nom);
  }
});

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
function ajouterArmure(nom) {
  const armorList = document.getElementById('armor_list');

  const exists = Array.from(armorList.children).some(
    item => item.dataset.armor === nom
  );
  if (exists) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.armor = nom;
  item.textContent = nom;

  const removeBtn = document.createElement('button');
  removeBtn.textContent = '❌';
  removeBtn.classList.add('remove-weapon-btn');
  removeBtn.addEventListener('click', () => item.remove());

  item.appendChild(removeBtn);
  armorList.appendChild(item);

  bonusArmures.push(nom);
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

document.getElementById('add_condition_mastery').addEventListener('click', () => {
  const condition = document.getElementById('condition_select_fr').value;
  const type = document.getElementById('condition_type_fr').value;
  const list = document.getElementById('condition_mastery_list');

  if (!condition || !type) return;

  // Empêche les doublons exacts
  const exists = Array.from(list.children).some(item =>
    item.dataset.condition === condition && item.dataset.type === type
  );
  if (exists) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.condition = condition;
  item.dataset.type = type;

  item.textContent = `${condition} – ${labelConditionTypeFr(type)}`;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.classList.add('remove-weapon-btn');
  btn.addEventListener('click', () => item.remove());

  item.appendChild(btn);
  list.appendChild(item);
});

function labelConditionTypeFr(type) {
  switch (type) {
    case 'advantage': return 'Avantage au jet';
    case 'resistance': return 'Résistance';
    case 'immunity': return 'Immunité';
    default: return type;
  }
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

function genererMenuDeroulantOutils() {
  const container = document.getElementById('tools_dropdown_container');
  container.innerHTML = '';

  const nomsOutils = tousLesOutils.map(o => o.nom).sort();

  const select = document.createElement('select');
  select.id = 'tools_select';
  select.classList.add('dropdown-style');
  select.style.width = 'auto';

  nomsOutils.forEach(nom => {
    const option = document.createElement('option');
    option.value = nom;
    option.textContent = nom;
    select.appendChild(option);
  });

  container.appendChild(select);
}

document.getElementById('add_language').addEventListener('click', () => {
  const select = document.getElementById('languages_select');
  const nom = select?.value;
  if (!nom) return;

  const list = document.getElementById('languages_list');
  const exists = Array.from(list.children).some(item => item.dataset.langue === nom);
  if (exists) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.langue = nom;
  item.textContent = nom;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.classList.add('remove-weapon-btn');
  btn.addEventListener('click', () => item.remove());

  item.appendChild(btn);
  list.appendChild(item);
});

document.getElementById('add_skill').addEventListener('click', () => {
  const select = document.getElementById('skills_select');
  const nom = select?.value;
  if (!nom) return;

  const list = document.getElementById('skills_list');
  const exists = Array.from(list.children).some(item => item.dataset.skill === nom);
  if (exists) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.skill = nom;
  item.textContent = nom;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.classList.add('remove-weapon-btn');
  btn.addEventListener('click', () => item.remove());

  item.appendChild(btn);
  list.appendChild(item);
});

document.getElementById('add_fixed_skill_fr').addEventListener('click', () => {
  const select = document.getElementById('fixed_skills_select_fr');
  const nom = select?.value;
  if (!nom) return;

  const list = document.getElementById('fixed_skills_list_fr');
  const exists = Array.from(list.children).some(item => item.dataset.skill === nom);
  if (exists) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.skill = nom;
  item.textContent = nom;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.classList.add('remove-weapon-btn');
  btn.addEventListener('click', () => item.remove());

  item.appendChild(btn);
  list.appendChild(item);
});

document.getElementById('add_restricted_skill_fr').addEventListener('click', () => {
  const select = document.getElementById('restricted_skills_select_fr');
  const nom = select?.value;
  if (!nom) return;

  const list = document.getElementById('restricted_skills_list_fr');
  const exists = Array.from(list.children).some(item => item.dataset.skill === nom);
  if (exists) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.skill = nom;
  item.textContent = nom;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.classList.add('remove-weapon-btn');
  btn.addEventListener('click', () => item.remove());

  item.appendChild(btn);
  list.appendChild(item);
});
