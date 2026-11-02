import {test,expect,signIn,origin} from '../fixtures.mjs';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
const post=(page,path,data)=>page.request.post('/atelier/api/groupes'+path,{headers:{Origin:origin},data});
async function setup(page,browser){
  await page.goto('/atelier/');const created=await(await post(page,'',{name:'Jets '+randomUUID(),alias:'Wiwi'})).json(),id=created.group.id;
  const context=await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}}),player=await context.newPage();await signIn(player,'b');await post(player,'/rejoindre',{code:created.invitationCode,alias:'Aline'});
  const characterId=randomUUID(),state=originFixture(c,'barbare',1,{speciesId:'orc'},'marin');state.name='Héroïne des jets';
  expect((await player.request.put('/atelier/api/personnages/'+characterId,{headers:{Origin:origin},data:{character:state,revision:0}})).status()).toBe(200);
  await post(player,'/'+id+'/personnage',{characterId});let value=await(await post(page,'/'+id+'/combat',{type:'create',name:'Attaques au pont'})).json();
  const act=async data=>{const response=await post(page,'/'+id+'/combat',{combatId:value.combat.id,revision:value.combat.revision,...data});expect(response.status()).toBe(200);value=await response.json();};
  await act({type:'add-bestiary',monsterId:'goblin',quantity:2});const pc=value.combat.participants.find(p=>p.kind==='pc'),npcs=value.combat.participants.filter(p=>p.kind==='npc');
  await act({type:'visible',participantId:npcs[0].id,value:true});
  for(const p of value.combat.participants)await act({type:'initiative',participantId:p.id,value:p.kind==='pc'?15:10});await act({type:'start'});
  await page.goto('/atelier/#combat/'+id);await player.goto('/atelier/#combat/'+id);await expect(player.getByRole('heading',{name:'Attaques et jets'})).toBeVisible();
  return {id,context,player,pc,npcs,characterId};
}
const panel=page=>page.locator('[data-attack-panel]');
async function prepare(page,attacker,target,attackId){
  const root=panel(page);await root.getByLabel('Attaquant',{exact:true}).selectOption(attacker);
  await root.getByRole('button',{name:'Préparer / actualiser sans lancer',exact:true}).click();
  await root.getByLabel('Attaque choisie').selectOption(attackId);await root.getByLabel('Cible de l’attaque').selectOption(target);return root.locator('[data-attack-roll]');
}
async function refresh(page){await page.getByRole('button',{name:'Actualiser',exact:true}).click();await expect(page.locator('#content')).toHaveAttribute('aria-busy','false');}
test('Dés physiques du joueur, dégâts en attente puis confirmation du MJ sans double application',async({page,browser},info)=>{
  const t=await setup(page,browser);try{
    const form=await prepare(t.player,t.pc.id,t.npcs[0].id,'weapon:0:normal');await expect(form.getByLabel('Dés pour toucher')).toHaveValue('physical');
    await expect(form.getByLabel('Cible de l’attaque').locator('option[value="'+t.npcs[1].id+'"]')).toHaveCount(0);
    await form.getByLabel('Dé 1 sur 20',{exact:true}).fill('18');await form.getByRole('button',{name:'Valider le jet physique',exact:true}).click();
    const ticket=panel(t.player).locator('[data-attack-ticket]');await expect(ticket).toHaveCount(1);const id=await ticket.getAttribute('data-attack-ticket');
    await expect(ticket).not.toContainText('CA 15');await expect(ticket.locator('[data-damage-roll]')).toBeVisible();
    const damage=ticket.locator('[data-damage-roll]');await damage.getByLabel('Dé 1 sur 12',{exact:true}).fill('1');await damage.getByRole('button',{name:'Valider les dés de dégâts',exact:true}).click();
    await expect(ticket).toContainText('En attente de validation du MJ');await expect(ticket.getByRole('button',{name:'Confirmer et appliquer'})).toHaveCount(0);
    const before=await(await page.request.get('/atelier/api/groupes/'+t.id+'/combat')).json();expect(before.combat.participants.find(p=>p.id===t.npcs[0].id).currentHp).toBe(7);
    expect((await post(t.player,'/'+t.id+'/combat/attaques',{type:'confirm',ticketId:id,confirmed:true})).status()).toBe(403);
    await refresh(page);const review=panel(page).locator('[data-attack-ticket="'+id+'"]');await review.locator(':scope > summary').click();await expect(review).toContainText('CA 15');
    await page.screenshot({path:info.outputPath('attacks-mj-confirmation.png')});await review.locator('[data-attack-confirm]').getByRole('button',{name:'Confirmer et appliquer',exact:true}).click();
    await expect(review).toContainText('2 dégâts confirmés et appliqués');
    const repeat=await post(page,'/'+t.id+'/combat/attaques',{type:'confirm',ticketId:id,confirmed:true});expect(repeat.status()).toBe(200);
    const after=await repeat.json();expect(after.state.combat.participants.find(p=>p.id===t.npcs[0].id).currentHp).toBe(5);
    await refresh(t.player);await expect(panel(t.player).locator('[data-attack-ticket]')).toContainText('Résultat confirmé par le MJ');
  }finally{await t.context.close();}
});
test('Dés de l’application : avantage visible, choix indépendant pour les dégâts et préférences mémorisées',async({page,browser},info)=>{
  const t=await setup(page,browser);try{
    let rollRequests=0;t.player.on('request',req=>{if(req.method()==='POST'&&req.url().endsWith('/combat/attaques')&&['roll','damage'].includes(req.postDataJSON()?.type))rollRequests++;});
    const form=await prepare(t.player,t.pc.id,t.npcs[0].id,'weapon:0:normal');expect(rollRequests).toBe(0);
    await form.getByLabel('Dés pour toucher').selectOption('app');await form.getByLabel('Avantage ou désavantage').selectOption('advantage');expect(rollRequests).toBe(0);
    await form.getByRole('button',{name:'Lancer le d20',exact:true}).click();const ticket=panel(t.player).locator('[data-attack-ticket]');await expect(ticket).toHaveCount(1);await expect(ticket.locator('.attack-dice').first().locator('.attack-die')).toHaveCount(2);await expect(ticket.locator('.attack-discarded')).toHaveCount(1);
    const damage=ticket.locator('[data-damage-roll]');await expect(damage.getByLabel('Dés pour les dégâts')).toHaveValue('physical');expect(rollRequests).toBe(1);
    const prefs=await t.player.evaluate(()=>JSON.parse(localStorage.getItem('myrpgtable.attack-dice.e2e-account-b')));expect(prefs.attack).toBe('app');expect(prefs.damage??'physical').toBe('physical');
    await t.player.reload();const again=await prepare(t.player,t.pc.id,t.npcs[0].id,'weapon:0:normal');await expect(again.getByLabel('Dés pour toucher')).toHaveValue('app');expect(rollRequests).toBe(1);
    await t.player.screenshot({path:info.outputPath('attacks-choice-app.png')});
  }finally{await t.context.close();}
});
test('MJ : dés de dégâts de l’application, critique déclaré, résistance et annulation sans PV modifiés',async({page,browser})=>{
  const t=await setup(page,browser);try{
    const form=await prepare(page,t.npcs[0].id,t.npcs[1].id,'npc:0');await form.getByLabel('Dé 1 sur 20',{exact:true}).fill('18');await form.getByRole('button',{name:'Valider le jet physique',exact:true}).click();
    const ticket=panel(page).locator('[data-attack-ticket]');await expect(ticket).toHaveCount(1);const damage=ticket.locator('[data-damage-roll]');
    await damage.getByLabel('Résultat retenu',{exact:true}).selectOption('critical');await damage.getByLabel('Raison si résultat corrigé').fill('Critique vérifié à la table pour ce contrôle');await damage.getByLabel('Dés pour les dégâts').selectOption('app');
    await damage.getByRole('button',{name:'Lancer les dégâts',exact:true}).click();await expect(ticket.locator('[data-attack-confirm]')).toBeVisible();
    const current=await(await page.request.get('/atelier/api/groupes/'+t.id+'/combat')).json(),result=current.combat.attackTickets[0];expect(result.damage.mode).toBe('app');expect(result.damage.dice).toHaveLength(2);expect(result.damage.flat).toBe(2);
    expect(result.damage.dice.every(d=>d.value>=1&&d.value<=6)).toBe(true);expect(current.combat.participants.find(p=>p.id===t.npcs[1].id).currentHp).toBe(7);
    const confirm=ticket.locator('[data-attack-confirm]');await confirm.getByLabel('Traitement des dégâts').selectOption('resistance');await expect(confirm.locator('[data-final-damage]')).toHaveText(String(Math.floor(result.damage.total/2)));
    await ticket.getByRole('button',{name:'Annuler cette attaque',exact:true}).click();await expect(panel(page).locator('[data-attack-ticket]')).toHaveCount(0);
    const after=await(await page.request.get('/atelier/api/groupes/'+t.id+'/combat')).json();expect(after.combat.participants.find(p=>p.id===t.npcs[1].id).currentHp).toBe(7);
  }finally{await t.context.close();}
});
