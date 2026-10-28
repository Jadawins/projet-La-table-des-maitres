import {readFile} from 'node:fs/promises';
import {test,expect,origin} from '../fixtures.mjs';
import {createOriginThroughUI} from '../origin-journey.mjs';
import {saveAndLocate} from '../journey.mjs';
import {buildCatalogue} from '../../catalogue.mjs';
import {originCases,originFixture} from '../../audit/origin-fixtures.mjs';
import {featFixture} from '../../audit/feat-fixtures.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../../data/rules-mongodb.json',import.meta.url))));
const cases=originCases(c).map((o,i)=>({name:`Origine ${o.speciesId}/${o.variantId}/${o.speciesSize}`,state:originFixture(c,c.classes[i%c.classes.length].id,5,o,c.backgrounds[i%c.backgrounds.length].id)}));
for(const feat of c.feats.filter(f=>f.categorie==='origine'))cases.push({name:'Humain · '+feat.nom,state:originFixture(c,'barde',1,{speciesId:'humain',speciesSize:'P'},feat.id==='truand'?'fermier':'charlatan',{originFeatId:feat.id})});
for(const [cls,id]of [['barbare','faveur_de_competence'],['barbare','observateur'],['magicien','magie_rituelle'],['clerc','expert'],['roublard','mobile']])cases.push({name:`Don ${cls}/${id}`,state:featFixture(c,cls,c.feats.find(f=>f.id===id)).state});
for(const [speciesId,variantId]of [['nain','nain_collinaire'],['nain','nain_montagnes'],['tieffelin','infernal'],['elfe','elfe_sylvestre']])cases.push({name:'Origine niveau 20 · '+variantId,state:originFixture(c,'clerc',20,{speciesId,variantId,speciesSize:'M'},'fermier')});
for(const [index,{name,state:s}]of cases.entries())test(name,async({page,browser,auth})=>{
  test.setTimeout(180000);s.name=`Origines E2E ${index}`;
  await createOriginThroughUI(page,s,c);
  const before=await page.locator('.sheet-quickstats').innerText();
  const href=await saveAndLocate(page,s.name);
  await page.reload();await expect(page.locator('.sheet-quickstats')).toHaveText(before,{useInnerText:true});
  const fresh=await browser.newContext({storageState:auth,baseURL:origin});
  try{
    const p=await fresh.newPage();await p.goto('/atelier/'+href);await expect(p.locator('.sheet-hero h1')).toHaveText(s.name);
    await expect(p.locator('.sheet-quickstats')).toHaveText(before,{useInnerText:true});await expect(p.locator('.sheet-incomplete')).toHaveCount(0);
    await p.locator('a[href="#creation"]').click();await p.locator('[data-step="2"]').click();
    for(const field of ['speciesAncestry','speciesCastingAbility','originFeatId','backgroundTool'])if(s[field])await expect(p.locator(`[data-origin-field="${field}"]`)).toHaveValue(s[field]);
    if(s.variantId)await expect(p.locator(`[data-choice="variantId"][data-id="${s.variantId}"]`)).toHaveAttribute('aria-pressed','true');
  }finally{await fresh.close();}
});
