import {readFile} from 'node:fs/promises';
import {test,expect,origin} from '../fixtures.mjs';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
import {classProfile} from '../../maquette/character-rules.mjs';
import {createOriginThroughUI} from '../origin-journey.mjs';
import {saveAndLocate} from '../journey.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
for(const circle of ['lune','mers','astres'])for(let level=1;level<=20;level++)test(`Cercle ${circle} 2024 · niveau ${level}`,async({page,browser,auth})=>{
  const s=originFixture(c,'druide',level,{speciesId:'orc'},'charlatan');s.name=`Cercle ${circle} ${level}`;
  if(level>=3)s.subclassId='druide_cercle_'+circle;
  const p=classProfile(s,c);s.cantrips=p.cantrips.slice(0,p.cantripCount).map(x=>x.id);s.prepared=p.prepared.slice(0,p.preparedCount).map(x=>x.id);
  async function check(p){
    await expect(p.locator('.sheet-hero h1')).toHaveText(s.name);await expect(p.locator('.sheet-incomplete')).toHaveCount(0);
    await p.locator('[data-sheet-tab="abilities"]').click();const panel=p.locator('#sheet-panel-abilities');
    if(level>=3){
      await expect(panel).toContainText({lune:'Formes lunaires',mers:'Colère des mers',astres:'Forme stellaire'}[circle]);
      if(circle==='lune')await expect(panel).not.toContainText('Transformations multiples');
      if(circle==='mers')await expect(panel).not.toContainText('respiration sous l’eau');
      if(circle==='astres')await expect(panel).not.toContainText('Œil des astres');
    }
    await p.locator('[data-sheet-tab="spells"]').click();
    if(level>=3&&circle==='lune'){
      await expect(p.getByRole('heading',{name:'Rayon de lune',exact:true})).toHaveCount(1);
      if(level>=7){const spell=p.locator('.sheet-spell').filter({has:p.getByRole('heading',{name:'Flux de lune',exact:true})});await expect(spell).toContainText('Niveau 4');await expect(spell).toContainText('2d6');}
    }
    if(level>=3&&circle==='mers')await expect(p.getByRole('heading',{name:'Fracassement',exact:true})).toHaveCount(1);
    if(level>=3&&circle==='astres')await expect(p.locator('.sheet-spell').filter({hasText:'Carte stellaire · carte tenue'})).toHaveCount(2);
  }
  await createOriginThroughUI(page,s,c);await check(page);const href=await saveAndLocate(page,s.name);await page.reload();await check(page);
  const fresh=await browser.newContext({storageState:auth,baseURL:origin});
  try{const p=await fresh.newPage();await p.goto('/atelier/'+href);await check(p);}finally{await fresh.close();}
});
