import {test, expect, origin} from '../fixtures.mjs';

test('Accueil public : nouveautés, outils disponibles, feuille de route et accès au compte', async ({browser}, info) => {
  const context = await browser.newContext({baseURL:origin, storageState:{cookies:[],origins:[]}, viewport:{width:1440,height:1000}});
  const page = await context.newPage(), failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => {if (response.status() >= 400 && !(response.status() === 401 && new URL(response.url()).pathname === '/auth/status')) failures.push(response.url());});
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', {name:'Vos aventures commencent ici.'})).toBeVisible();
    await expect(page.locator('.home-feature')).toHaveCount(8);
    await expect(page.locator('.home-news')).toHaveCount(3);
    await expect(page.locator('.home-books')).toContainText('ne remplace pas les livres');
    await page.screenshot({path:info.outputPath('accueil-public.png')});
    await page.getByRole('link', {name:'Les prochains chapitres',exact:true}).click();
    await expect(page).toHaveURL(/#avenir$/);
    await expect(page.locator('.home-roadmap')).toContainText('ne sont pas encore disponibles');
    await expect(page.locator('.home-roadmap')).toContainText('alliés');
    await expect(page.locator('.home-roadmap')).toContainText('Aucune date');
    await page.locator('.home-roadmap').screenshot({path:info.outputPath('accueil-feuille-de-route.png')});
    await page.getByRole('link', {name:'Consulter les sources et les licences'}).click();
    await expect(page).toHaveURL(/sources.html$/);
    await page.goto('/');
    await page.getByRole('link', {name:'Créer mon compte',exact:false}).click();
    await expect(page).toHaveURL(/inscription.html$/);
    await page.goto('/');
    await page.getByRole('link', {name:'Ouvrir mon espace',exact:false}).click();
    await expect(page).toHaveURL(/connexion.html$/);
    await page.goto('/');await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('accueil-public-etroit.png')});
    expect(failures).toEqual([]);
  } finally {await context.close();}
});

test('Accueil connecté : contenu commun et accès aux personnages et groupes sans perdre la navigation', async ({page}, info) => {
  const errors = [];page.on('pageerror', error => errors.push(error.message));
  await page.goto('/atelier/');
  await expect(page.getByRole('heading',{name:'Vos aventures commencent ici.'})).toBeVisible();
  await expect(page.locator('.home-feature')).toHaveCount(8);
  await expect(page.locator('.portal-welcome')).toContainText('vos aventures');
  await page.screenshot({path:info.outputPath('accueil-connecte.png')});
  await page.getByRole('link',{name:'Retrouver mes groupes',exact:false}).click();
  await expect(page.getByRole('heading',{name:'Mes groupes',exact:true})).toBeVisible();
  await page.locator('.sidebar nav a[href="#accueil"]').click();
  await page.getByRole('link',{name:'Créer un personnage',exact:false}).click();
  await expect(page).toHaveURL(/#creation$/);
  await page.goto('/atelier/');await page.setViewportSize({width:1024,height:800});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
