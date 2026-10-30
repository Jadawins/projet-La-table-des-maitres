import {test,expect,origin} from '../fixtures.mjs';
import {domains,createThroughUI,saveAndLocate} from '../journey.mjs';
const domain=domains.find(d=>d._source==='clerc_domaine_vie');
const row=(page,name)=>page.locator('.saved-character-row').filter({has:page.getByRole('heading',{name,exact:true})});

test('Suppression confirmée : annulation possible, disparition après actualisation et ancien onglet bloqué',async({page,browser,auth},info)=>{
  const name='E2E personnage à supprimer';await createThroughUI(page,{name,level:3,domain,vocation:'Protecteur'});
  const href=await saveAndLocate(page,name),id=href.slice('#ouvrir/'.length);
  const original=await (await page.request.get('/atelier/api/personnages/'+id)).json();
  await page.locator('a[href="#personnages"]').first().click();
  await row(page,name).getByRole('button',{name:'Supprimer '+name,exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText(name);
  await page.screenshot({path:info.outputPath('confirmation-suppression.png')});
  await page.getByRole('button',{name:'Annuler',exact:true}).click();
  await expect(row(page,name)).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
  await row(page,name).getByRole('button',{name:'Supprimer '+name,exact:true}).click();
  await page.getByRole('button',{name:'Supprimer le personnage',exact:true}).click();
  await expect(row(page,name)).toHaveCount(0);await page.reload();await expect(row(page,name)).toHaveCount(0);await expect(page.locator('.draft-banner')).toHaveCount(0);
  const fresh=await browser.newContext({storageState:auth,baseURL:origin});
  try{
    expect((await fresh.request.get('/atelier/api/personnages/'+id)).status()).toBe(404);
    expect((await fresh.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character:original.character,revision:original.revision}})).status()).toBe(409);
    const other=await fresh.newPage();await other.goto('/atelier/');await expect(row(other,name)).toHaveCount(0);
  }finally{await fresh.close();}
});

test('Supprimer un brouillon local ne demande aucune suppression au serveur',async({page})=>{
  const name='E2E brouillon à supprimer';let deletes=0;page.on('request',r=>{if(r.method()==='DELETE')deletes++;});
  await page.goto('/atelier/#nouveau');await page.locator('#name').fill(name);await page.locator('#next').click();await page.goto('/atelier/#personnages');
  await row(page,name).getByRole('button',{name:'Supprimer le brouillon de '+name,exact:true}).click();
  await page.getByRole('button',{name:'Supprimer le brouillon',exact:true}).click();
  await expect(row(page,name)).toHaveCount(0);await page.reload();await expect(row(page,name)).toHaveCount(0);expect(deletes).toBe(0);
});

test('Une suppression en échec conserve le personnage et peut être retentée',async({page})=>{
  const name='E2E suppression et réseau';await createThroughUI(page,{name,level:3,domain,vocation:'Protecteur'});await saveAndLocate(page,name);
  await page.locator('a[href="#personnages"]').first().click();
  await page.route('**/atelier/api/personnages/*',async route=>{if(route.request().method()==='DELETE')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Suppression indisponible, réessayez.'})});else await route.continue();});
  await row(page,name).getByRole('button',{name:'Supprimer '+name,exact:true}).click();await page.getByRole('button',{name:'Supprimer le personnage',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Suppression indisponible');await expect(row(page,name)).toBeVisible();
  await page.unroute('**/atelier/api/personnages/*');
  await row(page,name).getByRole('button',{name:'Supprimer '+name,exact:true}).click();await page.getByRole('button',{name:'Supprimer le personnage',exact:true}).click();await expect(row(page,name)).toHaveCount(0);
});
