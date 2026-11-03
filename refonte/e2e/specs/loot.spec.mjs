import {test,expect,origin,signIn} from '../fixtures.mjs';import {randomUUID} from 'node:crypto';import {catalogue} from '../../tests/spell-fixture.mjs';import {classFixture} from '../../audit/class-fixtures.mjs';
const post=(page,path,data)=>page.request.post('/atelier/api/groupes'+path,{headers:{Origin:origin},data});
async function receiver(browser){const context=await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}}),page=await context.newPage();await signIn(page,'b');return {context,page,userId:'e2e-account-b'};}
async function character(page,name){const id=randomUUID(),state=classFixture(catalogue,'clerc',3,'clerc_domaine_vie',{divineOrder:'Protecteur'});state.name=name;expect((await page.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character:state,revision:0}})).status()).toBe(200);return {id,state,record:async()=>(await(await page.request.get('/atelier/api/personnages/'+id)).json())};}
async function fixture(page,browser,{attachMJ=false}={}){
  const p=await receiver(browser),created=await(await post(page,'',{name:'Butin '+randomUUID(),alias:'Le Gardien',role:'mj'})).json(),groupId=created.group.id;expect((await post(p.page,'/rejoindre',{code:created.invitationCode,alias:'Aline',role:'player'})).status()).toBe(200);
  const pc=await character(p.page,'Receveuse '+randomUUID().slice(0,8));await post(p.page,'/'+groupId+'/personnage',{characterId:pc.id});let mc;if(attachMJ){mc=await character(page,'Voyageur '+randomUUID().slice(0,8));await post(page,'/'+groupId+'/personnage',{characterId:mc.id});}
  await page.goto('/atelier/#groupes/'+groupId);await expect(page.getByRole('heading',{name:'Distribuer du butin',exact:true})).toBeVisible();await page.locator('[data-loot-compose] > summary').click();return {p,pc,mc,groupId};
}
async function prepare(page,ids,{item=true,label='Butin de la tour'}={}){
  const form=page.locator('[data-loot-form]');await form.getByLabel('Nom du butin',{exact:true}).fill(label);for(const id of ids)await form.locator('[name=recipient][value="'+id+'"]').check();await form.getByLabel('PO par personnage',{exact:true}).fill('5');
  if(item){await form.getByLabel('Ajouter un objet au butin',{exact:true}).check();await form.getByLabel('Objet du catalogue',{exact:true}).selectOption('weapon:dague');await form.getByLabel('Quantité par personnage',{exact:true}).fill('2');}
  await form.getByRole('button',{name:'Préparer le récapitulatif'}).click();await expect(page.getByRole('dialog',{name:'Attribuer ce butin ?'})).toBeVisible();
}
async function confirm(page){await page.getByRole('dialog').getByRole('button',{name:/^Confirmer \d+ attribution/}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('[data-loot-feedback]')).toContainText('Butin attribué.');}
test('Butin choisi : aperçu et annulation sans gain, confirmation multiple, fiches et historique privé',async({page,browser},info)=>{
  const t=await fixture(page,browser,{attachMJ:true});try{
    await expect(page.locator('[data-loot-form] [name=recipient]:checked')).toHaveCount(0);await prepare(page,['e2e-account-a',t.p.userId]);expect((await t.pc.record()).character.wallet).toBeUndefined();await page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).click();await expect(page.locator('[data-loot-feedback]')).toContainText('Préparation abandonnée');expect((await t.pc.record()).revision).toBe(1);
    await prepare(page,['e2e-account-a',t.p.userId]);await page.getByRole('dialog').screenshot({path:info.outputPath('butin-recapitulatif.png')});await confirm(page);for(const actor of [t.pc,t.mc]){const r=await actor.record();expect(r.character.wallet.coins.po).toBe(27);expect(r.character.inventoryItems[0].quantity).toBe(2);expect(r.character.inventoryItems[0].catalogueRef).toBe('weapon:dague');expect(r.character.equipmentState).toBeUndefined();}
    await page.locator('.group-loot-panel').screenshot({path:info.outputPath('butin-distribue.png')});await t.p.page.goto('/atelier/#groupes/'+t.groupId);await expect(t.p.page.getByRole('heading',{name:'Butin de votre personnage'})).toBeVisible();const entries=t.p.page.locator('[data-loot-entry]');await expect(entries).toHaveCount(1);await expect(entries).toContainText(t.pc.state.name);await expect(entries).not.toContainText(t.mc.state.name);await expect(t.p.page.locator('[data-loot-form]')).toHaveCount(0);await entries.getByRole('link',{name:'Ouvrir ma fiche'}).click();await t.p.page.getByRole('tab',{name:'Équipement',exact:true}).click();await expect(t.p.page.locator('[data-inventory-item]')).toContainText('Dague');
  }finally{await t.p.context.close();}
});
test('Fiche changée après aperçu : revue des restants, aucune histoire écrasée et aucun second gain au premier',async({page,browser})=>{
  const t=await fixture(page,browser,{attachMJ:true});try{
    await prepare(page,['e2e-account-a',t.p.userId]);const r=await t.pc.record();r.character.details.story='Histoire écrite pendant la préparation';expect((await t.p.page.request.put('/atelier/api/personnages/'+t.pc.id,{headers:{Origin:origin},data:{character:r.character,revision:r.revision}})).status()).toBe(200);await page.getByRole('dialog').getByRole('button',{name:/^Confirmer \d+ attribution/}).click();await expect(page.locator('[data-loot-feedback]')).toContainText('restent en attente');expect((await t.mc.record()).revision).toBe(2);expect((await t.pc.record()).character.wallet).toBeUndefined();
    await page.locator('[data-loot-entry]').getByRole('button',{name:'Revoir les fiches restantes'}).click();await expect(page.getByRole('dialog')).toContainText('déjà reçu');await confirm(page);expect((await t.mc.record()).revision).toBe(2);const final=await t.pc.record();expect(final.character.details.story).toBe(r.character.details.story);expect(final.character.wallet.coins.po).toBe(27);
  }finally{await t.p.context.close();}
});
test('Accusé de confirmation perdu : actualisation et réouverture conservent un seul objet et un seul mouvement',async({page,browser})=>{
  const t=await fixture(page,browser);try{
    await prepare(page,[t.p.userId]);await page.route('**/butin/*/confirmer',async route=>{await route.fetch();await route.abort();await page.unroute('**/butin/*/confirmer');});await page.getByRole('dialog').getByRole('button',{name:/^Confirmer \d+ attribution/}).click();await expect(page.locator('[data-loot-entry]')).toContainText('Butin attribué');let r=await t.pc.record();expect(r.revision).toBe(2);expect(r.character.wallet.history).toHaveLength(1);await page.reload();await expect(page.locator('[data-loot-entry]')).toContainText('Butin attribué');expect((await t.pc.record()).revision).toBe(2);await expect(page.locator('[data-loot-open]')).toHaveCount(0);
  }finally{await t.p.context.close();}
});
test('Butin privé : joueur interdit de préparation, aucun autre compte admis et membre détaché non crédité',async({page,browser})=>{
  const t=await fixture(page,browser);try{
    const input={id:randomUUID(),label:'Interdit',recipientIds:['e2e-account-a'],payload:{coins:{pc:0,pa:0,pe:0,po:1,pp:0}}};expect((await post(t.p.page,'/'+t.groupId+'/butin',input)).status()).toBe(403);
    await prepare(page,[t.p.userId],{item:false});await post(t.p.page,'/'+t.groupId+'/personnage',{characterId:null});await page.getByRole('dialog').getByRole('button',{name:/^Confirmer \d+ attribution/}).click();await expect(page.locator('[data-loot-feedback]')).toContainText('restent en attente');expect((await t.pc.record()).revision).toBe(1);await expect(page.locator('[data-loot-entry]')).toContainText('personnage associé a changé');
    expect((await page.request.get('/atelier/api/personnages/'+t.pc.id)).status()).toBe(404);
  }finally{await t.p.context.close();}
});
