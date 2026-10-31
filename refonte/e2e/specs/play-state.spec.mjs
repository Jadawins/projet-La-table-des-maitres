import {test,expect,origin} from '../fixtures.mjs';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
const c=buildCatalogue(JSON.parse(readFileSync(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
async function seed(page,cls,name){
 const id=randomUUID(),character=originFixture(c,cls,3,{speciesId:'orc'},'fermier');character.name=name;
 const result=await page.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character,revision:0}});expect(result.ok()).toBe(true);
 await page.goto('/atelier/#ouvrir/'+id);await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();await page.getByRole('tab',{name:'En partie',exact:true}).click();return id;
}
test('PV et Rage : actions volontaires, stockage local, sauvegarde et réouverture sur un autre appareil',async({page,browser,auth},info)=>{
 const id=await seed(page,'barbare','E2E suivi barbare');const hp=Number(await page.locator('#play-start-hp').inputValue());
 expect((await (await page.request.get('/atelier/api/personnages/'+id)).json()).character.playState).toBeUndefined();
 await page.getByRole('button',{name:'Commencer le suivi',exact:true}).click();
 await page.locator('#play-set-temp').fill('5');await page.getByRole('button',{name:'Remplacer les PV temporaires'}).click();
 await page.locator('#play-damage').fill('8');await page.getByRole('button',{name:'Appliquer les dégâts'}).click();
 await expect(page.locator('[data-play-current]')).toHaveText(String(hp-3));await expect(page.locator('[data-play-temp]')).toHaveText('0');
 const rage=page.locator('[data-play-resource="rage"]');const max=Number(await rage.locator('[data-play-remaining]').innerText());
 await rage.getByLabel('Quantité').fill('2');await rage.getByRole('button',{name:'Dépenser',exact:true}).click();await expect(rage.locator('[data-play-remaining]')).toHaveText(String(max-2));
 await rage.getByRole('button',{name:'Rendre',exact:true}).click();await expect(rage.locator('[data-play-remaining]')).toHaveText(String(max-1));
 await page.reload();await page.getByRole('tab',{name:'En partie',exact:true}).click();await expect(page.locator('[data-play-current]')).toHaveText(String(hp-3));
 await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();await expect(page.locator('.sheet-save-status')).toContainText('Enregistré dans votre compte');
 await page.screenshot({path:info.outputPath('suivi-en-partie.png')});
 const context=await browser.newContext({storageState:auth,baseURL:origin});try{const other=await context.newPage();await other.goto('/atelier/#ouvrir/'+id);await other.getByRole('tab',{name:'En partie',exact:true}).click();await expect(other.locator('[data-play-current]')).toHaveText(String(hp-3));await expect(other.locator('[data-play-resource="rage"] [data-play-remaining]')).toHaveText(String(max-1));}finally{await context.close();}
});
test('Une écriture concurrente est refusée et le suivi local reste récupérable',async({page})=>{
 const id=await seed(page,'barde','E2E suivi concurrent');await page.getByRole('button',{name:'Commencer le suivi',exact:true}).click();
 const record=await (await page.request.get('/atelier/api/personnages/'+id)).json();const concurrent={...record.character,playState:{version:1,hpLost:4,tempHp:0,used:{}}};
 expect((await page.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character:concurrent,revision:record.revision}})).ok()).toBe(true);
 await page.locator('#play-damage').fill('2');await page.getByRole('button',{name:'Appliquer les dégâts'}).click();const current=await page.locator('[data-play-current]').innerText();
 await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();await expect(page.getByRole('alert')).toContainText('modifié ailleurs');
 await expect(page.locator('[data-play-current]')).toHaveText(current);expect((await (await page.request.get('/atelier/api/personnages/'+id)).json()).character.playState.hpLost).toBe(4);
 const malformed=await page.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character:{...concurrent,playState:{version:1,hpLost:-1,tempHp:0,used:{}}},revision:2}});expect(malformed.status()).toBe(400);
});
