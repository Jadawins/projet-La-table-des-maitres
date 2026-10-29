export const CURRENT_RULES_VERSION='phb2024-2026-10-28';

export function usesCurrentRules(character,version=CURRENT_RULES_VERSION){
  return character?.rulesVersion===version;
}

// Only an explicit user action calls this function. Keep the source character intact.
export function upgradedCharacterCopy(character,newId,version=CURRENT_RULES_VERSION){
  if(typeof newId!=='string'||!newId||newId===character.cloudId)throw new Error('Une nouvelle copie est nécessaire.');
  const copy={...structuredClone(character),rulesVersion:version,cloudId:newId,cloudRevision:0,cloudUpdatedAt:'',cloudSnapshot:'',step:0};
  const canonical=id=>id==='couronne_de_folie'?'couronne_du_dement':id;
  for(const key of ['cantrips','prepared'])if(Array.isArray(copy[key]))copy[key]=[...new Set(copy[key].map(canonical))];
  for(const values of Object.values(copy.classChoices||{}))if(Array.isArray(values))for(let i=0;i<values.length;i++)values[i]=canonical(values[i]);
  for(const grant of Object.values(copy.originGrants||{}))if(grant?.spell)grant.spell=canonical(grant.spell);
  for(const row of Object.values(copy.advancements||{})){if(row.choices?.spell)row.choices.spell=canonical(row.choices.spell);if(row.choices?.rituals)row.choices.rituals=row.choices.rituals.map(canonical);}
  return copy;
}
