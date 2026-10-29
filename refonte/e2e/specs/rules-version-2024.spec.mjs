import {readFile} from 'node:fs/promises';
import {test,expect,origin} from '../fixtures.mjs';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture,finishChoices} from '../../audit/origin-fixtures.mjs';
import {createOriginThroughUI} from '../origin-journey.mjs';
import {saveAndLocate} from '../journey.mjs';
import {CURRENT_RULES_VERSION} from '../../maquette/character-version.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));

test('Une ancienne fiche locale reste intacte jusqu’à la création volontaire d’une copie',async({page})=>{
  const legacy=originFixture(c,'clerc',3,{speciesId:'orc'},'charlatan');
  delete legacy.rulesVersion;legacy.name='Ancienne fiche conservée';legacy.cloudId='11111111-1111-1111-1111-111111111111';legacy.cloudRevision=1;
  await page.goto('/atelier/');
  // This fixture models existing storage; new-character journeys still use the form.
  await page.evaluate(s=>{const key='table-maitre-refonte-maquette-v1:e2e-account-a';localStorage.setItem(key,JSON.stringify(s));localStorage.setItem(key+':personnages',JSON.stringify({[s.cloudId]:s}));},legacy);
  await page.goto('/atelier/#fiche/brouillon');await page.reload();
  await expect(page.getByRole('button',{name:'Créer une copie à mettre à niveau'})).toBeVisible();
  await expect(page.locator('.sheet-hero')).toHaveCount(0);
  await page.getByRole('button',{name:'Créer une copie à mettre à niveau'}).click();
  await expect(page.locator('#name')).toHaveValue(legacy.name);
  const stored=await page.evaluate(()=>({draft:JSON.parse(localStorage.getItem('table-maitre-refonte-maquette-v1:e2e-account-a')),records:JSON.parse(localStorage.getItem('table-maitre-refonte-maquette-v1:e2e-account-a:personnages'))}));
  expect(stored.draft.cloudId).not.toBe(legacy.cloudId);expect(stored.draft.cloudRevision).toBe(0);
  expect(stored.draft.rulesVersion).toBe(CURRENT_RULES_VERSION);
  expect(stored.records[legacy.cloudId].scores).toEqual(legacy.scores);
  expect(stored.records[legacy.cloudId].cloudRevision).toBe(1);
  expect(stored.records[legacy.cloudId]).toEqual(legacy);
});

test('Six rituels et une botte de don sont choisis dans le formulaire, enregistrés et relus',async({page,browser,auth})=>{
  const s=originFixture(c,'guerrier',20,{speciesId:'orc'},'charlatan');s.name='Rituels et botte vérifiés';
  s.advancements[4]={mode:'feat',abilities:[],featId:'magie_rituelle',featAbility:'INT',notes:'',choices:{}};
  s.advancements[8]={mode:'feat',abilities:[],featId:'weapon_master',featAbility:'FOR',notes:'',choices:{}};
  finishChoices(s,c);s.advancements[8].choices.weapon='Pic de guerre';
  await createOriginThroughUI(page,s,c);const href=await saveAndLocate(page,s.name);
  const verify=async p=>{await p.locator('[data-sheet-tab="spells"]').click();await expect(p.locator('.sheet-spell').filter({hasText:'Magie rituelle'})).toHaveCount(6);};
  await verify(page);await page.reload();await verify(page);
  const fresh=await browser.newContext({storageState:auth,baseURL:origin});
  try{const p=await fresh.newPage();await p.goto('/atelier/'+href);await verify(p);await p.getByRole('link',{name:'← Modifier mes choix'}).click();await p.locator('[data-step="4"]').click();await expect(p.locator('[data-feat-choice="weapon"][data-feat-level="8"]')).toHaveValue('Pic de guerre');}finally{await fresh.close();}
});
