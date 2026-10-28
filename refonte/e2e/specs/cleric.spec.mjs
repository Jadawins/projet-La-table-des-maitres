import {test,expect,origin} from '../fixtures.mjs';
import {domains,createThroughUI,saveAndLocate,assertSheet} from '../journey.mjs';
for(const domain of domains)for(let level=1;level<=20;level++)for(const vocation of ['Protecteur','Thaumaturge']){
  const quick=level===20&&domain._source==='clerc_domaine_vie'?' @quick':'';
  test(`${domain.nom} niveau ${level} ${vocation}${quick}`,async({page,browser,auth})=>{
    const name=`E2E ${domain._source.replace('clerc_domaine_','')} ${level} ${vocation}`;
    await createThroughUI(page,{name,level,domain,vocation});
    await assertSheet(page,{level,vocation});
    const href=await saveAndLocate(page,name);
    await page.reload();await expect(page.locator('.sheet-hero h1')).toHaveText(name);
    await expect(page.locator('.sheet-save-status')).not.toContainText('Modifications à enregistrer');
    // A fresh browser context has no draft/localStorage: this must come from the server.
    const fresh=await browser.newContext({storageState:auth,baseURL:origin});
    try{
      const reopened=await fresh.newPage();await reopened.goto('/atelier/'+href);
      await expect(reopened.locator('.sheet-hero h1')).toHaveText(name);
      await assertSheet(reopened,{level,vocation});
      if(level>=12){await reopened.locator('a[href="#creation"]').click();await reopened.locator('[data-step="4"]').click();await expect(reopened.locator('[data-advance-level="12"][data-advance-point="0"]')).toHaveValue('INT');}
    }finally{await fresh.close();}
  });
}
