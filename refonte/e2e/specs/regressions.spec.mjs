import {test,expect,origin,signIn} from '../fixtures.mjs';
import {domains,createThroughUI,saveAndLocate} from '../journey.mjs';
const domain=domains.find(d=>d._source==='clerc_domaine_vie');
test('Choix vides et validation sans lancer de dés @quick',async({page})=>{
  await page.goto('/atelier/#nouveau');
  await page.locator('#next').click();
  await expect(page.locator('#name')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('Donnez un nom');
  await page.locator('#name').fill('E2E validation');await page.locator('#next').click();
  await expect(page.locator('[data-choice="classId"][aria-pressed="true"]')).toHaveCount(0);
  await page.locator('#next').click();await expect(page.locator('[data-step="1"]')).toHaveAttribute('aria-current','step');
  await page.locator('[data-choice="classId"][data-id="clerc"]').click();await page.locator('#next').click();
  await page.locator('[data-choice="speciesId"][data-id="orc"]').click();await page.locator('[data-choice="backgroundId"][data-id="charlatan"]').click();await page.locator('#next').click();
  for(const field of await page.locator('input[data-stat]').all())await expect(field).toHaveValue('');
  await expect(page.locator('[data-method="physical"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#next').click();await expect(page.locator('[data-step="3"]')).toHaveAttribute('aria-current','step');
});
test('Faveur, modification et réouverture sans doublon @quick',async({page,browser,auth},info)=>{
  const name='E2E faveur et modification';
  await createThroughUI(page,{name,level:20,domain,vocation:'Thaumaturge',boon:'faveur_de_resistance_aux_energies'});
  await page.locator('[data-sheet-tab="combat"]').click();await expect(page.locator('#sheet-panel-combat')).toContainText('feu · froid');
  const href=await saveAndLocate(page,name),id=href.replace('#ouvrir/','');
  await page.locator('[data-sheet-tab="story"]').click();
  await page.locator('.sheet-editor > summary').click();
  await page.locator('input[data-sheet-detail="player"]').fill('Joueur E2E');
  await page.locator('textarea[data-sheet-detail="story"]').fill('Une histoire modifiée depuis la fiche.');
  await page.locator('#save-sheet-details').click();
  await expect(page.locator('.sheet-save-status')).toContainText('Modifications à enregistrer');
  const response=page.waitForResponse(r=>r.url().endsWith('/atelier/api/personnages/'+id)&&r.request().method()==='PUT');
  await page.locator('[data-save-character]').click();
  expect((await (await response).json()).revision).toBe(2);
  await expect(page.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');
  const fresh=await browser.newContext({storageState:auth,baseURL:origin});
  try{
    const reopened=await fresh.newPage();await reopened.goto('/atelier/'+href);await expect(reopened.locator('.sheet-hero h1')).toHaveText(name);
    await reopened.locator('[data-sheet-tab="story"]').click();await expect(reopened.locator('textarea[data-sheet-detail="story"]')).toHaveValue('Une histoire modifiée depuis la fiche.');
    await reopened.locator('[data-sheet-tab="combat"]').click();await expect(reopened.locator('#sheet-panel-combat')).toContainText('feu · froid');
    await reopened.screenshot({path:info.outputPath('faveur-enregistree.png'),fullPage:false});
  }finally{await fresh.close();}
});
test('Une erreur réseau conserve le brouillon et permet de réessayer @quick',async({page})=>{
  const name='E2E coupure réseau';await createThroughUI(page,{name,level:3,domain,vocation:'Protecteur'});
  await page.route('**/atelier/api/personnages/*',async route=>{
    if(route.request().method()==='PUT')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Coupure de test. Le brouillon est conservé.'})});else await route.continue();
  });
  await page.locator('[data-save-character]').click();await expect(page.getByRole('alert')).toContainText('Coupure de test');
  await page.reload();await expect(page.locator('.sheet-hero h1')).toHaveText(name);
  await page.unroute('**/atelier/api/personnages/*');
  await saveAndLocate(page,name);
});
test('Un second compte ne voit pas et ne peut pas ouvrir le personnage @quick',async({page,browser})=>{
  const name='E2E isolation des comptes';await createThroughUI(page,{name,level:3,domain,vocation:'Protecteur'});const href=await saveAndLocate(page,name);
  const other=await browser.newContext({storageState:{cookies:[],origins:[]}});
  try{
    const otherPage=await other.newPage();await signIn(otherPage,'b');await expect(otherPage.getByRole('heading',{name,exact:true})).toHaveCount(0);
    await otherPage.goto(origin+'/atelier/'+href);await expect(otherPage.getByRole('heading',{name:'Le personnage n’a pas pu être ouvert.'})).toBeVisible();await expect(otherPage.getByText('Personnage introuvable.',{exact:true})).toBeVisible();await expect(otherPage.locator('.sheet-hero h1')).toHaveCount(0);
  }finally{await other.close();}
});
