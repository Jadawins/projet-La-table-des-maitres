import {test,expect,signIn,origin} from '../fixtures.mjs';
import {randomUUID} from 'node:crypto';
const post=(page,path,data)=>page.request.post('/atelier/api/groupes'+path,{headers:{Origin:origin},data});
async function setup(page){
  await page.goto('/atelier/');const created=await(await post(page,'',{name:'Bestiaire '+randomUUID(),alias:'Wiwi'})).json();
  const id=created.group.id;expect((await post(page,'/'+id+'/combat',{type:'create',name:'Les gardiens du pont'})).status()).toBe(201);
  await page.goto('/atelier/#combat/'+id);await expect(page.getByRole('heading',{name:'Ajouter depuis le bestiaire'})).toBeVisible();await expect(page.locator('[data-bestiary-count]')).toContainText('3 profils');
  return {id,code:created.invitationCode,panel:page.locator('[data-bestiary-panel]')};
}
async function search(panel,q){await panel.getByLabel('Nom du monstre',{exact:true}).fill(q);await panel.getByRole('button',{name:'Rechercher',exact:true}).click();}
const card=(page,name)=>page.locator('.combat-participant').filter({has:page.getByRole('heading',{name:new RegExp('^'+name+'$')})});
test('Bestiaire : aperçu, deux exemplaires indépendants et profil réservé au MJ après révélation',async({page,browser},info)=>{
  const t=await setup(page);await search(t.panel,'goblin');await expect(t.panel.locator('[data-bestiary-results] .bestiary-result')).toHaveCount(1);
  await t.panel.getByRole('button',{name:'Voir le profil de Gobelin',exact:true}).click();await expect(t.panel.locator('[data-bestiary-detail]')).toContainText('Cimeterre');
  await t.panel.getByLabel('Nombre d’exemplaires').fill('2');await page.screenshot({path:info.outputPath('bestiary-preview.png')});
  await t.panel.getByRole('button',{name:'Ajouter au combat',exact:true}).click();await expect(page.locator('.combat-participant')).toHaveCount(2);
  await expect(card(page,'Gobelin 1')).toContainText('7 / 7');await expect(card(page,'Gobelin 2')).toContainText('7 / 7');
  await card(page,'Gobelin 1').getByText('Gérer ce participant',{exact:true}).click();const form=card(page,'Gobelin 1').locator('[data-combat-form="health"]');await form.getByLabel('Montant pour Gobelin 1').fill('3');await form.getByRole('button',{name:'Appliquer les PV'}).click();
  await expect(card(page,'Gobelin 1')).toContainText('4 / 7');await expect(card(page,'Gobelin 2')).toContainText('7 / 7');
  await page.reload();await expect(card(page,'Gobelin 1')).toContainText('4 / 7');await card(page,'Gobelin 1').getByText('Profil du bestiaire utilisé',{exact:true}).click();await expect(card(page,'Gobelin 1').locator('.bestiary-snapshot')).toContainText('Cimeterre');
  const context=await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}});try{
    const other=await context.newPage();await signIn(other,'b');await post(other,'/rejoindre',{code:t.code,alias:'Aline'});
    await other.goto('/atelier/#combat/'+t.id);await expect(other.getByRole('heading',{name:'Les gardiens du pont'})).toBeVisible();await expect(other.locator('.combat-participant')).toHaveCount(0);await expect(other.locator('[data-bestiary-panel]')).toHaveCount(0);
    await card(page,'Gobelin 1').getByRole('button',{name:'Révéler aux joueurs'}).click();await other.getByRole('button',{name:'Actualiser',exact:true}).click();await expect(card(other,'Gobelin 1')).toBeVisible();
    const value=await(await other.request.get('/atelier/api/groupes/'+t.id+'/combat')).json();expect(value.combat.participants[0].bestiary).toBeUndefined();expect(JSON.stringify(value)).not.toContain('Cimeterre');
    expect((await other.request.get('/atelier/api/groupes/'+t.id+'/bestiaire/goblin')).status()).toBe(403);await expect(other.locator('#content')).not.toContainText('Gobelin 2');
  }finally{await context.close();}
});
test('Bestiaire : recherche sans accents, filtres type/FP, résultats vides et validation',async({page})=>{
  const {panel}=await setup(page);await search(panel,'AIGLE GEANT');await expect(panel.locator('[data-bestiary-count]')).toContainText('1 résultat');await expect(panel.locator('.bestiary-result')).toContainText('Aigle géant');
  await panel.getByLabel('Nom du monstre',{exact:true}).fill('');await panel.getByRole('combobox',{name:'Type de créature',exact:true}).selectOption('Beast');await panel.getByLabel('FP maximum').fill('1/4');await panel.getByRole('button',{name:'Rechercher',exact:true}).click();await expect(panel.locator('.bestiary-result')).toContainText('Loup');await expect(panel.locator('[data-bestiary-count]')).toContainText('1 résultat');
  await search(panel,'aucunresultat');await expect(panel.locator('[data-bestiary-results]')).toContainText('Aucun monstre');
  await panel.getByLabel('FP minimum').fill('foo');await panel.getByRole('button',{name:'Rechercher',exact:true}).click();await expect(panel.locator('[data-bestiary-feedback]')).toContainText('filtres');
});
test('Bestiaire indisponible : la saisie manuelle et le combat restent utilisables',async({page})=>{
  await page.route('**/bestiaire?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Bestiaire indisponible pour ce contrôle.'})}));
  await page.goto('/atelier/');const created=await(await post(page,'',{name:'Source indisponible '+randomUUID(),alias:'Wiwi'})).json();await post(page,'/'+created.group.id+'/combat',{type:'create',name:'Combat manuel'});
  await page.goto('/atelier/#combat/'+created.group.id);await expect(page.locator('[data-bestiary-feedback]')).toContainText('Bestiaire indisponible');
  const manual=page.locator('[data-combat-form="npc"]');await manual.getByLabel('Nom de l’adversaire').fill('Sentinelle');await manual.getByLabel('PV maximum').fill('8');await manual.getByLabel('Classe d’armure').fill('12');await manual.getByRole('button',{name:'Ajouter l’adversaire'}).click();await expect(card(page,'Sentinelle')).toContainText('8 / 8');
});
