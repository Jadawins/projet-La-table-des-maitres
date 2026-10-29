import {readFile} from 'node:fs/promises';
import {test,expect,origin} from '../fixtures.mjs';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
import {classProfile} from '../../maquette/character-rules.mjs';
import {createOriginThroughUI} from '../origin-journey.mjs';
import {saveAndLocate} from '../journey.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
const terrains=['Aride','Polaire','Tempéré','Tropical'];
for(const terrain of terrains)for(let level=1;level<=20;level++)test(`Terre 2024 · ${terrain} · niveau ${level}`,async({page,browser,auth})=>{
  const s=originFixture(c,'druide',level,{speciesId:'orc'},'charlatan');s.name=`Terre ${terrain} ${level}`;
  if(level>=3){s.subclassId='druide_cercle_terre';s.classChoices.terrain=[terrain];}
  const p=classProfile(s,c);s.cantrips=p.cantrips.slice(0,p.cantripCount).map(x=>x.id);s.prepared=p.prepared.slice(0,p.preparedCount).map(x=>x.id);
  const count=level<3?0:3+[5,7,9].filter(n=>n<=level).length;
  async function check(p){
    await expect(p.locator('.sheet-hero h1')).toHaveText(s.name);await expect(p.locator('.sheet-incomplete')).toHaveCount(0);
    await p.locator('[data-sheet-tab="spells"]').click();
    await expect(p.locator('.sheet-spell').filter({hasText:'Sorts de terrain · '+terrain})).toHaveCount(count);
    await p.locator('[data-sheet-tab="abilities"]').click();
    if(level>=3){await expect(p.locator('#sheet-panel-abilities')).toContainText('Aval de la terre');await expect(p.locator('#sheet-panel-abilities')).not.toContainText('Foulée de la terre');}
    if(level>=6)await expect(p.locator('#sheet-panel-abilities')).toContainText('Ressourcement');
    if(level>=10)await expect(p.locator('#sheet-panel-abilities')).toContainText('Protégé de dame Nature');
    if(level>=14)await expect(p.locator('#sheet-panel-abilities')).toContainText('Sanctuaire de dame Nature');
  }
  await createOriginThroughUI(page,s,c);await check(page);const href=await saveAndLocate(page,s.name);
  await page.reload();await check(page);
  const fresh=await browser.newContext({storageState:auth,baseURL:origin});
  try{const p=await fresh.newPage();await p.goto('/atelier/'+href);await check(p);}finally{await fresh.close();}
});
