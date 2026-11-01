import {test,expect,origin} from '../fixtures.mjs';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {buildCatalogue} from '../../catalogue.mjs';
import {classFixture} from '../../audit/class-fixtures.mjs';
const c=buildCatalogue(JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/rules-2024.json',import.meta.url),'utf8')));
async function signup(page,email){
  const password=randomUUID()+'aA1!';const r=await page.request.post('/auth/signup',{headers:{Origin:origin},data:{email,username:'Inscrit compteur',password,passwordConfirmation:password}});expect(r.status()).toBe(202);
}
test('Le compteur inclut une inscription sans connexion, se rafraîchit et conserve les choix d’attribution',async({page})=>{
  await page.clock.install();
  const id=randomUUID(),character=classFixture(c,'barbare',1,'');character.name='Compteur '+id;
  expect((await page.request.put('/atelier/api/personnages/'+id,{headers:{Origin:origin},data:{character,revision:0}})).ok()).toBe(true);
  await page.goto('/atelier/#admin');const count=page.locator('[data-admin-metric="accounts"]');await expect(count).toBeVisible();const before=Number(await count.innerText());
  const option=page.locator('#admin-source option').filter({hasText:character.name});await page.locator('#admin-source').selectOption(await option.getAttribute('value'));await page.locator('#admin-target').selectOption('e2e-account-b');await page.locator('#admin-mode').selectOption('move');
  const email='count-'+randomUUID()+'@example.test';await signup(page,email);await page.getByRole('button',{name:'Actualiser',exact:true}).click();await expect(count).toHaveText(String(before+1));
  await expect(page.locator('#admin-target option').filter({hasText:email})).toHaveCount(1);await expect(page.locator('#admin-source option:checked')).toContainText(character.name);await expect(page.locator('#admin-target')).toHaveValue('e2e-account-b');await expect(page.locator('#admin-mode')).toHaveValue('move');
  await signup(page,'auto-'+randomUUID()+'@example.test');await page.clock.fastForward(31000);await expect(count).toHaveText(String(before+2));
  await page.getByRole('link',{name:'Grimoire',exact:true}).click();let calls=0;page.on('request',r=>{if(r.url().includes('/api/admin/metrics'))calls++;});await page.clock.fastForward(62000);expect(calls).toBe(0);
});
test('Une indisponibilité ne devient pas un faux zéro et une erreur conserve les valeurs datées',async({page})=>{
  let mode='missing';
  await page.route('**/api/admin/metrics',async route=>{
    if(mode==='error')return route.fulfill({status:503,json:{error:'Indisponible'}});
    await route.fulfill({json:{accounts:mode==='missing'?null:12,accountsWarning:mode==='missing'?'Le total des inscriptions est indisponible. Réessayez l’actualisation.':'',characters:3,ready:2,drafts:1,recent:1,deleted:0,classes:[],rulesVersion:'test',generatedAt:'2026-11-01T11:00:00.000Z'}});
  });
  await page.goto('/atelier/#admin');const count=page.locator('[data-admin-metric="accounts"]');await expect(count).toHaveText('—');await expect(page.locator('#admin-accounts-status')).toContainText('indisponible');
  mode='ready';await page.getByRole('button',{name:'Actualiser',exact:true}).click();await expect(count).toHaveText('12');
  mode='error';await page.getByRole('button',{name:'Actualiser',exact:true}).click();await expect(page.locator('#admin-refresh-status')).toContainText('dernières données');await expect(count).toHaveText('12');await expect(page.locator('#admin-updated')).toContainText('Actualisé le');
});
