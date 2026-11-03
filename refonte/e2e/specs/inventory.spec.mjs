import {test,expect,signIn,origin} from '../fixtures.mjs';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../../catalogue.mjs';import {classFixture} from '../../audit/class-fixtures.mjs';import {PDFDocument} from '../../maquette/assets/pdf-lib-1.17.1.mjs';
const catalogue=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
async function fixture(browser){
  const context=await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}}),player=await context.newPage();await signIn(player,'b');
  const id=randomUUID(),state=classFixture(catalogue,'clerc',3,'clerc_domaine_vie');state.divineOrder='Protecteur';state.name='Inventaire '+id.slice(0,8);
  expect((await player.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character:state,revision:0}})).status()).toBe(200);
  return {id,context,player,state,record:async()=>(await(await player.request.get('/atelier/api/personnages/'+id)).json())};
}
async function openAdmin(page,t){
  await page.goto('/atelier/#admin/ouvrir/e2e-account-b/'+t.id);await expect(page.locator('[data-admin-editor]')).toBeVisible();await page.getByRole('tab',{name:'Équipement',exact:true}).click();
  await page.locator('[data-extra-inventory] > details.inventory-add > summary').click();return page.locator('[data-inventory-action=add]');
}
test('Objet donné par l’admin : sauvegarde chez le joueur, PDF, quantité modifiable et retrait confirmé',async({page,browser},info)=>{
  const t=await fixture(browser);try{
    const form=await openAdmin(page,t);await form.getByLabel('Nom de l’objet',{exact:true}).fill('Médaillon des brumes');await form.getByLabel('Quantité',{exact:true}).fill('2');await form.getByLabel('Description / effets à suivre',{exact:true}).fill('Un cadeau du MJ ; effet vérifié à la table.');
    await form.getByRole('button',{name:'Ajouter et enregistrer l’objet'}).click();await expect(page.locator('[data-admin-editor]')).toContainText('Fiche enregistrée dans le compte du joueur.');
    const saved=await t.record();expect(saved.character.inventoryItems).toHaveLength(1);expect(saved.character.inventoryItems[0].quantity).toBe(2);const id=saved.character.inventoryItems[0].id;
    expect((await page.request.get('/atelier/api/personnages/'+t.id)).status()).toBe(404);await page.locator('[data-extra-inventory]').screenshot({path:info.outputPath('objet-ajoute.png')});
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger la fiche PDF'}).click();const download=await pending,path=info.outputPath('fiche-avec-objet.pdf');await download.saveAs(path);const pdf=await PDFDocument.load(await readFile(path));expect(pdf.getForm().getTextField('equipment').getText()).toContain('2 × Médaillon des brumes');
    await t.player.goto('/atelier/#ouvrir/'+t.id);await expect(t.player.getByRole('heading',{name:t.state.name,exact:true})).toBeVisible();await t.player.getByRole('tab',{name:'Équipement',exact:true}).click();
    const item=t.player.locator('[data-inventory-item="'+id+'"]');await expect(item).toContainText('cadeau du MJ');await item.getByText('Modifier cet objet',{exact:true}).click();await item.getByLabel('Quantité',{exact:true}).fill('3');await item.getByRole('button',{name:'Enregistrer cet objet',exact:true}).click();await expect(item).toContainText('×3');
    await expect(t.player.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');expect((await t.record()).character.inventoryItems[0].quantity).toBe(3);
    await page.reload();await expect(page.locator('[data-admin-editor]')).toBeVisible();await page.getByRole('tab',{name:'Équipement',exact:true}).click();await expect(page.locator('[data-inventory-item="'+id+'"]')).toContainText('×3');
    t.player.once('dialog',d=>d.dismiss());await item.getByRole('button',{name:'Retirer cet objet'}).click();expect((await t.record()).character.inventoryItems).toHaveLength(1);
    t.player.once('dialog',d=>d.accept());await item.getByRole('button',{name:'Retirer cet objet'}).click();await expect(t.player.locator('[data-inventory-item]')).toHaveCount(0);await expect(t.player.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');expect((await t.record()).character.inventoryItems).toEqual([]);
  }finally{await t.context.close();}
});
test('Objet et modification concurrente : le texte du joueur reste intact et l’ajout admin doit être revu',async({page,browser})=>{
  const t=await fixture(browser);try{
    const form=await openAdmin(page,t);await form.getByLabel('Nom de l’objet',{exact:true}).fill('Clé du sanctuaire');
    const latest=await t.record();latest.character.details.story='Histoire complétée par le joueur';expect((await t.player.request.put('/atelier/api/personnages/'+t.id,{headers:{Origin:origin},data:{character:latest.character,revision:latest.revision}})).status()).toBe(200);
    await form.getByRole('button',{name:'Ajouter et enregistrer l’objet'}).click();await expect(page.locator('[role=alert]')).toContainText('modifié ailleurs');await expect(page.locator('[data-extra-inventory]')).toContainText('Clé du sanctuaire');
    const current=await t.record();expect(current.character.details.story).toBe('Histoire complétée par le joueur');expect(current.character.inventoryItems).toBeUndefined();
    page.once('dialog',d=>d.accept());await page.locator('[data-admin-editor]').getByRole('link',{name:'Toutes les fiches',exact:false}).click();await expect(page.getByRole('heading',{name:'Toutes les fiches',exact:true})).toBeVisible();
  }finally{await t.context.close();}
});
