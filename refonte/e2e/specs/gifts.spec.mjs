import {test,expect,origin,signIn} from '../fixtures.mjs';
import {randomUUID} from 'node:crypto';
import {catalogue} from '../../tests/spell-fixture.mjs';
import {classFixture} from '../../audit/class-fixtures.mjs';

const headers = {Origin:origin};
const coins = po => ({pc:0,pa:0,pe:0,po,pp:0});
const section = page => page.getByRole('heading',{name:'Dons entre personnages',exact:true}).locator('..');

async function setup(page,browser) {
  const context = await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}});
  const receiver = await context.newPage();
  await signIn(receiver,'b');
  const group = await page.request.post('/atelier/api/groupes',{
    headers,data:{name:'Groupe de dons '+randomUUID().slice(0,8),alias:'Donneur',role:'player'},
  });
  expect(group.status()).toBe(201);
  const {group:{id:groupId},invitationCode} = await group.json();
  expect((await receiver.request.post('/atelier/api/groupes/rejoindre',{
    headers,data:{code:invitationCode,alias:'Destinataire',role:'player'},
  })).status()).toBe(200);
  const itemId = randomUUID();
  const save = async (owner,name,po,item=false) => {
    const state = classFixture(catalogue,'clerc',3,'clerc_domaine_vie',{divineOrder:'Protecteur'});
    state.name = name;
    state.details.story = 'Histoire de '+name;
    state.wallet = {version:1,coins:coins(po),history:[]};
    if (item) state.inventoryItems=[{id:itemId,name:'Dague gravée',quantity:2,description:'Signe de la guilde',catalogueRef:'weapon:dague'}];
    const id = randomUUID();
    const path = '/atelier/api/personnages/'+id;
    expect((await owner.request.put(path,{headers,data:{character:state,revision:0}})).status()).toBe(200);
    expect((await owner.request.post('/atelier/api/groupes/'+groupId+'/personnage',{headers,data:{characterId:id}})).status()).toBe(200);
    return {id,read:async()=> (await owner.request.get(path)).json()};
  };
  const from = await save(page,'Aldric',7,true);
  const to = await save(receiver,'Éline',2);
  const groupPath = '/atelier/#groupes/'+groupId;
  await page.goto(groupPath);
  await receiver.goto(groupPath);
  await expect(section(page)).toBeVisible();
  await expect(section(receiver)).toBeVisible();
  return {receiver,context,groupId,from,to,itemId,groupPath};
}

async function propose(page,t) {
  const panel = section(page);
  await panel.getByText('Proposer un don',{exact:true}).click();
  await panel.getByLabel('Personnage destinataire').selectOption('e2e-account-b');
  await panel.getByLabel('Objet à donner').selectOption('item:'+t.itemId);
  await panel.getByLabel('Quantité de l’objet').fill('1');
  await panel.getByLabel('PO (7 disponibles)',{exact:true}).fill('3');
  await panel.getByRole('button',{name:'Vérifier le don'}).click();
  const dialog=page.getByRole('dialog',{name:'Proposer ce don ?'});
  await expect(dialog).toContainText('1 × Dague gravée · 3 PO');
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/atelier/api/groupes/'+t.groupId+'/dons'&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:'Envoyer l’offre'}).click();
  const posted=await response;
  expect(posted.status()).toBe(200);
  const {gift:{id}}=await posted.json();
  await expect(panel.locator('[data-gift-entry="'+id+'"]')).toContainText('En attente de réponse');
  return id;
}

test('Don d’un objet et de pièces entre joueurs, avec confirmation et fiches réouvertes',async({page,browser},info)=>{
  const t=await setup(page,browser);
  try {
    const id=await propose(page,t);
    expect((await t.from.read()).character.wallet.coins.po).toBe(7);
    expect((await t.to.read()).character.wallet.coins.po).toBe(2);
    const action='/atelier/api/groupes/'+t.groupId+'/dons/'+id+'/accepter';
    expect((await page.request.post(action,{headers,data:{revision:1}})).status()).toBe(403);
    expect((await t.receiver.request.post(action,{headers:{Origin:'https://evil.invalid'},data:{revision:1}})).status()).toBe(403);
    const panel=section(t.receiver);
    await panel.getByRole('button',{name:'Actualiser les dons'}).click();
    const entry=panel.locator('[data-gift-entry="'+id+'"]');
    await expect(entry).toContainText('Signe de la guilde');
    await entry.getByRole('button',{name:'Accepter',exact:true}).click();
    const dialog=t.receiver.getByRole('dialog',{name:'Accepter ce don ?'});
    await expect(dialog).toContainText('1 × Dague gravée · 3 PO');
    await dialog.getByRole('button',{name:'Confirmer la réception'}).click();
    await expect(entry).toContainText('Don remis');
    await entry.screenshot({path:info.outputPath('don-remis.png')});
    const from=await t.from.read(),to=await t.to.read();
    expect(from.character.wallet.coins.po).toBe(4);
    expect(to.character.wallet.coins.po).toBe(5);
    expect(from.character.inventoryItems[0].quantity).toBe(1);
    expect(to.character.inventoryItems).toHaveLength(1);
    expect(to.character.details.story).toBe('Histoire de Éline');
    await entry.getByRole('link',{name:'Ouvrir ma fiche'}).click();
    await expect(t.receiver.locator('.sheet-hero h1')).toHaveText('Éline');
    await t.receiver.getByRole('tab',{name:'Équipement',exact:true}).click();
    await expect(t.receiver.locator('#sheet-panel-equipment')).toContainText('Dague gravée');
  } finally {await t.context.close();}
});

test('Refuser puis retirer une offre conserve les stocks et les soldes',async({page,browser})=>{
  const t=await setup(page,browser);
  try {
    const first=await propose(page,t);
    const incoming=section(t.receiver);
    await incoming.getByRole('button',{name:'Actualiser les dons'}).click();
    const refusal=incoming.locator('[data-gift-entry="'+first+'"]');
    await refusal.getByRole('button',{name:'Refuser',exact:true}).click();
    await expect(refusal).toContainText('Don refusé');
    const second=await propose(page,t);
    const withdrawal=section(page).locator('[data-gift-entry="'+second+'"]');
    await withdrawal.getByRole('button',{name:'Retirer l’offre'}).click();
    await expect(withdrawal).toContainText('Offre retirée');
    expect((await t.from.read()).character.wallet.coins.po).toBe(7);
    expect((await t.from.read()).character.inventoryItems[0].quantity).toBe(2);
    expect((await t.to.read()).character.wallet.coins.po).toBe(2);
    expect((await t.to.read()).character.inventoryItems).toBeUndefined();
  } finally {await t.context.close();}
});
