import {readFile} from 'node:fs/promises';
import {test,expect,origin} from '../fixtures.mjs';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
import {createOriginThroughUI} from '../origin-journey.mjs';
import {saveAndLocate} from '../journey.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
for(const [kind,name]of [['mer','Bête de la mer'],['ciel','Bête du ciel']])for(const level of [3,7,11,15,20])test(`Compagnon ${kind} · niveau ${level}`,async({page,browser,auth})=>{
  const state=originFixture(c,'rodeur',level,{speciesId:'orc'},'charlatan');
  state.subclassId='rodeur_belluaire';state.name=`Compagnon E2E ${kind} ${level}`;
  state.classChoices.companion=[kind];state.classChoices.companionDamage=[kind==='mer'?'perforants':'tranchants'];state.classChoices.companionAppearance=[kind==='mer'?'Dauphin':'Faucon'];
  const check=async p=>{
    await p.locator('[data-sheet-tab="abilities"]').click();
    const pet=p.locator('[data-companion-profile]');
    await expect(pet).toContainText(name);
    await expect(pet).toContainText(state.classChoices.companionAppearance[0]);
    await expect(pet.locator('dt').filter({hasText:/^pv$/}).locator('..').locator(':scope > dd')).toHaveText(String((kind==='mer'?5:4)*(level+1)));
    await expect(pet.locator('dt').filter({hasText:/^ca$/}).locator('..').locator(':scope > dd')).toHaveText('14');
    await expect(p.locator('.sheet-incomplete')).toHaveCount(0);
  };
  await createOriginThroughUI(page,state,c);await check(page);
  const href=await saveAndLocate(page,state.name);await page.reload();await check(page);
  const fresh=await browser.newContext({storageState:auth,baseURL:origin});
  try{const other=await fresh.newPage();await other.goto('/atelier/'+href);await check(other);}finally{await fresh.close();}
});
