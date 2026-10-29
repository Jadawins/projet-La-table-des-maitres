import {test,expect,origin} from '../fixtures.mjs';
import {createHash} from 'node:crypto';
import release from '../../access/rules-release.json' with {type:'json'};

test('Le catalogue servi en mémoire conserve exactement les règles validées',async({page})=>{
  const response=await page.request.get('/atelier/catalogue.json');expect(response.status()).toBe(200);
  const text=await response.text();expect(createHash('sha256').update(text).digest('hex')).toBe(release.sha256);
  const c=JSON.parse(text);expect(c.provenance.revision.id).toBe(release.id);expect(c.classes).toHaveLength(12);expect(c.subclasses).toHaveLength(48);expect(c.spells).toHaveLength(390);
  await page.goto('/atelier/#nouveau');await expect(page.locator('#name')).toBeVisible();
});
test('Le catalogue reste inaccessible dans un navigateur sans session',async({browser})=>{
  const context=await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}});
  try{const response=await context.request.get('/atelier/catalogue.json',{maxRedirects:0});expect(response.status()).toBe(302);expect(response.headers().location).toBe('/connexion.html');}finally{await context.close();}
});
