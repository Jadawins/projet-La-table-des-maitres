import {test,expect,signIn,origin} from '../fixtures.mjs';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../../catalogue.mjs';
import {classFixture} from '../../audit/class-fixtures.mjs';
import {sheetModel} from '../../maquette/sheet-model.mjs';
import {applyPlayAction} from '../../maquette/play-state.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
const post=(page,id,data)=>page.request.post('/atelier/api/groupes/'+id+'/combat/sorts',{headers:{Origin:origin},data});
async function setup(page,browser,{classId='clerc',spellId=null}={}){
  const created=await(await page.request.post('/atelier/api/groupes',{headers:{Origin:origin},data:{name:'Table des sorts '+randomUUID(),alias:'MJ'}})).json();
  const id=created.group.id,context=await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}}),player=await context.newPage();await signIn(player,'b');
  expect((await player.request.post('/atelier/api/groupes/rejoindre',{headers:{Origin:origin},data:{code:created.invitationCode,alias:'Clerc'}})).status()).toBe(200);
  const characterId=randomUUID(),state=classFixture(c,classId,5,classId==='clerc'?'clerc_domaine_vie':c.subclasses.find(s=>s.classe_parente===classId).id);state.name='Lanceur des sorts';if(classId==='clerc')state.divineOrder='Protecteur';if(spellId){state.prepared[0]=spellId;if(classId==='magicien'&&!state.classChoices.spellbook.includes(spellId))state.classChoices.spellbook[0]=spellId;}
  state.playState=applyPlayAction(state,sheetModel(state,c),{type:'start',currentHp:sheetModel(state,c).hp});
  expect((await player.request.put('/atelier/api/personnages/'+characterId,{headers:{Origin:origin},data:{character:state,revision:0}})).status()).toBe(200);
  await player.request.post('/atelier/api/groupes/'+id+'/personnage',{headers:{Origin:origin},data:{characterId}});
  let value=await(await page.request.post('/atelier/api/groupes/'+id+'/combat',{headers:{Origin:origin},data:{type:'create',name:'La tour de magie'}})).json();
  async function act(data){value=await(await page.request.post('/atelier/api/groupes/'+id+'/combat',{headers:{Origin:origin},data:{combatId:value.combat.id,revision:value.combat.revision,...data}})).json();}
  await act({type:'add-npc',name:'Adversaire',maxHp:100,ac:12});const [pc,npc]=value.combat.participants;
  await act({type:'visible',participantId:npc.id,value:true});for(const p of value.combat.participants)await act({type:'initiative',participantId:p.id,value:15});await act({type:'start'});
  await player.goto('/atelier/#combat/'+id);await page.goto('/atelier/#combat/'+id);
  return {id,context,player,pc,npc,characterId};
}
const panel=page=>page.locator('[data-spell-panel]');
async function propose(t,name){
  const root=panel(t.player);await root.getByLabel('Lanceur de sorts').selectOption(t.pc.id);await root.getByRole('button',{name:'Afficher les sorts sans lancer'}).click();
  const option=root.locator('select[name=spellKey] option').filter({hasText:name}).first();await root.getByLabel('Sort de la fiche').selectOption(await option.getAttribute('value'));
  const form=root.locator('[data-casting-form=prepare]');if(name==='Soins')await form.getByLabel('Ressource utilisée').selectOption('spell-1');if(name==='Boule de feu')await form.getByLabel('Ressource utilisée').selectOption('spell-3');
  await form.getByLabel('Adversaire',{exact:true}).check();await form.getByRole('button',{name:'Proposer le sort au MJ'}).click();
  const cast=root.locator('[data-casting-cast]').filter({hasText:'validation du MJ attendue'}).last();await expect(cast).toContainText('validation du MJ attendue');return cast.getAttribute('data-casting-cast');
}
async function refresh(page){await page.getByRole('button',{name:'Actualiser',exact:true}).click();await expect(page.locator('#content')).toHaveAttribute('aria-busy','false');}
async function approve(page,id,edit){
  await refresh(page);const cast=panel(page).locator('[data-casting-cast="'+id+'"]');if(await cast.getAttribute('open')===null)await cast.locator(':scope > summary').click();
  const form=cast.locator('[data-casting-form=approve]');if(edit)await edit(form);await form.locator('[name=completed]').check();await form.getByRole('button',{name:'Valider l’incantation et sa dépense'}).click();await expect(cast).toContainText('effets à résoudre');return cast;
}

test('Sort mineur : proposition, sauvegarde MJ, dés physiques du joueur et confirmation sans dégâts anticipés',async({page,browser},info)=>{
  const t=await setup(page,browser);try{
    const id=await propose(t,'Flamme sacrée');await approve(page,id);
    const target=panel(page).locator('[data-casting-cast="'+id+'"] [data-casting-target="'+t.npc.id+'"]');
    const save=target.locator('[data-casting-form=roll]');await save.getByLabel('Dé 1 sur 20',{exact:true}).fill('1');await save.getByLabel('Origine du bonus manquant').fill('Profil personnalisé');await save.getByRole('button',{name:'Valider le jet contre cette cible'}).click();
    await refresh(t.player);const own=panel(t.player).locator('[data-casting-cast="'+id+'"]');if(await own.getAttribute('open')===null)await own.locator(':scope > summary').click();
    const damage=own.locator('[data-casting-form=damage]');await damage.getByLabel('Dé 1 sur 8',{exact:true}).fill('3');await damage.getByLabel('Dé 2 sur 8',{exact:true}).fill('4');await damage.getByRole('button',{name:'Valider le jet de dégâts'}).click();
    const before=await(await page.request.get('/atelier/api/groupes/'+t.id+'/combat')).json();expect(before.combat.participants.find(p=>p.id===t.npc.id).currentHp).toBe(100);
    expect((await post(t.player,t.id,{type:'confirm',castId:id,targetId:t.npc.id,confirmed:true})).status()).toBe(403);
    await refresh(page);const review=panel(page).locator('[data-casting-cast="'+id+'"]');if(await review.getAttribute('open')===null)await review.locator(':scope > summary').click();await review.screenshot({path:info.outputPath('sort-validation-mj.png')});
    await review.getByRole('button',{name:'Confirmer les effets sur Adversaire'}).click();await expect(review).toContainText('Résolution terminée');
    const after=await(await page.request.get('/atelier/api/groupes/'+t.id+'/combat')).json();expect(after.combat.participants.find(p=>p.id===t.npc.id).currentHp).toBe(93);
    expect((await post(page,t.id,{type:'confirm',castId:id,targetId:t.npc.id,confirmed:true})).status()).toBe(200);
  }finally{await t.context.close();}
});

test('Soins : un emplacement après validation, dés de l’application explicites et proposition annulée sans coût',async({page,browser})=>{
  const t=await setup(page,browser);try{
    const abandoned=await propose(t,'Soins');t.player.once('dialog',dialog=>dialog.accept());await panel(t.player).locator('[data-casting-cast="'+abandoned+'"]').getByRole('button',{name:'Annuler la proposition'}).click();
    await expect(panel(t.player).locator('[data-casting-cast="'+abandoned+'"]')).toContainText('Proposition annulée');
    const id=await propose(t,'Soins');const saved=async()=> (await(await t.player.request.get('/atelier/api/personnages/'+t.characterId)).json()).character;
    expect((await saved()).playState.slotUsed['spell-1']||0).toBe(0);await approve(page,id);expect((await saved()).playState.slotUsed['spell-1']).toBe(1);
    await refresh(t.player);const own=panel(t.player).locator('[data-casting-cast="'+id+'"]');if(await own.getAttribute('open')===null)await own.locator(':scope > summary').click();
    const damage=own.locator('[data-casting-form=damage]');await damage.getByLabel('Dés à utiliser').selectOption('app');await damage.getByRole('button',{name:'Valider le jet de soins'}).click();
    await expect(own.locator('.casting-roll')).toContainText('Total');expect((await saved()).playState.slotUsed['spell-1']).toBe(1);
    await t.player.reload();await expect(panel(t.player)).toContainText('Soins');expect((await saved()).playState.slotUsed['spell-1']).toBe(1);
  }finally{await t.context.close();}
});

test('Zone : le MJ inclut le lanceur allié ; sauvegardes et dégâts distincts depuis un seul jet',async({page,browser},info)=>{
  const t=await setup(page,browser,{classId:'magicien',spellId:'boule_de_feu'});try{
    const id=await propose(t,'Boule de feu');await approve(page,id,form=>form.getByLabel('Lanceur des sorts',{exact:true}).check());
    const review=panel(page).locator('[data-casting-cast="'+id+'"]'),npc=review.locator('[data-casting-target="'+t.npc.id+'"]');
    const npcSave=npc.locator('[data-casting-form=roll]');await npcSave.getByLabel('Dé 1 sur 20',{exact:true}).fill('1');await npcSave.getByLabel('Origine du bonus manquant').fill('Adversaire de contrôle');await npcSave.getByRole('button',{name:'Valider le jet contre cette cible'}).click();
    await refresh(t.player);const own=panel(t.player).locator('[data-casting-cast="'+id+'"]');if(await own.getAttribute('open')===null)await own.locator(':scope > summary').click();
    const save=own.locator('[data-casting-target="'+t.pc.id+'"] [data-casting-form=roll]');await save.getByLabel('Dé 1 sur 20',{exact:true}).fill('20');await save.getByRole('button',{name:'Valider le jet contre cette cible'}).click();
    await expect(own.locator('[data-casting-target="'+t.pc.id+'"] > .casting-roll')).toContainText('Réussite');
    const damage=own.locator('[data-casting-form=damage]');const dice=damage.locator('input[name=die]');await expect(dice).toHaveCount(8);for(const input of await dice.all())await input.fill('1');await damage.getByRole('button',{name:'Valider le jet de dégâts'}).click();
    await expect(own.locator(':scope > .casting-roll')).toContainText('Total : 8');
    await refresh(page);if(await review.getAttribute('open')===null)await review.locator(':scope > summary').click();await review.screenshot({path:info.outputPath('sort-zone-allies.png')});
    await review.getByRole('button',{name:'Confirmer les effets sur Adversaire'}).click();await review.getByRole('button',{name:'Confirmer les effets sur Lanceur des sorts'}).click();
    await expect(review).toContainText('Résolution terminée');
    const saved=(await(await t.player.request.get('/atelier/api/personnages/'+t.characterId)).json()).character;expect(saved.playState.hpLost).toBe(4);expect(saved.playState.slotUsed['spell-3']).toBe(1);
  }finally{await t.context.close();}
});

test('Concentration : dégâts sans lancer automatique puis sauvegarde physique et fin des effets',async({page,browser},info)=>{
  const t=await setup(page,browser);try{
    const id=await propose(t,'Assistance');await approve(page,id,async form=>{await form.locator('[name=note]').fill('Bonus de compétence choisi à la table');await form.locator('[name=reason]').fill('Application de l’effet vérifiée par le MJ');await form.locator('[name=rounds]').fill('10');});
    const review=panel(page).locator('[data-casting-cast="'+id+'"]');await review.getByRole('button',{name:'Confirmer les effets sur Adversaire'}).click();
    const value=await(await page.request.get('/atelier/api/groupes/'+t.id+'/combat')).json(),pc=value.combat.participants.find(p=>p.id===t.pc.id);
    const damage=await page.request.post('/atelier/api/groupes/'+t.id+'/combat',{headers:{Origin:origin},data:{type:'health',combatId:value.combat.id,revision:value.combat.revision,participantId:pc.id,characterRevision:pc.characterRevision,action:{type:'damage',amount:5}}});expect(damage.status()).toBe(200);
    await refresh(t.player);const concentration=panel(t.player).locator('.casting-concentration');await expect(concentration).toContainText('DD 10');
    await concentration.screenshot({path:info.outputPath('sort-concentration.png')});
    await concentration.getByLabel('Dé 1 sur 20',{exact:true}).fill('1');await concentration.getByRole('button',{name:'Résoudre la concentration'}).click();await expect(panel(t.player).locator('.casting-concentration')).toHaveCount(0);
    const after=await(await page.request.get('/atelier/api/groupes/'+t.id+'/combat')).json();expect(after.combat.participants.find(p=>p.id===t.npc.id).magicEffects).toEqual([]);
  }finally{await t.context.close();}
});
