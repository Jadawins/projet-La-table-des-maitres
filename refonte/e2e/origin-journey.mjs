import {expect} from '@playwright/test';
import {classChoiceSpecs} from '../maquette/class-profiles.mjs';
import {classProfile} from '../maquette/character-rules.mjs';
import {originFeats,magicFeatProfile} from '../maquette/origin-rules.mjs';
import {featChoiceSpec} from '../maquette/feat-effects.mjs';
import {selectedLevelFeats} from '../maquette/progression.mjs';
const next=async p=>{await expect(p.locator('#next')).toBeEnabled();await p.locator('#next').click();};
async function fillGrant(page,s,c,grant){
  const selected=s.originGrants[grant.slot];
  for(const id of selected.proficiencies)await page.locator(`[data-grant-slot="${grant.slot}"][data-grant-choice="${id}"]`).check();
  if(magicFeatProfile(s,c,grant)){
    if(!grant.forcedList)await page.locator(`[data-grant-slot="${grant.slot}"][data-grant-field="magicList"]`).selectOption(selected.magicList);
    for(const id of selected.cantrips)await page.locator(`[data-grant-slot="${grant.slot}"][data-origin-cantrip="${id}"]`).check();
    await page.locator(`[data-grant-slot="${grant.slot}"][data-grant-field="spell"]`).selectOption(selected.spell);
  }
}
export async function createOriginThroughUI(page,s,c){
  await page.goto('/atelier/#nouveau');
  await page.locator('#name').fill(s.name);await page.locator('#level').selectOption(String(s.level));await next(page);
  await page.locator(`[data-choice="classId"][data-id="${s.classId}"]`).click();await next(page);
  await page.locator(`[data-choice="speciesId"][data-id="${s.speciesId}"]`).click();
  if(s.variantId)await page.locator(`[data-choice="variantId"][data-id="${s.variantId}"]`).click();
  await page.locator(`[data-choice="backgroundId"][data-id="${s.backgroundId}"]`).click();
  for(const field of ['speciesSize','speciesSkill','speciesAncestry','speciesCastingAbility','backgroundTool']){
    const input=page.locator(`[data-origin-field="${field}"]`);if(s[field]&&await input.count())await input.selectOption(s[field]);
  }
  if(s.speciesId==='humain')await page.locator('[data-origin-field="originFeatId"]').selectOption(s.originFeatId);
  for(const grant of originFeats(s,c).filter(g=>['background','human'].includes(g.slot)))await fillGrant(page,s,c,grant);
  await next(page);
  for(const [id,value]of Object.entries(s.scores))await page.locator(`[data-stat="${id}"]`).fill(String(value));
  await page.locator('[data-bonus-mode="three"]').click();await next(page);
  if(s.divineOrder)await page.locator(`[data-choice="divineOrder"][data-id="${s.divineOrder}"]`).click();
  if(s.level>=3)await page.locator(`[data-choice="subclassId"][data-id="${s.subclassId}"]`).click();
  for(const [n,row]of Object.entries(s.advancements)){
    await page.locator(`[data-advance-level="${n}"][data-advance-mode="${row.mode}"]`).click();
    if(row.mode==='feat'){
      await page.locator(`[data-advance-level="${n}"][data-advance-field="featId"]`).selectOption(row.featId);
      if(row.featAbility)await page.locator(`[data-advance-level="${n}"][data-advance-field="featAbility"]`).selectOption(row.featAbility);
    }
    if(row.mode==='ability'||row.featId==='amelioration_de_caracteristique')for(let i=0;i<2;i++)await page.locator(`[data-advance-level="${n}"][data-advance-point="${i}"]`).selectOption(row.abilities[i]);
  }
  for(const grant of originFeats(s,c).filter(g=>!['background','human'].includes(g.slot)))await fillGrant(page,s,c,grant);
  if(s.sacredStrike)await page.locator(`[data-choice="sacredStrike"][data-id="${s.sacredStrike}"]`).click();
  for(const skill of s.classSkills)await page.locator(`[data-class-skill="${skill}"]`).check();
  for(const spec of classChoiceSpecs(s,c)){
    if(spec.kind)for(const [i,value]of s.classChoices[spec.key].entries())await page.locator(`[data-class-free="${spec.key}"][data-class-index="${i}"]`).fill(value);
    else for(const id of s.classChoices[spec.key])await page.locator(`[data-class-select="${spec.key}"][data-class-value="${id}"]`).check();
  }
  for(const row of selectedLevelFeats(s,c)){
    const spec=featChoiceSpec(s,c,row);if(!spec)continue;
    const value=row.choice.choices[spec.field];
    if(['rituals','resistances'].includes(spec.field))for(const id of value)await page.locator(`[data-feat-${spec.field==='rituals'?'ritual':'resistance'}="${id}"][data-feat-level="${row.level}"]`).check();
    else await page.locator(`[data-feat-choice="${spec.field}"][data-feat-level="${row.level}"]`).selectOption(value);
  }
  await next(page);
  if(classProfile(s,c).hasMagic){
    for(const kind of ['cantrips','prepared'])for(const id of s[kind])await page.locator(`[data-spell-kind="${kind}"][data-spell-id="${id}"]`).check();
    await next(page);
  }
  await page.locator('[data-choice="equipment"][data-id="A"]').click();await next(page);await next(page);
  await expect(page.locator('.sheet-hero h1')).toHaveText(s.name);await expect(page.locator('.sheet-incomplete')).toHaveCount(0);
}
