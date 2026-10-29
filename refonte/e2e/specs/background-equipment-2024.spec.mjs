import {readFile} from 'node:fs/promises';
import {test,expect,origin} from '../fixtures.mjs';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
import {createOriginThroughUI} from '../origin-journey.mjs';
import {saveAndLocate} from '../journey.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
const references=JSON.parse(await readFile(new URL('../../audit/background-reference-2024.json',import.meta.url)));
for(const ref of references)for(const choice of ['A','B'])test(`Historique ${ref.id} · option ${choice}`,async({page,browser,auth})=>{
  const s=originFixture(c,'barbare',1,{speciesId:'orc'},ref.id,{equipment:'B',backgroundEquipment:choice});s.name=`Matériel ${ref.id} ${choice}`;
  await createOriginThroughUI(page,s,c);
  const gold=75+(choice==='B'?50:ref.fields.equipement.find(i=>i.nom==="Pièces d'or").quantite);
  async function check(p){
    await expect(p.locator('.sheet-hero h1')).toHaveText(s.name);
    await expect(p.locator('.sheet-incomplete')).toHaveCount(0);
    await p.locator('[data-sheet-tab="equipment"]').click();
    await expect(p.locator('.sheet-coins span').filter({hasText:/ PO$/})).toHaveText(`${gold} PO`);
    if(choice==='B')await expect(p.locator('.sheet-inventory')).not.toContainText('Historique');
    else await expect(p.locator('.sheet-inventory')).toContainText('Historique');
  }
  await check(page);const href=await saveAndLocate(page,s.name);await page.reload();await check(page);
  const fresh=await browser.newContext({storageState:auth,baseURL:origin});
  try{const p=await fresh.newPage();await p.goto('/atelier/'+href);await check(p);
    await p.locator('a[href="#creation"]').click();await p.locator('[data-step="6"]').click();
    await expect(p.locator(`[data-choice="backgroundEquipment"][data-id="${choice}"]`)).toHaveAttribute('aria-pressed','true');
    if(s.backgroundKit&&choice==='A')await expect(p.locator('[data-origin-field="backgroundKit"]')).toHaveValue(s.backgroundKit);
  }finally{await fresh.close();}
});
