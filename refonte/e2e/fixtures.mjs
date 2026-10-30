import {test as base,expect} from '@playwright/test';
const origin='http://127.0.0.1:4199';
export async function signIn(page,account='a'){
  await page.goto(origin+'/connexion.html');
  await page.locator('#email').fill(`joueur-${account}@example.test`);
  await page.locator('#password').fill('test-only');
  await page.locator('#connect').click();
  await page.waitForURL(origin+'/atelier/');
  await expect(page.locator('meta[name="refonte-user"]')).toHaveAttribute('content',`e2e-account-${account}`);
  await page.locator('.sidebar a[href="#personnages"]').click();
  await expect(page.getByRole('heading',{name:'Mes personnages',exact:true})).toBeVisible();
}
export const test=base.extend({
  auth:[async({browser},use)=>{
    const context=await browser.newContext();
    const page=await context.newPage();
    await signIn(page);
    const state=await context.storageState();
    const cookie=state.cookies.find(c=>c.name==='__Host-myrpgtable_session');
    expect(cookie?.httpOnly).toBe(true);expect(cookie?.secure).toBe(true);
    state.origins=[]; // Reuse only the test session; never inject character data.
    await context.close();await use(state);
  },{scope:'worker'}],
  storageState:async({auth},use)=>use(auth),
  page:async({page},use)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await use(page);
    expect(errors,'Aucune exception JavaScript pendant le parcours').toEqual([]);
  },
});
export {expect,origin};
