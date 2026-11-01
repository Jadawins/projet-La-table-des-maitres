import {test,expect,signIn,origin} from '../fixtures.mjs';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
async function create(page,name='Table '+randomUUID()) {
  await page.goto('/atelier/');
  await page.locator('.sidebar a[href="#groupes"]').click();
  const form=page.locator('[data-group-form="create"]');
  await form.getByLabel('Nom du groupe').fill(name);await form.getByLabel('Votre nom à la table').fill('Wiwi');
  await form.getByLabel('Présentation').fill('Une aventure à partager.');
  await form.getByRole('button',{name:'Créer mon groupe'}).click();
  await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  return {id:page.url().split('#groupes/')[1],code:await page.locator('#group-invitation-code').inputValue(),name};
}
async function join(page,code,alias='Aline') {
  await page.goto('/atelier/#groupes');const form=page.locator('[data-group-form="join"]');
  await form.getByLabel('Code d’invitation').fill(code);await form.getByLabel('Votre nom à la table').fill(alias);
  await form.getByRole('button',{name:'Rejoindre le groupe',exact:true}).click();
}
async function second(browser){const context=await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}});const page=await context.newPage();await signIn(page,'b');return {context,page};}
async function confirmAction(page,label,accept=true){page.once('dialog',dialog=>accept?dialog.accept():dialog.dismiss());await page.getByRole('button',{name:label,exact:true}).click();}
const post=(page,path,data)=>page.request.post('/atelier/api/groupes'+path,{headers:{Origin:origin},data});
test('Groupe : création MJ, inscription joueur, choix de fiche et réouverture',async({page,browser},info)=>{
  const table=await create(page);await page.screenshot({path:info.outputPath('groupe-mj.png')});
  const other=await second(browser);try{
    await join(other.page,table.code);await expect(other.page.getByRole('heading',{name:table.name,exact:true})).toBeVisible();
    await expect(other.page.getByRole('heading',{name:'Inviter vos joueurs'})).toHaveCount(0);
    await expect(other.page.locator('.group-members')).toContainText('Aline');
    const id=randomUUID(),state=originFixture(c,'barbare',1,{speciesId:'orc'},'marin');state.name='E2E fiche groupe '+id;
    const response=await other.page.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character:state,revision:0}});expect(response.status()).toBe(200);
    await other.page.getByRole('button',{name:'Actualiser le groupe'}).click();
    await other.page.getByLabel('Personnage enregistré').selectOption(id);
    await other.page.getByRole('button',{name:'Enregistrer mon choix'}).click();
    await expect(other.page.locator('[data-group-feedback]')).toContainText('enregistré');
    await page.getByRole('button',{name:'Actualiser le groupe'}).click();await expect(page.locator('.group-members')).toContainText(state.name);
    expect((await post(page,'/'+table.id+'/personnage',{characterId:id})).status()).toBe(404);
    await other.page.reload();await expect(other.page.getByLabel('Personnage enregistré')).toHaveValue(id);
    await other.page.screenshot({path:info.outputPath('groupe-joueur.png')});
    const ownTable=await create(other.page,'Autre table '+id);await expect(other.page.getByRole('heading',{name:'Inviter vos joueurs'})).toBeVisible();
    expect((await other.page.request.get('/atelier/api/admin/metrics')).status()).toBe(403);
    await other.page.goto('/atelier/#groupes');await expect(other.page.getByRole('link',{name:table.name,exact:true})).toBeVisible();await expect(other.page.getByRole('link',{name:ownTable.name,exact:true})).toBeVisible();
  }finally{await other.context.close();}
});
test('Invitations : fermeture, nouveau code, départ et exclusion sans perte de fiche',async({page,browser})=>{
  const table=await create(page);const other=await second(browser);try{
    await confirmAction(page,'Fermer les invitations');await expect(page.locator('.group-invite')).toContainText('fermées');
    await join(other.page,table.code);await expect(other.page.locator('[data-group-feedback]')).toContainText('invalide ou expiré');
    await confirmAction(page,'Créer un nouveau code');const code=await page.locator('#group-invitation-code').inputValue();expect(code).not.toBe(table.code);
    await join(other.page,code);await expect(other.page.getByRole('heading',{name:table.name,exact:true})).toBeVisible();
    await confirmAction(other.page,'Quitter le groupe',false);await expect(other.page.getByRole('heading',{name:table.name,exact:true})).toBeVisible();
    await confirmAction(other.page,'Quitter le groupe');await expect(other.page.getByRole('heading',{name:'Mes groupes',exact:true})).toBeVisible();
    await join(other.page,code);await expect(other.page.getByRole('heading',{name:table.name,exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Actualiser le groupe'}).click();await confirmAction(page,'Retirer Aline');
    await expect(page.locator('.group-members')).not.toContainText('Aline');await expect(page.locator('.group-invite')).toContainText('fermées');
    await other.page.reload();await expect(other.page.locator('[data-group-feedback]')).toContainText('introuvable');
    await join(other.page,code);await expect(other.page.locator('[data-group-feedback]')).toContainText('invalide ou expiré');
  }finally{await other.context.close();}
});
test('Groupe privé : autre compte refusé, texte affiché sans HTML et fiche étrangère inaccessible',async({page,browser})=>{
  const name='<img src=x onerror=alert(1)> '+randomUUID(),table=await create(page,name);await expect(page.locator('#content img')).toHaveCount(0);
  const other=await second(browser);try{
    expect((await other.page.request.get('/atelier/api/groupes/'+table.id)).status()).toBe(404);
    for(const action of ['invitation','fermer','personnage','retirer','archiver'])expect((await post(other.page,'/'+table.id+'/'+action,{userId:'e2e-account-a',characterId:randomUUID()})).status()).toBe(404);
    await join(other.page,table.code);await expect(other.page.getByRole('heading',{name,exact:true})).toBeVisible();
    for(const action of ['invitation','fermer','retirer','archiver'])expect((await post(other.page,'/'+table.id+'/'+action,{userId:'e2e-account-a'})).status()).toBe(403);
    expect((await other.page.request.get('/atelier/api/personnages/'+randomUUID())).status()).toBe(404);
    await expect(other.page.getByRole('button',{name:'Créer un nouveau code'})).toHaveCount(0);
  }finally{await other.context.close();}
});
test('Archiver : confirmation, disparition pour les deux comptes et code désactivé',async({page,browser})=>{
  const table=await create(page),other=await second(browser);try{
    await join(other.page,table.code);await expect(other.page.getByRole('heading',{name:table.name,exact:true})).toBeVisible();
    await confirmAction(page,'Archiver le groupe',false);await expect(page.getByRole('heading',{name:table.name,exact:true})).toBeVisible();
    await confirmAction(page,'Archiver le groupe');await expect(page.getByRole('heading',{name:'Mes groupes',exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:table.name,exact:true})).toHaveCount(0);
    expect((await other.page.request.get('/atelier/api/groupes/'+table.id)).status()).toBe(404);
    await join(other.page,table.code);await expect(other.page.locator('[data-group-feedback]')).toContainText('invalide ou expiré');
  }finally{await other.context.close();}
});
