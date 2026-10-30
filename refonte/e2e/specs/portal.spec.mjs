import {test,expect,signIn,origin} from '../fixtures.mjs';
import {domains,createThroughUI,saveAndLocate} from '../journey.mjs';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../../catalogue.mjs';
import {originFixture} from '../../audit/origin-fixtures.mjs';
import {createOriginThroughUI} from '../origin-journey.mjs';
import {PDFDocument} from '../../maquette/assets/pdf-lib-1.17.1.mjs';
const domain=domains.find(d=>d._source==='clerc_domaine_vie');
test('Accueil par défaut, grimoire et navigation retour avec recherche conservée',async({page},info)=>{
  await page.goto('/atelier/');await expect(page.getByRole('heading',{name:'Bienvenue à la Table du Maître'})).toBeVisible();await expect(page.locator('.portal-welcome')).toContainText('vos aventures');await page.screenshot({path:info.outputPath('accueil.png')});
  await page.locator('.sidebar a[href="#grimoire"]').click();await page.locator('#grimoire-query').fill('evocation acide');await page.locator('#grimoire-category').selectOption('spells');await page.getByRole('link',{name:'Aspersion acide',exact:true}).click();await expect(page.getByRole('heading',{name:'Aspersion acide',exact:true})).toBeVisible();await expect(page.locator('.portal-detail')).toContainText('Composantes');await page.getByRole('link',{name:'Retour au grimoire',exact:false}).click();await expect(page.locator('#grimoire-query')).toHaveValue('evocation acide');await expect(page.locator('#grimoire-category')).toHaveValue('spells');await page.locator('#grimoire-query').fill('zzzzzzz');await expect(page.locator('#grimoire-results')).toContainText('Aucun résultat');await page.locator('#grimoire-query').fill('');await page.locator('#grimoire-category').selectOption('subclasses');await expect(page.locator('#grimoire-count')).toHaveText('48 résultats');await expect(page.locator('.portal-card')).toHaveCount(24);await page.locator('#grimoire-more').click();await expect(page.locator('.portal-card')).toHaveCount(48);
});
test('Compte ordinaire : administration cachée et refusée côté serveur',async({browser})=>{const context=await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}});try{const page=await context.newPage();await signIn(page,'b');await expect(page.locator('[data-admin-link]')).toBeHidden();expect((await page.request.get('/atelier/api/admin/metrics')).status()).toBe(403);await page.goto('/atelier/#admin');await expect(page.getByRole('heading',{name:'Accès réservé'})).toBeVisible();}finally{await context.close();}});
test('Administration : copie confirmée puis transfert vers un compte existant',async({page,browser},info)=>{
  const name='E2E attribution portail';await createThroughUI(page,{name,level:3,domain,vocation:'Protecteur'});const href=await saveAndLocate(page,name),id=href.slice('#ouvrir/'.length);
  await page.locator('[data-admin-link]').click();await expect(page.getByRole('heading',{name:'Le site en un regard'})).toBeVisible();await page.screenshot({path:info.outputPath('administration.png')});
  const choose=async()=>{const option=page.locator('#admin-source option').filter({hasText:name});await expect(option).toHaveCount(1);await page.locator('#admin-source').selectOption(await option.getAttribute('value'));await page.locator('#admin-target').selectOption('e2e-account-b');};
  await choose();await page.getByRole('button',{name:'Vérifier l’attribution'}).click();await page.getByRole('button',{name:'Annuler',exact:true}).click();expect((await page.request.get('/atelier/api/personnages/'+id)).status()).toBe(200);
  await page.getByRole('button',{name:'Vérifier l’attribution'}).click();await expect(page.getByRole('dialog')).toContainText('joueur-b@example.test');await page.getByRole('button',{name:'Confirmer l’attribution'}).click();await expect(page.locator('#admin-feedback')).toHaveText('Attribution effectuée.');expect((await page.request.get('/atelier/api/personnages/'+id)).status()).toBe(200);
  const context=await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}});try{const other=await context.newPage();await signIn(other,'b');const listing=await(await other.request.get('/atelier/api/personnages')).json();const copied=listing.characters.find(c=>c.name===name);expect(copied).toBeTruthy();expect(copied.id).not.toBe(id);}finally{await context.close();}
  const originalOption=page.locator('#admin-source option').filter({hasText:name}).filter({hasText:'joueur-a@example.test'});await page.locator('#admin-source').selectOption(await originalOption.getAttribute('value'));await page.locator('#admin-target').selectOption('e2e-account-b');await page.locator('#admin-mode').selectOption('move');await page.getByRole('button',{name:'Vérifier l’attribution'}).click();await page.getByRole('button',{name:'Confirmer l’attribution'}).click();await expect(page.locator('#admin-feedback')).toHaveText('Attribution effectuée.');expect((await page.request.get('/atelier/api/personnages/'+id)).status()).toBe(404);
});
for(const level of [3,20])test(`PDF fourni rempli au niveau ${level}`,async({page},info)=>{await createThroughUI(page,{name:`E2E impression ${level}`,level,domain,vocation:'Protecteur'});const download=page.waitForEvent('download');await page.locator('#print-sheet').click();const file=await download;expect(file.suggestedFilename()).toBe(`E2E impression ${level}.pdf`);await file.saveAs(info.outputPath(`fiche-${level}.pdf`));await expect(page.locator('#print-sheet')).toBeEnabled();await expect(page.locator('#toast')).toContainText(/fiche PDF/i);});
test('PDF armes du barbare : téléchargement avec noms et petite police',async({page},info)=>{
  const c=buildCatalogue(JSON.parse(await readFile(new URL('../../tests/fixtures/rules-2024.json',import.meta.url))));
  const state=originFixture(c,'barbare',1,{speciesId:'orc'},'marin');state.name='E2E armes du barbare';
  await createOriginThroughUI(page,state,c);
  const download=page.waitForEvent('download');await page.locator('#print-sheet').click();
  const file=await download,path=info.outputPath('armes-barbare.pdf');await file.saveAs(path);
  const doc=await PDFDocument.load(await readFile(path)),form=doc.getForm();
  expect(form.getTextField('weapons11').getText()).toBe('Hache à deux mains');
  expect(form.getTextField('weapons21').getText()).toBe('Hachette');
  expect(form.getTextField('weapons11').isMultiline()).toBe(false);
  expect(form.getTextField('weapons24').getText()).toContain('6/18 m');
  expect(form.getTextField('weapons24').getText()).not.toContain('[object Object]');
});
