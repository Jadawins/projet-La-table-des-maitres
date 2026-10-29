import {readFile} from 'node:fs/promises';
import {test,expect,origin} from '../fixtures.mjs';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
import {createOriginThroughUI} from '../origin-journey.mjs';
import {saveAndLocate} from '../journey.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
const scores={FOR:12,DEX:12,CON:12,INT:10,SAG:14,CHA:16};
async function reopen(page,browser,auth,state,check){
  await createOriginThroughUI(page,state,c);await check(page);
  const href=await saveAndLocate(page,state.name);await page.reload();await check(page);
  const fresh=await browser.newContext({storageState:auth,baseURL:origin});
  try{const p=await fresh.newPage();await p.goto('/atelier/'+href);await check(p);}finally{await fresh.close();}
}

for(const background of ['acolyte','guide','sage'])for(const ability of ['INT','SAG','CHA'])test(`Initié 2024 · ${background} · ${ability}`,async({page,browser,auth})=>{
  const s=originFixture(c,'barbare',1,{speciesId:'orc'},background,{scores});s.originGrants.background.magicAbility=ability;s.name=`Initié ${background} ${ability}`;
  const bg=c.backgrounds.find(b=>b.id===background),modifier=Math.floor((scores[ability]+(bg.bonus_caracteristiques.suggerees.includes(ability)?1:0)-10)/2);
  await reopen(page,browser,auth,s,async p=>{
    await p.locator('[data-sheet-tab="spells"]').click();
    const cards=p.locator('.sheet-spell');await expect(cards).toHaveCount(3);
    for(let i=0;i<3;i++)await expect(cards.nth(i).locator('p.hint')).toContainText(`${ability} · DD ${10+modifier}`);
  });
});

for(const [speciesId,variantId]of [['elfe','drow'],['gnome','gnome_forets'],['tieffelin','abyssal']])for(const ability of ['INT','SAG','CHA'])test(`Lignage 2024 · ${speciesId} · ${ability}`,async({page,browser,auth})=>{
  const s=originFixture(c,'barbare',5,{speciesId,variantId,speciesCastingAbility:ability},'charlatan',{scores});s.name=`Lignage ${speciesId} ${ability}`;
  const modifier=Math.floor((scores[ability]+(ability==='CHA'?1:0)-10)/2);
  await reopen(page,browser,auth,s,async p=>{
    await p.locator('[data-sheet-tab="spells"]').click();
    const cards=p.locator('.sheet-spell');await expect(cards).toHaveCount(speciesId==='elfe'?3:speciesId==='gnome'?2:4);
    for(let i=0;i<await cards.count();i++)await expect(cards.nth(i).locator('p.hint')).toContainText(`${ability} · DD ${11+modifier}`);
  });
});

test('Haut-elfe : remplacement du sort mineur conservé à la réouverture',async({page,browser,auth})=>{
  const s=originFixture(c,'barbare',5,{speciesId:'elfe',variantId:'haut_elfe',speciesCastingAbility:'CHA',speciesCantrip:'trait_de_feu'},'charlatan');s.name='Haut-elfe adaptable';
  await reopen(page,browser,auth,s,async p=>{await p.locator('[data-sheet-tab="spells"]').click();await expect(p.locator('.sheet-spell h3').filter({hasText:/^Trait de feu$/})).toHaveCount(1);await expect(p.locator('.sheet-spell h3').filter({hasText:/^Prestidigitation$/})).toHaveCount(0);});
});

for(const [speciesId,variantId,level,title,text]of [['aasimar','',5,'Mains guérisseuses','3d4 PV'],['drakeide','airain',17,'Souffle','4d10 feu']])test(`Ressource d’espèce · ${speciesId}`,async({page,browser,auth})=>{
  const s=originFixture(c,'barbare',level,{speciesId,variantId},'charlatan');s.name=`Ressource ${speciesId}`;
  await reopen(page,browser,auth,s,async p=>{await p.locator('[data-sheet-tab="abilities"]').click();await expect(p.locator(`[data-species-resource="${title}"]`)).toContainText(text);});
});
