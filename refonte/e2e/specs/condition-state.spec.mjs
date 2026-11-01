import {test,expect,origin} from '../fixtures.mjs';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
const c=buildCatalogue(JSON.parse(readFileSync(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
async function seed(page,name){
 const id=randomUUID(),character=originFixture(c,'barbare',3,{speciesId:'orc'},'fermier');character.name=name;
 expect((await page.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character,revision:0}})).ok()).toBe(true);
 await page.goto('/atelier/#ouvrir/'+id);await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();await page.getByRole('tab',{name:'En partie',exact:true}).click();await page.getByRole('button',{name:'Commencer le suivi',exact:true}).click();return id;
}
const save=async page=>{await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();await expect(page.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');};
const confirm=page=>page.getByRole('dialog').getByRole('button',{name:'Confirmer la modification',exact:true}).click();
test('États liés, Épuisement, rappel dans les autres rubriques, repos et autre appareil',async({page,browser,auth},info)=>{
 const id=await seed(page,'E2E états en partie');await page.locator('.condition-picker summary').click();await page.getByLabel('Empoisonné',{exact:true}).check();await page.getByLabel('Paralysé',{exact:true}).check();
 await expect(page.locator('[data-condition-speed]')).toHaveText('0 m');await expect(page.locator('.condition-effects')).toContainText('Neutralisé (induit)');await expect(page.getByLabel('Neutralisé',{exact:true})).not.toBeChecked();
 await page.getByLabel('Paralysé',{exact:true}).uncheck();await page.getByLabel('Étourdi',{exact:true}).check();await expect(page.locator('[data-condition-speed]')).toHaveText('9 m');await page.getByLabel('Étourdi',{exact:true}).uncheck();
 await page.locator('#play-exhaustion').selectOption('2');await page.getByRole('button',{name:'Appliquer l’Épuisement'}).click();await expect(page.locator('[data-condition-speed]')).toHaveText('6 m');
 await page.getByRole('tab',{name:'Sorts',exact:true}).click();await expect(page.locator('.condition-banner')).toContainText('Empoisonné');await expect(page.locator('.condition-banner')).toContainText('−4');await page.getByRole('button',{name:'Voir les effets en partie'}).click();await expect(page.getByRole('tab',{name:'En partie',exact:true})).toHaveAttribute('aria-selected','true');
 await page.locator('.play-conditions').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('etats-epuisement.png')});
 await page.getByRole('button',{name:'Préparer le repos long',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Épuisement : 2 → 1');await page.getByRole('dialog').getByRole('button',{name:'Terminer le repos long',exact:true}).click();await expect(page.locator('.condition-effects')).toContainText('Empoisonné');await save(page);
 const context=await browser.newContext({storageState:auth,baseURL:origin});try{const other=await context.newPage();await other.goto('/atelier/#ouvrir/'+id);await other.getByRole('tab',{name:'En partie',exact:true}).click();await expect(other.locator('#play-exhaustion')).toHaveValue('1');await expect(other.getByLabel('Empoisonné',{exact:true})).toBeChecked();}finally{await context.close();}
});
test('Jets physiques, stabilisation, dégâts à zéro PV, mort, confirmation et retour à la vie',async({page},info)=>{
 const id=await seed(page,'E2E jets de mort');await page.locator('#play-set-current').fill('0');await page.getByRole('button',{name:'Corriger les PV',exact:true}).click();await page.locator('#play-exhaustion').selectOption('2');await page.getByRole('button',{name:'Appliquer l’Épuisement'}).click();
 await page.locator('#play-death-die').fill('11');await page.getByRole('button',{name:'Enregistrer le jet de mort'}).click();await expect(page.locator('[data-death-failures]')).toHaveText('1');
 await page.locator('#play-death-die').fill('20');await page.locator('#play-death-modifier').fill('-100');await page.getByRole('button',{name:'Enregistrer le jet de mort'}).click();await expect(page.locator('[data-play-current]')).toHaveText('1');await expect(page.locator('[data-life-status]')).toHaveText('Vivant');await expect(page.locator('.condition-effects')).not.toContainText('Inconscient');
 await page.locator('#play-set-current').fill('0');await page.getByRole('button',{name:'Corriger les PV',exact:true}).click();
 for(let n=0;n<3;n++){await page.locator('#play-death-die').fill('10');await page.locator('#play-death-modifier').fill('4');await page.getByRole('button',{name:'Enregistrer le jet de mort'}).click();}
 await expect(page.locator('[data-life-status]')).toContainText('Stabilisé');await expect(page.locator('[data-death-successes]')).toHaveText('0');await expect(page.locator('[data-play-action="death-roll"]')).toHaveCount(0);
 await page.locator('#play-damage').fill('1');await page.getByRole('button',{name:'Appliquer les dégâts',exact:true}).click();await expect(page.locator('[data-death-failures]')).toHaveText('1');
 await page.locator('#play-damage-failures').selectOption('2');await page.getByRole('button',{name:'Appliquer les dégâts',exact:true}).click();await expect(page.locator('[data-life-status]')).toHaveText('Mort déclarée');
 await page.getByRole('button',{name:'Déclarer le retour à la vie'}).click();await page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).click();await expect(page.locator('[data-life-status]')).toHaveText('Mort déclarée');await page.getByRole('button',{name:'Déclarer le retour à la vie'}).click();await confirm(page);await expect(page.locator('[data-play-current]')).toHaveText('1');
 await page.locator('#play-exhaustion').selectOption('6');await page.getByRole('button',{name:'Appliquer l’Épuisement'}).click();await page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).click();await expect(page.locator('#play-exhaustion')).toHaveValue('2');
 await page.locator('#play-exhaustion').selectOption('6');await page.getByRole('button',{name:'Appliquer l’Épuisement'}).click();await page.getByRole('dialog').screenshot({path:info.outputPath('confirmation-epuisement.png')});await confirm(page);await expect(page.locator('[data-life-status]')).toHaveText('Mort déclarée');
 await page.locator('#play-exhaustion').selectOption('5');await page.getByRole('button',{name:'Appliquer l’Épuisement'}).click();await expect(page.locator('[data-life-status]')).toHaveText('Mort déclarée');await page.getByRole('button',{name:'Déclarer le retour à la vie'}).click();await confirm(page);await save(page);
 const record=await (await page.request.get('/atelier/api/personnages/'+id)).json();expect(record.character.playState.deathSaves.dead).toBe(false);expect(record.character.playState.exhaustion).toBe(5);
 const bad=await page.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character:{...record.character,playState:{...record.character.playState,conditions:['unknown']}},revision:record.revision}});expect(bad.status()).toBe(400);
});
