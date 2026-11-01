import {test,expect,signIn,origin} from '../fixtures.mjs';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
const catalogue=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
const post=(page,path,data)=>page.request.post('/atelier/api/groupes'+path,{headers:{Origin:origin},data});
async function table(page,browser,{pc=false}={}){
  const response=await post(page,'',{name:'Combat '+randomUUID(),alias:'Wiwi'}),created=await response.json();expect(response.status()).toBe(201);
  const context=await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}}),other=await context.newPage();await signIn(other,'b');
  expect((await post(other,'/rejoindre',{code:created.invitationCode,alias:'Aline'})).status()).toBe(200);
  let characterId;
  if(pc){characterId=randomUUID();const state=originFixture(catalogue,'barbare',1,{speciesId:'orc'},'marin');state.name='Héroïne du pont';
    expect((await other.request.put('/atelier/api/personnages/'+characterId,{headers:{Origin:origin},data:{character:state,revision:0}})).status()).toBe(200);
    expect((await post(other,'/'+created.group.id+'/personnage',{characterId})).status()).toBe(200);
  }
  const groupId=created.group.id;await page.goto('/atelier/#groupes/'+groupId);await page.getByRole('link',{name:'Ouvrir le combat'}).click();
  await page.getByLabel('Nom du combat').fill('Embuscade au pont');await page.getByRole('button',{name:'Préparer le combat',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Embuscade au pont',exact:true})).toBeVisible();
  await other.goto('/atelier/#combat/'+groupId);await expect(other.getByRole('heading',{name:'Embuscade au pont',exact:true})).toBeVisible();
  return {context,other,groupId,characterId};
}
async function add(page,name,hp=12){const form=page.locator('[data-combat-form="npc"]');await form.getByLabel('Nom de l’adversaire').fill(name);await form.getByLabel('PV maximum').fill(String(hp));await form.getByLabel('Classe d’armure').fill('13');await form.getByRole('button',{name:'Ajouter l’adversaire'}).click();await expect(page.locator('.combat-participant').filter({hasText:name})).toHaveCount(1);}
const row=(page,name)=>page.locator('.combat-participant').filter({has:page.getByRole('heading',{name:new RegExp('^'+name)})});
async function open(page,name){await expect(page.locator('#content')).toHaveAttribute('aria-busy','false');const card=row(page,name);if(await card.locator('details').getAttribute('open')===null)await card.getByText('Gérer ce participant',{exact:true}).click();return card;}
async function init(page,name,value){const card=await open(page,name);await card.getByLabel('Initiative de '+name,{exact:true}).fill(String(value));await card.getByRole('button',{name:'Enregistrer l’initiative',exact:true}).click();await expect(card.locator('.combat-initiative')).toContainText(String(value));}
async function refresh(page){await page.getByRole('button',{name:'Actualiser',exact:true}).click();await expect(page.locator('#content')).toHaveAttribute('aria-busy','false');await expect(page.locator('[data-combat-feedback]')).toHaveText('Enregistré.');}
test('Combat MJ : préparation, adversaires secrets, initiatives, rounds, pause et fin persistante',async({page,browser},info)=>{
  await page.goto('/atelier/');const t=await table(page,browser);try{
    await add(page,'Gobelin du pont');await add(page,'Archer caché');await page.getByRole('button',{name:'Démarrer le combat'}).click();await expect(page.locator('[data-combat-feedback]')).toContainText('initiatives');
    await init(page,'Gobelin du pont',15);await init(page,'Archer caché',10);
    await row(page,'Gobelin du pont').getByRole('button',{name:'Révéler aux joueurs'}).click();await refresh(t.other);
    await expect(t.other.getByRole('heading',{name:'Gobelin du pont',exact:true})).toBeVisible();await expect(t.other.locator('#content')).not.toContainText('Archer caché');
    await expect(t.other.getByRole('button',{name:'Démarrer le combat'})).toHaveCount(0);await expect(t.other.getByRole('button',{name:'Appliquer les PV'})).toHaveCount(0);
    await page.getByRole('button',{name:'Démarrer le combat'}).click();await expect(page.locator('.combat-current')).toContainText('Gobelin du pont');
    await page.getByRole('button',{name:'Tour suivant',exact:true}).click();await expect(page.locator('.combat-current')).toContainText('Archer caché');await refresh(t.other);await expect(t.other.locator('.combat-status')).toContainText('Tour géré par le MJ');
    await page.getByRole('button',{name:'Tour suivant',exact:true}).click();await expect(page.locator('.combat-status')).toContainText('Round 2');
    await page.getByRole('button',{name:'Mettre en pause'}).click();await expect(page.getByRole('button',{name:'Reprendre le combat'})).toBeVisible();await page.reload();await expect(page.locator('.combat-status')).toContainText('En pause');
    await page.getByRole('button',{name:'Reprendre le combat'}).click();await page.screenshot({path:info.outputPath('combat-mj.png')});
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Terminer le combat',exact:true}).click();await expect(page.locator('.combat-status')).toContainText('Terminé');await expect(page.getByRole('button',{name:'Préparer le combat',exact:true})).toBeVisible();
  }finally{await t.context.close();}
});
test('Combat joueur : initiative saisie, PV partagés avec la fiche, états et jet de mort sans lancer automatique',async({page,browser},info)=>{
  await page.goto('/atelier/');const t=await table(page,browser,{pc:true});try{
    const maxHp=(await(await page.request.get('/atelier/api/groupes/'+t.groupId+'/combat')).json()).combat.participants[0].maxHp;
    await init(t.other,'Héroïne du pont',16);
    let card=await open(t.other,'Héroïne du pont');await card.getByRole('button',{name:'Commencer le suivi'}).click();
    card=await open(t.other,'Héroïne du pont');const health=card.locator('[data-combat-form="health"]');await health.getByLabel('Action pour Héroïne du pont').selectOption('damage');await health.getByLabel('Montant pour Héroïne du pont').fill('3');await health.getByRole('button',{name:'Appliquer les PV'}).click();
    await expect(t.other.locator('#content')).toHaveAttribute('aria-busy','false');
    const saved=await(await t.other.request.get('/atelier/api/personnages/'+t.characterId)).json();expect(saved.character.playState.hpLost).toBe(3);
    await refresh(page);await expect(row(page,'Héroïne du pont')).toContainText((maxHp-3)+' / '+maxHp);
    card=await open(t.other,'Héroïne du pont');const condition=card.locator('[data-combat-form="condition"]');await condition.getByLabel('État de Héroïne du pont').selectOption('poisoned');await condition.getByRole('button',{name:'Appliquer l’état'}).click();await expect(row(t.other,'Héroïne du pont')).toContainText('Empoisonné');
    card=await open(t.other,'Héroïne du pont');await card.locator('[data-combat-form="health"]').getByLabel('Montant pour Héroïne du pont').fill('50');await card.getByRole('button',{name:'Appliquer les PV'}).click();
    card=await open(t.other,'Héroïne du pont');const death=card.locator('[data-combat-form="death"]');await death.getByLabel('d20 naturel').fill('20');await death.getByRole('button',{name:'Enregistrer le jet de mort'}).click();await expect(row(t.other,'Héroïne du pont')).toContainText('1 / '+maxHp);
    await t.other.reload();await expect(row(t.other,'Héroïne du pont')).toContainText('1 / '+maxHp);await t.other.screenshot({path:info.outputPath('combat-joueur.png')});
    const final=await(await t.other.request.get('/atelier/api/personnages/'+t.characterId)).json();expect(final.character.playState.hpLost).toBe(maxHp-1);expect(final.character.scores).toEqual(saved.character.scores);
  }finally{await t.context.close();}
});
test('Combat privé : refus des commandes MJ, fiche détachée et membre retiré',async({page,browser})=>{
  await page.goto('/atelier/');const t=await table(page,browser,{pc:true});try{
    const snapshot=await(await t.other.request.get('/atelier/api/groupes/'+t.groupId+'/combat')).json();
    for(const type of ['add-npc','start','finish'])expect((await post(t.other,'/'+t.groupId+'/combat',{type,combatId:snapshot.combat.id,revision:snapshot.combat.revision,confirmed:true,name:'Intrus',maxHp:10,ac:10})).status()).toBe(403);
    await post(t.other,'/'+t.groupId+'/personnage',{characterId:null});await refresh(page);await expect(row(page,'Héroïne du pont')).toContainText('Fiche indisponible');
    await post(page,'/'+t.groupId+'/retirer',{userId:'e2e-account-b'});await t.other.reload();await expect(t.other.getByRole('heading',{name:'Combat inaccessible'})).toBeVisible();
  }finally{await t.context.close();}
});
