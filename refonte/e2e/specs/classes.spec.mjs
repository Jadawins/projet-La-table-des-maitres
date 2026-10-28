import {readFile} from 'node:fs/promises';
import {test,expect,origin} from '../fixtures.mjs';
import {saveAndLocate} from '../journey.mjs';
import {buildCatalogue} from '../../catalogue.mjs';
import {classFixture} from '../../audit/class-fixtures.mjs';
import {classChoiceSpecs} from '../../maquette/class-profiles.mjs';
import {classProfile} from '../../maquette/character-rules.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../../data/rules-mongodb.json',import.meta.url))));
const classes=['barbare','rodeur','barde','druide','guerrier'];
const next=page=>page.locator('#next').click();
async function checkValues(page,kind,values){
  for(const id of values)await page.locator(`[data-class-select="${kind}"][data-class-value="${id}"]`).check();
}
async function build(page,s){
  await page.goto('/atelier/#nouveau');
  await page.locator('#name').fill(s.name);await page.locator('#level').selectOption(String(s.level));await next(page);
  await page.locator(`[data-choice="classId"][data-id="${s.classId}"]`).click();await next(page);
  await page.locator('[data-choice="speciesId"][data-id="orc"]').click();
  await page.locator('[data-choice="backgroundId"][data-id="charlatan"]').click();await next(page);
  for(const [id,value]of Object.entries(s.scores))await page.locator(`[data-stat="${id}"]`).fill(String(value));
  await page.locator('[data-bonus-mode="three"]').click();await next(page);
  if(s.level>=3)await page.locator(`[data-choice="subclassId"][data-id="${s.subclassId}"]`).click();
  for(const [n,row]of Object.entries(s.advancements)){
    await page.locator(`[data-advance-level="${n}"][data-advance-mode="${row.mode}"]`).click();
    if(row.mode==='ability')for(let i=0;i<2;i++)await page.locator(`[data-advance-level="${n}"][data-advance-point="${i}"]`).selectOption(row.abilities[i]);
    else {await page.locator(`[data-advance-level="${n}"][data-advance-field="featId"]`).selectOption(row.featId);await page.locator(`[data-advance-level="${n}"][data-advance-field="featAbility"]`).selectOption(row.featAbility);}
  }
  for(const skill of s.classSkills)await page.locator(`[data-class-skill="${skill}"]`).check();
  for(const spec of classChoiceSpecs(s,c)){
    if(spec.kind)for(const [i,value]of s.classChoices[spec.key].entries())await page.locator(`[data-class-free="${spec.key}"][data-class-index="${i}"]`).fill(value);
    else await checkValues(page,spec.key,s.classChoices[spec.key]);
  }
  await next(page);
  if(classProfile(s,c).hasMagic){
    for(const kind of ['cantrips','prepared'])for(const id of s[kind])await page.locator(`[data-spell-kind="${kind}"][data-spell-id="${id}"]`).check();
    await next(page);
  }
  await page.locator('[data-choice="equipment"][data-id="A"]').click();await next(page);await next(page);
  await expect(page.locator('.sheet-hero h1')).toHaveText(s.name);
  await expect(page.locator('.sheet-incomplete')).toHaveCount(0);
}
async function assertNumbers(page,s){
  const die={barbare:12,rodeur:10,barde:8,druide:8,guerrier:10}[s.classId];
  const bumps=s.classId==='guerrier'?Math.min(5,[4,6,8,12,14,16].filter(n=>n<=s.level).length):[4,8,12,16].filter(n=>n<=s.level).length;
  const con=15+bumps+(s.level>=19?1:0)+(s.classId==='barbare'&&s.level===20?4:0),mod=Math.floor((con-10)/2);
  const hp=die+mod+(s.level-1)*(Math.floor(die/2)+1+mod)+(s.level>=19?40:0);
  await expect(page.locator('.sheet-quickstats')).toContainText(`PV max. ${hp}`);
  if(classProfile(s,c).hasMagic){
    await page.locator('[data-sheet-tab="spells"]').click();
    const castMod=s.classId==='guerrier'?2:3,pb=2+Math.floor((s.level-1)/4); // INT for Eldritch Knight, CHA/SAG for others.
    await expect(page.locator('.spell-sheet-summary')).toContainText(`DD des sorts ${8+pb+castMod}`);
    await expect(page.locator('.spell-sheet-summary')).toContainText(`Attaque de sort +${pb+castMod}`);
  }else await expect(page.locator('.sheet-quickstats')).toContainText(`CA ${s.classId==='guerrier'?16:11+mod}`);
  await page.locator('[data-sheet-tab="abilities"]').click();
  if(s.classId==='barde')await expect(page.locator('#sheet-panel-abilities')).toContainText('3 utilisations');
  if(s.classId==='druide'&&s.level>=2)await expect(page.locator('#sheet-panel-abilities')).toContainText('Formes animales connues');
}
// All 320 class/subclass/level combinations are checked by unit tests.
// Real browser journeys cover starting levels and major transitions, plus save/reload/server readback.
for(const id of classes)for(const sub of c.subclasses.filter(s=>s.classe_parente===id))for(const level of (id==='guerrier'?[1,3,6,7,10,14,20]:[1,3,6,10,20])){
  test(`${id} · ${sub.nom} · niveau ${level}${level===20?' @quick':''}`,async({page,browser,auth})=>{
    const s=classFixture(c,id,level,sub.id);s.name=`E2E ${sub.id} ${level}`;
    await build(page,s);await assertNumbers(page,s);
    const href=await saveAndLocate(page,s.name);
    await page.reload();await expect(page.locator('.sheet-hero h1')).toHaveText(s.name);
    const fresh=await browser.newContext({storageState:auth,baseURL:origin});
    try{
      const p=await fresh.newPage();await p.goto('/atelier/'+href);await expect(p.locator('.sheet-hero h1')).toHaveText(s.name);await assertNumbers(p,s);
      await p.locator('a[href="#creation"]').click();await p.locator('[data-step="4"]').click();
      const spec=classChoiceSpecs(s,c).find(x=>!x.kind&&x.options.length);
      await expect(p.locator(`[data-class-select="${spec.key}"][data-class-value="${s.classChoices[spec.key][0]}"]`)).toBeChecked();
    }finally{await fresh.close();}
  });
}
