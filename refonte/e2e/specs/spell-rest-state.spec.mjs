import {test,expect,origin} from '../fixtures.mjs';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
const c=buildCatalogue(JSON.parse(readFileSync(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
async function seed(page,cls,name,legacy=false){
 const id=randomUUID(),character=originFixture(c,cls,3,{speciesId:'orc'},'fermier');character.name=name;
 if(legacy)character.playState={version:1,hpLost:0,tempHp:0,used:{}};
 expect((await page.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character,revision:0}})).ok()).toBe(true);
 await page.goto('/atelier/#ouvrir/'+id);await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();await page.getByRole('tab',{name:'En partie',exact:true}).click();
 if(!legacy)await page.getByRole('button',{name:'Commencer le suivi',exact:true}).click();return id;
}
const restButton=(page,kind)=>page.getByRole('button',{name:'Préparer le repos '+kind,exact:true});
const confirm=(page,kind)=>page.getByRole('dialog').getByRole('button',{name:'Terminer le repos '+kind,exact:true});

test('Druide : emplacements, dés physiques, annulation, repos court/long et sauvegarde sur un autre appareil',async({page,browser,auth},info)=>{
 const id=await seed(page,'druide','E2E repos druide');const hp=Number(await page.locator('[data-play-current]').innerText());
 await page.locator('#play-damage').fill('8');await page.getByRole('button',{name:'Appliquer les dégâts'}).click();await page.locator('#play-set-temp').fill('4');await page.getByRole('button',{name:'Remplacer les PV temporaires'}).click();
 const slot=page.locator('[data-play-slot="spell-1"]'),shape=page.locator('[data-play-resource="wild-shape"]');
 await slot.getByRole('button',{name:'Dépenser',exact:true}).click();await shape.getByLabel('Quantité').fill('2');await shape.getByRole('button',{name:'Dépenser',exact:true}).click();
 await page.locator('#play-rest-dice').fill('1');await page.locator('#play-rest-healing').fill('5');await restButton(page,'court').click();
 await expect(page.getByRole('dialog')).toContainText('Emplacements · niveau 1 : 3 → 3 / 4');await expect(page.getByRole('dialog')).toContainText('Forme animale : 0 → 1');await page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).click();
 await expect(page.locator('[data-play-current]')).toHaveText(String(hp-8));await expect(page.locator('[data-hit-dice-remaining]')).toHaveText('3');
 await restButton(page,'court').click();await confirm(page,'court').click();await expect(page.locator('[data-play-current]')).toHaveText(String(hp-3));await expect(page.locator('[data-play-temp]')).toHaveText('4');await expect(page.locator('[data-hit-dice-remaining]')).toHaveText('2');await expect(slot.locator('[data-slot-remaining]')).toHaveText('3');await expect(shape.locator('[data-play-remaining]')).toHaveText('1');
 await restButton(page,'long').click();await expect(page.getByRole('dialog')).toContainText('PV temporaires : 4 → 0');await page.getByRole('dialog').screenshot({path:info.outputPath('confirmation-repos-long.png')});await confirm(page,'long').click();
 await expect(page.locator('[data-play-current]')).toHaveText(String(hp));await expect(slot.locator('[data-slot-remaining]')).toHaveText('4');await expect(page.locator('[data-hit-dice-remaining]')).toHaveText('3');await expect(page.locator('[data-last-rest]')).toContainText('long');
 await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();await expect(page.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');
 await page.locator('[data-play-slot="spell-1"]').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('emplacements-et-repos.png')});
 const context=await browser.newContext({storageState:auth,baseURL:origin});try{const other=await context.newPage();await other.goto('/atelier/#ouvrir/'+id);await other.getByRole('tab',{name:'En partie',exact:true}).click();await expect(other.locator('[data-play-slot="spell-1"] [data-slot-remaining]')).toHaveText('4');await expect(other.locator('[data-last-rest]')).toContainText('long');}finally{await context.close();}
});
test('Occultiste : le repos court récupère le pacte, pas Astuce mystique ; les repos sont bloqués à zéro PV',async({page})=>{
 await seed(page,'occultiste','E2E repos pacte');const pact=page.locator('[data-play-slot="pact"]'),cunning=page.locator('[data-play-resource="magical-cunning"]');await expect(page.locator('[data-play-slot^="spell-"]')).toHaveCount(0);
 await pact.getByLabel('Quantité').fill('2');await pact.getByRole('button',{name:'Dépenser',exact:true}).click();await cunning.getByRole('button',{name:'Dépenser',exact:true}).click();
 await restButton(page,'court').click();await expect(page.getByRole('dialog')).toContainText('Pacte · niveau 2 : 0 → 2 / 2');await confirm(page,'court').click();await expect(pact.locator('[data-slot-remaining]')).toHaveText('2');await expect(cunning.locator('[data-play-remaining]')).toHaveText('0');
 await page.locator('#play-set-current').fill('0');await page.getByRole('button',{name:'Corriger les PV',exact:true}).click();await expect(restButton(page,'court')).toBeDisabled();await expect(restButton(page,'long')).toBeDisabled();
});
test('Une ancienne fiche et un ancien client conservent les nouveaux suivis sans migration à l’ouverture',async({page})=>{
 const id=await seed(page,'barde','E2E ancien suivi',true);let saved=await (await page.request.get('/atelier/api/personnages/'+id)).json();expect(saved.character.playState.slotUsed).toBeUndefined();expect(saved.character.playState.hitDiceUsed).toBeUndefined();
 await page.locator('[data-play-slot="spell-2"]').getByRole('button',{name:'Dépenser',exact:true}).click();await restButton(page,'court').click();await confirm(page,'court').click();await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();await expect(page.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');
 saved=await (await page.request.get('/atelier/api/personnages/'+id)).json();const old=structuredClone(saved.character);delete old.playState.slotUsed;delete old.playState.hitDiceUsed;delete old.playState.lastRest;old.playState.hpLost=1;
 expect((await page.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character:old,revision:saved.revision}})).ok()).toBe(true);
 const current=await (await page.request.get('/atelier/api/personnages/'+id)).json();expect(current.character.playState.slotUsed['spell-2']).toBe(1);expect(current.character.playState.lastRest.kind).toBe('short');
 const bad=await page.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character:{...current.character,playState:{...current.character.playState,slotUsed:{'spell-10':1}}},revision:current.revision}});expect(bad.status()).toBe(400);
});
