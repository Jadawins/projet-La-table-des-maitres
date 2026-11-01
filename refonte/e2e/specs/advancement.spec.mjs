import {test,expect,origin} from '../fixtures.mjs';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
import {sheetModel} from '../../maquette/sheet-model.mjs';
const c=buildCatalogue(JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/rules-2024.json',import.meta.url),'utf8')));
async function seed(page,idClass,level=3,physical=false,backgroundId='fermier'){
  const id=randomUUID(),character=originFixture(c,idClass,level,{speciesId:'orc'},backgroundId);character.name='E2E progression '+id.slice(0,6);
  character.scores={FOR:14,DEX:14,CON:14,INT:14,SAG:14,CHA:14};
  if(physical){character.hpMode='physical';character.hpRolls={2:4,3:6};}
  character.playState={version:1,hpLost:sheetModel(character,c).hp-7,tempHp:2,used:{rage:1},conditions:['poisoned'],exhaustion:1};
  const result=await page.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character,revision:0}});expect(result.ok(),await result.text()).toBe(true);
  await page.goto('/atelier/#ouvrir/'+id);await expect(page.getByRole('heading',{name:character.name,exact:true})).toBeVisible();return {id,character};
}
async function begin(page,cls){await page.getByRole('button',{name:/Passer au niveau/}).click();await page.locator('#advancement-class').selectOption(cls);await page.getByRole('dialog').getByRole('button',{name:'Préparer ce niveau'}).click();await expect(page.getByRole('heading',{name:/Passage au niveau/})).toBeVisible();}
async function fillChoices(page){
  for(const input of await page.locator('[data-class-free]').all())if(!await input.inputValue())await input.fill('Choix de table');
  for(let i=0;i<100;i++){
    const choices=page.locator('.rules-section').filter({has:page.locator('[data-class-select]')});let next=null;
    for(const section of await choices.all()){const header=await section.locator('h3').innerText(),match=header.match(/(\d+)\s*\/\s*(\d+)/);if(match&&+match[1]<+match[2]){next=section.locator('[data-class-select]:not(:checked):not(:disabled)').first();if(await next.count())break;next=null;}}
    if(!next)return;await next.click();
  }
  throw Error('Unfinished class choices');
}
async function completeNewClass(page){
  const vocation=page.locator('[data-choice="divineOrder"][data-id="Protecteur"]');if(await vocation.count())await vocation.click();
  await fillChoices(page);
  for(let i=0;i<5&&await page.locator('[data-class-skill]:not(:checked):not(:disabled)').count();i++)await page.locator('[data-class-skill]:not(:checked):not(:disabled)').first().click();
  await page.locator('#next').click();
  if(await page.getByRole('heading',{name:'Composez votre magie.'}).count()){
    for(const kind of ['cantrips','prepared'])for(let i=0;i<30&&await page.locator('[data-spell-kind="'+kind+'"]:not(:checked):not(:disabled)').count();i++)await page.locator('[data-spell-kind="'+kind+'"]:not(:checked):not(:disabled)').first().click();
    await page.locator('#next').click();
  }
  await expect(page.getByRole('heading',{name:'Vérifier la montée de niveau'})).toBeVisible();
  await page.getByRole('button',{name:'Valider la montée de niveau'}).click();await expect(page.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');
}
test('Montée 3 → 4 avec dés physiques, sauvegarde finale et autre appareil',async({page,browser,auth},info)=>{
  const {id,character}=await seed(page,'barbare',3,true);await begin(page,'barbare');
  await expect(page.locator('#hp-mode')).toBeDisabled();await expect(page.locator('[data-hp-level="2"]')).toHaveCount(0);
  await page.locator('[data-advance-mode="ability"][data-advance-level="4"]').click();await page.locator('[data-advance-point="0"]').selectOption('CON');await page.locator('[data-advance-point="1"]').selectOption('CON');await page.locator('[data-hp-level="4"]').fill('5');await fillChoices(page);
  await page.locator('#next').click();await expect(page.getByRole('heading',{name:'Vérifier la montée de niveau'})).toBeVisible();
  expect((await (await page.request.get('/atelier/api/personnages/'+id)).json()).character.level).toBe(3);
  await page.screenshot({path:info.outputPath('bilan-montee-niveau.png')});await page.getByRole('button',{name:'Valider la montée de niveau'}).click();await expect(page.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');
  const saved=await (await page.request.get('/atelier/api/personnages/'+id)).json();expect(saved.character.level).toBe(4);expect(saved.character.hpRolls).toEqual({2:4,3:6,4:5});for(const [key,values]of Object.entries(character.classChoices))expect(saved.character.classChoices[key]).toEqual(expect.arrayContaining(values));expect(saved.character.playState.used.rage).toBe(1);
  await page.getByRole('tab',{name:'En partie',exact:true}).click();await expect(page.locator('[data-play-current]')).toHaveText('7');
  const context=await browser.newContext({storageState:auth,baseURL:origin});try{const other=await context.newPage();await other.goto('/atelier/#ouvrir/'+id);await expect(other.locator('.sheet-hero')).toContainText('Niveau 4');}finally{await context.close();}
});
test('Annuler ou recharger une progression ne change pas la version enregistrée',async({page})=>{
  const {id}=await seed(page,'barbare');await begin(page,'barbare');await page.locator('[data-advance-mode="ability"]').click();await page.locator('[data-advance-point="0"]').selectOption('FOR');
  await page.reload();await expect(page.getByRole('heading',{name:'Passage au niveau 4',exact:true})).toBeVisible();await expect(page.locator('[data-advance-point="0"]')).toHaveValue('FOR');
  await page.getByRole('button',{name:'Annuler la montée de niveau'}).click();await expect(page.locator('.sheet-hero')).toContainText('Niveau 3');expect((await (await page.request.get('/atelier/api/personnages/'+id)).json()).revision).toBe(1);
});
test('Nouvelle classe : Guerrier 1, PV non maximisés, réserves et dés de vie distincts',async({page},info)=>{
  const {id}=await seed(page,'barbare');await begin(page,'guerrier');await fillChoices(page);
  await page.locator('#hp-mode').selectOption('physical');await page.getByLabel('Dé de vie niveau 1 de la nouvelle classe').fill('2');await page.locator('#next').click();await expect(page.getByRole('heading',{name:'Vérifier la montée de niveau'})).toBeVisible();
  await page.getByRole('button',{name:'Valider la montée de niveau'}).click();await expect(page.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');await expect(page.locator('.sheet-hero')).toContainText('Barbare 3 / Guerrier 1');
  const saved=await (await page.request.get('/atelier/api/personnages/'+id)).json();expect(saved.character.multiclass.sequence).toEqual(['barbare','barbare','barbare','guerrier']);expect(saved.character.multiclass.classes[1].hpRolls['1']).toBe(2);expect(saved.character.multiclass.classes[1].classSkills).toEqual([]);
  await page.getByRole('tab',{name:'En partie',exact:true}).click();await expect(page.locator('[data-play-resource="rage"]')).toBeVisible();await expect(page.locator('[data-play-resource="guerrier-second-wind"]')).toBeVisible();await page.locator('#play-rest-1d10').fill('1');await page.locator('#play-rest-healing').fill('3');await page.getByRole('button',{name:'Préparer le repos court'}).click();await page.getByRole('dialog').getByRole('button',{name:'Terminer le repos court',exact:true}).click();
  await page.screenshot({path:info.outputPath('fiche-multiclasse.png')});await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();await expect(page.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger la fiche PDF'}).click();expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await begin(page,'guerrier');await expect(page.getByRole('heading',{name:'Passage au niveau 5',exact:true})).toBeVisible();
  await expect(page.locator('[data-hp-level="1"]')).toHaveCount(0);await page.locator('[data-hp-level="2"]').fill('3');await page.locator('#next').click();await page.getByRole('button',{name:'Valider la montée de niveau'}).click();await expect(page.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');
  const further=await (await page.request.get('/atelier/api/personnages/'+id)).json();expect(further.character.level).toBe(5);expect(further.character.multiclass.classes[1].level).toBe(2);expect(further.character.multiclass.classes[1].hpRolls).toEqual({1:2,2:3});
});
test('Barde et Clerc : choix de sorts séparés et nouveaux emplacements communs',async({page})=>{
  const {id}=await seed(page,'barde');await begin(page,'clerc');await page.locator('[data-choice="divineOrder"][data-id="Protecteur"]').click();await page.locator('#next').click();await expect(page.getByRole('heading',{name:'Composez votre magie.'})).toBeVisible();
  for(const [kind,count]of [['cantrips',3],['prepared',4]])for(let i=0;i<count;i++)await page.locator('[data-spell-kind="'+kind+'"]:not(:checked):not(:disabled)').first().click();
  await page.locator('#next').click();await page.getByRole('button',{name:'Valider la montée de niveau'}).click();await expect(page.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');
  const saved=await (await page.request.get('/atelier/api/personnages/'+id)).json();expect(saved.character.multiclass.classes[1].prepared).toHaveLength(4);await page.getByRole('tab',{name:'En partie',exact:true}).click();await expect(page.locator('[data-play-slot="spell-2"] [data-slot-remaining]')).toHaveText('3');
});
for(const [index,cls]of c.classes.entries())test('Ajout de classe dans le navigateur : '+cls.nom,async({page})=>{
  const primary=c.classes[(index+1)%c.classes.length].id,{id}=await seed(page,primary,1);await begin(page,cls.id);await completeNewClass(page);
  const result=await (await page.request.get('/atelier/api/personnages/'+id)).json();expect(result.status).toBe('ready');expect(result.character.level).toBe(2);expect(result.character.multiclass.classes[1].classId).toBe(cls.id);
  await page.reload();await expect(page.locator('.sheet-hero')).toContainText(cls.nom+' 1');
});
test('Érudition sans maîtrise éligible : progression réelle de Guerrier 1 / Magicien 1 vers Magicien 2',async({page})=>{
  const {id}=await seed(page,'guerrier',1,false,'soldat');await begin(page,'magicien');await completeNewClass(page);
  await begin(page,'magicien');await expect(page.getByRole('heading',{name:/Érudition · expertise 0\/0/})).toBeVisible();await expect(page.getByText('Aucune compétence éligible n’est maîtrisée : aucune Expertise n’est accordée pour le moment.')).toBeVisible();
  await completeNewClass(page);const result=await (await page.request.get('/atelier/api/personnages/'+id)).json();expect(result.status).toBe('ready');expect(result.character.multiclass.classes[1].classChoices.scholar??[]).toEqual([]);
});
