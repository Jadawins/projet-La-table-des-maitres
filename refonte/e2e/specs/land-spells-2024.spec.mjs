import {readFile} from 'node:fs/promises';
import {test,expect,origin} from '../fixtures.mjs';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
import {classProfile} from '../../maquette/character-rules.mjs';
import {createOriginThroughUI} from '../origin-journey.mjs';
import {saveAndLocate} from '../journey.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
for(const [terrain,level,title]of [['Polaire',5,'Tempête de neige'],['Tropical',3,'Rayon empoisonné']])test(`Fiche corrigée · ${title}`,async({page,browser,auth},info)=>{
  const s=originFixture(c,'druide',level,{speciesId:'orc'},'charlatan');s.subclassId='druide_cercle_terre';s.classChoices.terrain=[terrain];s.name=title+' test';
  const p=classProfile(s,c);s.cantrips=p.cantrips.slice(0,p.cantripCount).map(x=>x.id);s.prepared=p.prepared.slice(0,p.preparedCount).map(x=>x.id);
  async function check(p){
    await p.locator('[data-sheet-tab="spells"]').click();
    const card=p.locator('.sheet-spell').filter({has:p.getByRole('heading',{name:title,exact:true})});
    await expect(card.locator('.spell-facts').filter({hasText:'Composantes :'})).toBeVisible();
    await expect(card.getByText('Composantes, effets et paramètres',{exact:true})).toHaveCount(0);
    if(terrain==='Polaire'){
      await expect(card).toContainText(/Visibilité[\s\S]*nulle/);await expect(card).toContainText('À terre');
      await expect(card.locator('.spell-current-damage')).toHaveCount(0);
    }else{await expect(card).toContainText('2d8');await expect(card).not.toContainText('JS de Constitution');}
    await card.screenshot({path:info.outputPath('sort-composantes.png')});
  }
  await createOriginThroughUI(page,s,c);await check(page);const href=await saveAndLocate(page,s.name);await page.reload();await check(page);
  const fresh=await browser.newContext({storageState:auth,baseURL:origin});
  try{const p=await fresh.newPage();await p.goto('/atelier/'+href);await check(p);}finally{await fresh.close();}
});
