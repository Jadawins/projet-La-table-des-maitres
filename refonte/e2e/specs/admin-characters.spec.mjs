import {test,expect,signIn,origin} from '../fixtures.mjs';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../../catalogue.mjs';
import {classFixture} from '../../audit/class-fixtures.mjs';
const catalogue=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
async function setup(browser){
  const context=await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}}),player=await context.newPage();await signIn(player,'b');
  const id=randomUUID(),state=classFixture(catalogue,'clerc',3,'clerc_domaine_vie');state.divineOrder='Protecteur';state.name='Fiche partagée '+id.slice(0,8);
  expect((await player.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character:state,revision:0}})).status()).toBe(200);
  return {context,player,id,state,route:'/atelier/api/admin/personnages/e2e-account-b/'+id};
}
async function open(page,t){
  await page.goto('/atelier/#admin');await page.getByLabel('Rechercher une fiche').fill(t.state.name);
  const card=page.locator('[data-admin-character="'+t.id+'"]');await expect(card).toContainText('joueur-b@example.test');await card.getByRole('link',{name:'Ouvrir la fiche'}).click();
  await expect(page.locator('[data-admin-editor]')).toContainText('joueur-b@example.test');await expect(page.getByRole('heading',{name:t.state.name,exact:true})).toBeVisible();
}
test('Toutes les fiches : consultation, notes et correction chez le joueur sans polluer le brouillon administrateur',async({page,browser},info)=>{
  const t=await setup(browser);try{
    await page.goto('/atelier/#nouveau');await page.locator('#name').fill('Mon brouillon personnel');
    const own=await page.evaluate(()=>localStorage.getItem('table-maitre-refonte-maquette-v1:e2e-account-a'));
    await open(page,t);await page.getByRole('tab',{name:'Histoire',exact:true}).click();await page.getByText('Compléter l’identité, les langues et l’histoire',{exact:true}).click();
    await page.locator('[data-sheet-detail=story]').fill('Ajout du MJ : une dette envers la guilde.');
    await page.locator('[data-admin-editor] [data-save-character]').click();await expect(page.locator('[data-admin-editor]')).toContainText('Fiche enregistrée dans le compte du joueur.');
    expect((await(await t.player.request.get('/atelier/api/personnages/'+t.id)).json()).character.details.story).toBe('Ajout du MJ : une dette envers la guilde.');
    expect((await page.request.get('/atelier/api/personnages/'+t.id)).status()).toBe(404);
    expect(await page.evaluate(()=>localStorage.getItem('table-maitre-refonte-maquette-v1:e2e-account-a'))).toBe(own);
    await page.reload();await expect(page.locator('[data-admin-editor]')).toContainText('joueur-b@example.test');
    await page.getByRole('link',{name:'Modifier mes choix',exact:false}).click();
    await page.locator('[data-step="0"]').click();await page.locator('#name').fill(t.state.name+' corrigée');
    await page.locator('[data-admin-editor] [data-save-character]').click();await expect(page.locator('[data-admin-editor]')).toContainText('Fiche enregistrée dans le compte du joueur.');
    expect((await(await t.player.request.get('/atelier/api/personnages/'+t.id)).json()).character.name).toBe(t.state.name+' corrigée');
    await page.screenshot({path:info.outputPath('edition-admin.png')});
    await page.getByRole('link',{name:'Toutes les fiches',exact:false}).click();
    await page.locator('.sidebar a[href="#personnages"]').click();await page.locator('.saved-character').filter({hasText:'Mon brouillon personnel'}).click();await expect(page.locator('#name')).toHaveValue('Mon brouillon personnel');
  }finally{await t.context.close();}
});
test('Conflit : le joueur garde sa correction et le brouillon administrateur reste visible',async({page,browser})=>{
  const t=await setup(browser);try{
    await open(page,t);await page.getByRole('tab',{name:'Histoire',exact:true}).click();await page.getByText('Compléter l’identité, les langues et l’histoire',{exact:true}).click();await page.locator('[data-sheet-detail=story]').fill('Note administrateur en cours.');
    const fresh=await(await t.player.request.get('/atelier/api/personnages/'+t.id)).json();fresh.character.details.story='Correction du joueur';
    expect((await t.player.request.put('/atelier/api/personnages/'+t.id,{headers:{Origin:origin},data:{character:fresh.character,revision:fresh.revision}})).status()).toBe(200);
    await page.locator('[data-admin-editor] [data-save-character]').click();await expect(page.locator('[role=alert]')).toContainText('modifié ailleurs');await expect(page.locator('[data-sheet-detail=story]')).toHaveValue('Note administrateur en cours.');
    expect((await(await t.player.request.get('/atelier/api/personnages/'+t.id)).json()).character.details.story).toBe('Correction du joueur');
    page.once('dialog',d=>d.dismiss());await page.getByRole('link',{name:'Toutes les fiches',exact:false}).click();await expect(page.locator('[data-admin-editor]')).toBeVisible();
    page.once('dialog',d=>d.accept());await page.getByRole('link',{name:'Toutes les fiches',exact:false}).click();await expect(page.getByRole('heading',{name:'Toutes les fiches',exact:true})).toBeVisible();
  }finally{await t.context.close();}
});
test('Compte joueur : aucune consultation ni modification globale, même avec une URL directe',async({page,browser})=>{
  const t=await setup(browser);try{
    expect((await t.player.request.get(t.route)).status()).toBe(403);expect((await t.player.request.post(t.route,{headers:{Origin:origin},data:{character:t.state,revision:1}})).status()).toBe(403);
    await t.player.goto('/atelier/#admin/ouvrir/e2e-account-b/'+t.id);await expect(t.player.getByRole('heading',{name:'Accès réservé'})).toBeVisible();
    expect((await page.request.post(t.route,{headers:{Origin:'https://evil.invalid'},data:{character:t.state,revision:1}})).status()).toBe(403);
  }finally{await t.context.close();}
});
