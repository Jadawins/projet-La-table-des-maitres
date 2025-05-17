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
  const weaponName = document.getElementById('weapon_name').value.trim();
  if (weaponName) {
    const weaponList = document.getElementById('weapon_list');
    const item = document.createElement('div');
    item.textContent = weaponName;
    weaponList.appendChild(item);
    document.getElementById('weapon_name').value = '';
  }
});
