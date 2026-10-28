import {readFile} from 'node:fs/promises';
import {expect} from '@playwright/test';
const source=JSON.parse(await readFile(new URL('../data/rules-mongodb.json',import.meta.url),'utf8'));
export const cleric=source.collections.classes.find(c=>c.nom==='Clerc');
export const domains=source.collections.sous_classes.filter(s=>s.classe_parente==='clerc');
export const abilities=['FOR','DEX','CON','INT','SAG','CHA'];
export const baseScores={FOR:12,DEX:11,CON:14,INT:14,SAG:18,CHA:9};
const next=async page=>page.locator('#next').click();
export async function createThroughUI(page,{name,level,domain,vocation,boon='faveur_de_memoire_magique',method='physical'}){
  await page.goto('/atelier/#nouveau');
  await expect(page.locator('#name')).toHaveValue('');
  await page.locator('#name').fill(name);
  await page.locator('#level').selectOption(String(level));await next(page);
  await expect(page.locator('[data-choice="classId"][aria-pressed="true"]')).toHaveCount(0);
  await page.locator('[data-choice="classId"][data-id="clerc"]').click();await next(page);
  await expect(page.locator('[data-choice="speciesId"][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('[data-choice="backgroundId"][aria-pressed="true"]')).toHaveCount(0);
  await page.locator('[data-choice="speciesId"][data-id="orc"]').click();
  await page.locator('[data-choice="backgroundId"][data-id="charlatan"]').click();await next(page);
  if(method==='standard')await page.locator('[data-method="standard"]').click();
  else for(const ability of abilities)await page.locator(`[data-stat="${ability}"]`).fill(String(baseScores[ability]));
  await page.locator('[data-bonus-mode="three"]').click();await next(page);
  await page.locator(`[data-choice="divineOrder"][data-id="${vocation}"]`).click();
  if(level>=3)await page.locator(`[data-choice="subclassId"][data-id="${domain._source}"]`).click();
  for(const n of [4,8,12,16].filter(n=>n<=level)){
    await page.locator(`[data-advance-level="${n}"][data-advance-mode="ability"]`).click();
    await page.locator(`[data-advance-level="${n}"][data-advance-point="0"]`).selectOption(n<=8?'SAG':'INT');
    await page.locator(`[data-advance-level="${n}"][data-advance-point="1"]`).selectOption('CON');
  }
  if(level>=19){
    await page.locator('[data-advance-level="19"][data-advance-mode="feat"]').click();
    await page.locator('[data-advance-level="19"][data-advance-field="featId"]').selectOption(boon);
    await page.locator('[data-advance-level="19"][data-advance-field="featAbility"]').selectOption('SAG');
    if(boon==='faveur_de_resistance_aux_energies'){
      await page.locator('[data-feat-resistance="feu"]').check();
      await page.locator('[data-feat-resistance="froid"]').check();
    }
  }
  if(level>=7)await page.locator(`[data-choice="sacredStrike"][data-id="${vocation==='Protecteur'?'Frappe sacrée':'Magie puissante'}"]`).click();
  await page.locator('[data-class-skill="Médecine"]').check();
  await page.locator('[data-class-skill="Religion"]').check();await next(page);
  const row=cleric.niveaux[level],cantrips=row.sorts_mineurs+(vocation==='Thaumaturge'?1:0);
  for(let i=0;i<cantrips;i++){
    const id=await page.locator('input[data-spell-kind="cantrips"]:not(:checked):not(:disabled)').first().getAttribute('data-spell-id');
    await page.locator(`input[data-spell-kind="cantrips"][data-spell-id="${id}"]`).check();
  }
  const maxRank=Math.max(...Object.keys(row.emplacements_de_sort).map(Number));
  await page.locator('.spell-card').filter({hasText:`Niveau ${maxRank} ·`}).locator('input[data-spell-kind="prepared"]').first().check();
  for(let i=1;i<row.sorts_prepares;i++){
    const id=await page.locator('input[data-spell-kind="prepared"]:not(:checked):not(:disabled)').first().getAttribute('data-spell-id');
    await page.locator(`input[data-spell-kind="prepared"][data-spell-id="${id}"]`).check();
  }
  await expect(page.locator('input[data-spell-kind="cantrips"]:checked')).toHaveCount(cantrips);
  await expect(page.locator('input[data-spell-kind="prepared"]:checked')).toHaveCount(row.sorts_prepares);
  await next(page);
  await page.locator('[data-choice="equipment"][data-id="A"]').click();await next(page);
  await expect(page.getByRole('heading',{name:'Le début d’une légende.'})).toBeVisible();
  await next(page);
  await expect(page.locator('.sheet-hero h1')).toHaveText(name);
  await expect(page.locator('.sheet-level strong')).toHaveText(String(level));
  await expect(page.locator('.sheet-incomplete')).toHaveCount(0);
}
export async function saveAndLocate(page,name){
  await page.locator('[data-save-character]').click();
  await expect(page.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');
  await page.locator('a[href="#personnages"]').first().click();
  await expect(page.locator('.draft-banner')).toHaveCount(0);
  const card=page.locator('a.saved-character').filter({has:page.getByRole('heading',{name,exact:true})});
  await expect(card).toHaveCount(1);
  await expect(card).not.toContainText('Choix à compléter');
  const href=await card.getAttribute('href');
  await card.click();await expect(page.locator('.sheet-hero h1')).toHaveText(name);
  return href;
}
export async function assertSheet(page,{level,vocation}){
  await expect(page.locator('.sheet-incomplete')).toHaveCount(0);
  const bumps=[4,8,12,16].filter(n=>n<=level).length;
  const con=15+bumps,modCon=Math.floor((con-10)/2);
  const hp=8+modCon+(level-1)*(5+modCon);
  const pb=2+Math.floor((level-1)/4);
  const wisdom=18+Math.min(bumps,2)+(level>=19?1:0);
  const wisMod=Math.floor((wisdom-10)/2);
  await expect(page.locator('.sheet-quickstats')).toContainText(`PV max. ${hp}`);
  await expect(page.locator('.paper-abilities > div').filter({has:page.getByText('SAG',{exact:true})}).locator('b')).toHaveText(String(wisdom));
  await page.locator('[data-sheet-tab="spells"]').click();
  await expect(page.locator('.spell-sheet-summary')).toContainText(`DD des sorts ${8+pb+wisMod}`);
  await expect(page.locator('.spell-sheet-summary')).toContainText(`Attaque de sort +${pb+wisMod}`);
  await expect(page.locator('.sheet-spell').filter({has:page.getByRole('heading',{name:'Flamme sacrée',exact:true})})).toContainText(`${1+[5,11,17].filter(n=>n<=level).length}d8`);
  await page.locator('[data-sheet-tab="abilities"]').click();
  if(level>=14)await expect(page.locator('#sheet-panel-abilities')).toContainText(vocation==='Protecteur'?'2d8':`${2*wisMod} PV temporaires`);
  if(level===20)await expect(page.locator('#sheet-panel-abilities')).toContainText('Grâce divine suprême');
}
