// Langues courantes du SRD 5.2.1 français, section « Choisissez vos langues ».
export const STARTING_LANGUAGES = Object.freeze({
  draconique: 'Draconique',
  elfique: 'Elfique',
  gigant: 'Gigant',
  gnome: 'Gnome',
  gobelin: 'Gobelin',
  halfelin: 'Halfelin',
  signes: 'Langue multiverselle des signes',
  nain: 'Nain',
  orc: 'Orc',
});

export const STARTING_LANGUAGE_COUNT = 2;
export const STARTING_LANGUAGE_PROMPT = 'Choisissez deux langues de départ en plus du commun.';

export function validateStartingLanguages(values) {
  if (!Array.isArray(values) || values.length > STARTING_LANGUAGE_COUNT ||
      values.some(id => typeof id !== 'string' || !Object.hasOwn(STARTING_LANGUAGES, id)) ||
      new Set(values).size !== values.length) {
    throw Object.assign(new Error('Les langues de départ doivent être des langues courantes distinctes.'), {status:400});
  }
  return [...values];
}

export function startingLanguageNames(state) {
  const selected = state.startingLanguages ?? [];
  return ['Commun', ...selected.filter(id => Object.hasOwn(STARTING_LANGUAGES, id)).map(id => STARTING_LANGUAGES[id])];
}

export function knownLanguages(state, model) {
  const names = [
    ...startingLanguageNames(state),
    ...(model.species?.langues ?? []),
    ...(model.background?.langues ?? []),
    ...model.classEffects.languages,
    state.details?.languages,
  ];
  const seen = new Set();
  return names.filter(name => {
    if (typeof name !== 'string' || !name.trim()) return false;
    const key = name.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
