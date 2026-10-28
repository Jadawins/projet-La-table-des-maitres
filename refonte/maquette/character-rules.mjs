export const ABILITIES = ['FOR','DEX','CON','INT','SAG','CHA'];
export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const skillKey = value => normalize(value) === 'intuition' ? 'perspicacite' : normalize(value);
export const modifier = value => Number.isFinite(value) ? Math.floor((value - 10) / 2) : null;
export const mainAbility = key => ({STR:'FOR',WIS:'SAG',CHA:'CHA',DEX:'DEX',CON:'CON',INT:'INT',FOR:'FOR',SAG:'SAG'}[String(key).toUpperCase()]);
export function backgroundAbilities(background) {
  return [...new Set((background?.bonus_caracteristiques?.suggerees || []).map(mainAbility).filter(Boolean))];
}
export function backgroundBonuses(state, background) {
  const allowed = backgroundAbilities(background);
  const result = Object.fromEntries(ABILITIES.map(key => [key,0]));
  if (state.bonusMode === 'three' && allowed.length === 3) allowed.forEach(key => result[key] = 1);
  if (state.bonusMode === 'split' && allowed.includes(state.bonusTwo) && allowed.includes(state.bonusOne) && state.bonusTwo !== state.bonusOne) {
    result[state.bonusTwo] = 2; result[state.bonusOne] = 1;
  }
  return result;
}
export function finalScores(state, background, catalogue) {
  const bonuses = backgroundBonuses(state, background);
  const base=Object.fromEntries(ABILITIES.map(key => [key, Number.isInteger(state.scores[key]) ? Math.min(20,state.scores[key] + bonuses[key]) : null]));
  return catalogue?evaluateProgression(state,catalogue,base).scores:base;
}
export function classData(state, catalogue) { return catalogue.classes.find(c => c.id === state.classId); }
export function isCaster(state, catalogue) { return classMagic(state,catalogue).enabled; }
export function visibleSteps(state, catalogue) { return [0,1,2,3,4,...(isCaster(state,catalogue) ? [5] : []),6,7]; }
export function clericProfile(state, catalogue) {
  const cls = classData(state,catalogue);
  if (state.classId !== 'clerc' || !Number.isInteger(state.level) || state.level < 1 || state.level > 20) return null;
  const row = cls?.niveaux?.[state.level];
  if (!row) return null;
  const domain = catalogue.subclasses.find(s => s.id === state.subclassId && s.classe_parente === 'clerc' && s.available && state.level >= 3);
  const spells = catalogue.spells || [];
  const domainRows = domain ? Object.entries(domain.niveaux || {}).filter(([level])=>Number(level)<=state.level).map(([,data])=>data) : [];
  // Alias technique déjà identifié ; le libellé source reste conservé et visible.
  const aliases = {soindesblessures:'soins'};
  const domainSpells = domainRows.flatMap(data=>Object.entries(data.sorts_domaine || {}).flatMap(([rank,names])=>names.map(name=>{
    const spell=spells.find(s=>normalize(s.nom)===normalize(name)||normalize(s.id)===normalize(name)||s.id===aliases[normalize(name)]);
    return spell ? {...spell,sourceName:name} : {id:`unresolved:${domain.id}:${normalize(name)}`,nom:name,niveau:Number(rank),sourceName:name,unresolved:true};
  }))).filter((spell,index,list)=>list.findIndex(s=>s.id===spell.id)===index);
  const always=[...domainSpells,...ritualGrantSpells(state,catalogue)].filter((spell,index,list)=>list.findIndex(s=>s.id===spell.id)===index);
  const domainFeatures=domainRows.flatMap(data=>data.capacites || []);
  const maxSpellLevel = Math.max(0,...Object.entries(row.emplacements_de_sort || {}).filter(([,count]) => count > 0).map(([level]) => Number(level)));
  const clericSpells = spells.filter(s => (s.classes || []).some(name => normalize(name) === 'clerc'));
  const automaticCantrips=domainBenefits(state,catalogue).light?spells.filter(s=>s.id==='lumiere'):[];
  return {
    cantripCount: row.sorts_mineurs + (state.divineOrder === 'Thaumaturge' ? 1 : 0),
    preparedCount: row.sorts_prepares,
    slots: row.emplacements_de_sort || {},
    cantrips: clericSpells.filter(s => s.niveau === 0&&!automaticCantrips.some(a=>a.id===s.id)),
    prepared: clericSpells.filter(s => s.niveau >= 1 && s.niveau <= maxSpellLevel && !always.some(a => a.id === s.id)),
    always,domain,domainFeatures,maxSpellLevel,automaticCantrips,
    proficiency:inheritedCleric(state,catalogue,'bonusMaitrise'),channel:inheritedCleric(state,catalogue,'canal_divin'),sparkDice:inheritedCleric(state,catalogue,'etincelle_divine_des'),
  };
}
export function classProfile(state,c){const p=state.classId==='clerc'?clericProfile(state,c):buildClassProfile(state,c);return p&&state.classId==='clerc'?{...p,castingAbility:'SAG',hasMagic:true}:p;}
export function pruneSpellChoices(state, catalogue) {
  const profile = classProfile(state,catalogue);
  const allowedCantrips = new Set(profile?.cantrips.map(s => s.id) || []);
  const allowedPrepared = new Set(profile?.prepared.map(s => s.id) || []);
  state.cantrips = [...new Set(state.cantrips || [])].filter(id => allowedCantrips.has(id)).slice(0,profile?.cantripCount || 0);
  state.prepared = [...new Set(state.prepared || [])].filter(id => allowedPrepared.has(id)).slice(0,profile?.preparedCount || 0);
}
export function spellErrors(state, catalogue) {
  const profile = classProfile(state,catalogue);
  if (!profile) return [];
  const errors = [];
  for (const [selected, allowed, count, label] of [[state.cantrips,profile.cantrips,profile.cantripCount,'sorts mineurs'],[state.prepared,profile.prepared,profile.preparedCount,'sorts préparés']]) {
    const values = selected || [];
    if (new Set(values).size !== count || values.length !== count || values.some(id => !allowed.some(s => s.id === id))) errors.push(`Choisissez exactement ${count} ${label} disponibles.`);
  }
  for(const name of profile.missingSpells||[])errors.push(`Fiche de sort à relier : ${name}.`);
  if (state.level >= 3 && !profile.domain) errors.push('Choisissez une sous-classe de votre catalogue.');
  return errors;
}
export function classSkills(state,catalogue) {
  const background = catalogue.backgrounds.find(b => b.id === state.backgroundId);
  const automatic = new Set(originSkills(state,catalogue).map(skillKey));
  const data = classData(state,catalogue)?.niveaux?.['0']?.competences_choisies;
  const options=data?.options==='toutes'?catalogue.skills.map(s=>s.nom):data?.options||[];
  return {count:data?.nombre||0,options:options.filter(name=>!automatic.has(skillKey(name))).map(name=>catalogue.skills.find(s=>skillKey(s.nom)===skillKey(name))?.nom||(name==='Intuition'?'Perspicacité':name))};
}
export function hitPoints(state,catalogue) {
  const cls = classData(state,catalogue);
  const die = Number(cls?.niveaux?.['0']?.de_vie?.type?.match(/d(\d+)/)?.[1]);
  const background = catalogue.backgrounds.find(b => b.id === state.backgroundId);
  const con = modifier(finalScores(state,background,catalogue).CON);
  if (!die || con === null) return null;
  let total = Math.max(1,die + con);
  for (let level = 2; level <= state.level; level++) {
    const roll = state.hpMode === 'fixed' ? Math.floor(die/2)+1 : state.hpRolls?.[level];
    if (!Number.isInteger(roll) || roll < 1 || roll > die) return null;
    total += Math.max(1,roll + con);
  }
  return total+originBonuses(state,catalogue).hp+(selectedLevelFeats(state,catalogue).some(r=>r.feat.id==='faveur_de_vigueur')?40:0);
}
export function aptitudeErrors(state,catalogue) {
  if (!classProfile(state,catalogue)) return [];
  const errors = [];
  if (state.classId==='clerc'&&!['Protecteur','Thaumaturge'].includes(state.divineOrder)) errors.push('Choisissez votre vocation divine.');
  if (state.level >= 3 && !classProfile(state,catalogue).domain) errors.push(state.classId==='clerc'?'Choisissez votre domaine.':'Choisissez votre sous-classe.');
  const skills = classSkills(state,catalogue);
  if ((state.classSkills || []).length !== skills.count || new Set((state.classSkills || []).map(skillKey)).size !== skills.count || (state.classSkills || []).some(name => !skills.options.some(allowed => skillKey(name) === skillKey(allowed)))) errors.push(`Choisissez ${skills.count} compétences de classe distinctes.`);
  if (hitPoints(state,catalogue) === null) errors.push('Renseignez les points de vie de chaque niveau.');
  errors.push(...evaluateProgression(state,catalogue,finalScores(state,catalogue.backgrounds.find(b=>b.id===state.backgroundId))).issues);
  errors.push(...originGrantErrors(state,catalogue,originFeats(state,catalogue).filter(g=>g.slot.startsWith('level'))));
  errors.push(...featChoiceErrors(state,catalogue),...classChoiceErrors(state,catalogue));
  const sacred=sacredChoices(state,catalogue);
  if(sacred.length&&!sacred.some(option=>option.nom===state.sacredStrike))errors.push('Choisissez votre option de Frappe consacrée au niveau 7.');
  return errors;
}
import {originSkills,originBonuses,originGrantErrors,originFeats} from './origin-rules.mjs';
import {evaluateProgression,inheritedCleric,domainBenefits,sacredChoices,selectedLevelFeats} from './cleric-progression.mjs';
import {ritualGrantSpells,featChoiceErrors} from './feat-effects.mjs';

import {buildClassProfile,classChoiceErrors} from './class-profiles.mjs';
import {classMagic} from './class-magic.mjs';
