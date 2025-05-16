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
const bonusCheckboxFr = document.getElementById('ability_score_fr');
const bonusDetailsFr = document.getElementById('bonus_details_fr');

// Cacher au chargement si la case est décochée
if (!bonusCheckboxFr.checked) {
  bonusDetailsFr.style.display = 'none';
}

// Réagir aux changements
bonusCheckboxFr.addEventListener('change', () => {
  bonusDetailsFr.style.display = bonusCheckboxFr.checked ? 'block' : 'none';
});
