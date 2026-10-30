// Local fake identity provider and mailbox only: no real account or email is created.
import {test,expect} from '@playwright/test';
const password='Une phrase de passe 2026';
async function fill(page,email){await page.locator('#username').fill('Nouveau joueur');await page.locator('#email').fill(email);await page.locator('#password').fill(password);await page.locator('#password-confirmation').fill(password);}
test('Inscription depuis l’accueil, confirmation e-mail puis accès au compte sans droits admin',async({page},info)=>{
  const email='new-player@example.test';await page.goto('/');await page.getByRole('link',{name:'Créer un compte',exact:true}).click();await expect(page.getByRole('heading',{name:'Créer votre compte.'})).toBeVisible();
  await fill(page,email);await page.locator('#signup').click();await expect(page.getByRole('heading',{name:'Vérifiez votre messagerie'})).toBeVisible();await expect(page.locator('#signup-form')).toBeHidden();expect((await page.request.get('/auth/status')).status()).toBe(401);
  const state=await page.context().storageState(),cookie=state.cookies.find(c=>c.name==='__Host-myrpgtable_signup');expect(cookie.httpOnly).toBe(true);expect(cookie.secure).toBe(true);expect(JSON.stringify(state.origins)).not.toContain(password);
  await page.screenshot({path:info.outputPath('verification-email.png')});
  const mail=await(await page.request.get('/_e2e/email?email='+email)).json();await page.goto(mail.link);await page.waitForURL('**/atelier/');await expect(page.getByRole('heading',{name:'Bienvenue à la Table du Maître'})).toBeVisible();await expect(page.locator('[data-admin-link]')).toBeHidden();expect((await page.request.get('/atelier/api/admin/metrics')).status()).toBe(403);
});
test('Confirmation des mots de passe : aucune requête tant qu’ils diffèrent',async({page})=>{
  let requests=0;page.on('request',r=>{if(r.url().endsWith('/auth/signup'))requests++;});await page.goto('/connexion.html');await page.getByRole('link',{name:'Créer un compte',exact:true}).click();await fill(page,'mismatch@example.test');await page.locator('#password-confirmation').fill('Une autre phrase de passe');await page.locator('#signup').click();expect(await page.locator('#password-confirmation').evaluate(e=>e.validity.customError)).toBe(true);expect(requests).toBe(0);await expect(page.locator('#signup-form')).toBeVisible();
});
test('Erreur d’inscription : message lisible et nouvel essai possible',async({page})=>{
  await page.goto('/inscription.html');await fill(page,'retry-new-player@example.test');await page.route('**/auth/signup',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'L’inscription est temporairement indisponible.'})}));await page.locator('#signup').click();await expect(page.locator('#signup-status')).toContainText('temporairement indisponible');await expect(page.locator('#signup')).toBeEnabled();await expect(page.locator('#email')).toHaveValue('retry-new-player@example.test');await page.unroute('**/auth/signup');await page.locator('#signup').click();await expect(page.getByRole('heading',{name:'Vérifiez votre messagerie'})).toBeVisible();
});
test('Lien ouvert dans un autre navigateur : confirmation puis connexion par mot de passe',async({page,browser})=>{
  const email='other-browser-player@example.test';await page.goto('/inscription.html');await fill(page,email);await page.locator('#signup').click();await expect(page.getByRole('heading',{name:'Vérifiez votre messagerie'})).toBeVisible();const mail=await(await page.request.get('/_e2e/email?email='+email)).json();
  const context=await browser.newContext();try{const other=await context.newPage();await other.goto(mail.link);await expect(other.locator('#login-status')).toContainText('connectez-vous');await other.locator('#email').fill(email);await other.locator('#password').fill(password);await other.locator('#connect').click();await other.waitForURL('**/atelier/');await expect(other.getByRole('heading',{name:'Bienvenue à la Table du Maître'})).toBeVisible();}finally{await context.close();}
});
