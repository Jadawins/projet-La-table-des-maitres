import {test,expect,origin} from '../fixtures.mjs';import {randomUUID} from 'node:crypto';
async function recipient(browser,tag){
  const context=await browser.newContext({baseURL:origin,storageState:{cookies:[],origins:[]}}),page=await context.newPage();await context.setExtraHTTPHeaders({'X-Real-IP':'e2e-'+randomUUID()});await page.goto('/connexion.html');
  await page.locator('#email').fill('message-'+tag+'@example.test');await page.locator('#password').fill('test-only');await page.locator('#connect').click();await page.waitForURL('**/atelier/');await expect(page.locator('meta[name=refonte-user]')).toHaveAttribute('content','e2e-message-'+tag);return {context,page,id:'e2e-message-'+tag};
}
async function create(page,recipients){
  const created=await(await page.request.post('/atelier/api/groupes',{headers:{Origin:origin},data:{name:'Secrets '+randomUUID(),alias:'Le Gardien',role:'mj'}})).json();
  for(const [n,p]of recipients.entries())expect((await p.page.request.post('/atelier/api/groupes/rejoindre',{headers:{Origin:origin},data:{code:created.invitationCode,alias:'Destinataire '+(n+1),role:'player'}})).status()).toBe(200);
  return created.group.id;
}
async function send(page,groupId,recipients,body){
  await page.goto('/atelier/#groupes/'+groupId);const form=page.locator('[data-group-message-form]');await expect(form).toBeVisible();
  for(const id of recipients)await form.locator('[name=recipient][value="'+id+'"]').check();await form.getByLabel('Votre message',{exact:true}).fill(body);await form.getByRole('button',{name:'Envoyer le message',exact:true}).click();await expect(page.locator('[data-message-feedback]')).toContainText('Message envoyé');
}
test('Pop-up sur une autre page : plusieurs destinataires, texte privé échappé et lecture indépendante',async({page,browser},info)=>{
  const a=await recipient(browser,'popup-b'),b=await recipient(browser,'popup-c'),c=await recipient(browser,'popup-d');try{
    const group=await create(page,[a,b,c]);await a.page.goto('/atelier/#grimoire');await b.page.goto('/atelier/#personnages');await c.page.goto('/atelier/#accueil');
    const body='Vous remarquez une lueur derrière la porte. <script>interdit()</script>';await send(page,group,[a.id,b.id],body);
    await a.page.bringToFront();const popup=a.page.locator('[data-message-popup]');await expect(popup).toBeVisible();await expect(popup.locator('.message-body')).toHaveText(body);expect(await popup.locator('script').count()).toBe(0);await a.page.screenshot({path:info.outputPath('message-mj-popup.png')});
    const id=await popup.getAttribute('data-message-popup');await a.page.getByRole('button',{name:'J’ai lu',exact:true}).click();await expect(a.page.locator('[data-message-popup]')).toHaveCount(0);
    await b.page.bringToFront();await expect(b.page.locator('[data-message-popup]')).toBeVisible();
    expect((await(await c.page.request.get('/atelier/api/messages')).json()).unread).toBe(0);expect((await c.page.request.get('/atelier/api/messages/'+id)).status()).toBe(404);
    const received=await(await b.page.request.get('/atelier/api/messages/'+id)).json();expect(received.message.recipients).toBeUndefined();expect(received.message.readAt).toBeNull();
    await b.page.getByRole('button',{name:'J’ai lu',exact:true}).click();await expect(b.page.locator('[data-message-popup]')).toHaveCount(0);
    const history=await(await page.request.get('/atelier/api/groupes/'+group+'/messages')).json();expect(history.messages[0].recipients.every(p=>p.readAt)).toBe(true);
    expect((await a.page.request.post('/atelier/api/groupes/'+group+'/messages',{headers:{Origin:origin},data:{id:randomUUID(),recipientIds:[b.id],body:'Non autorisé'}})).status()).toBe(403);
  }finally{await Promise.all([a.context.close(),b.context.close(),c.context.close()]);}
});
test('Un destinataire absent reçoit le pop-up à son retour dans l’atelier',async({page,browser})=>{
  let receiver=await recipient(browser,'offline-b');let group;try{group=await create(page,[receiver]);await receiver.context.close();await send(page,group,[receiver.id],'Le marchand vous attend dans la cour.');receiver=await recipient(browser,'offline-b');await receiver.page.bringToFront();await expect(receiver.page.locator('[data-message-popup]')).toContainText('Le marchand vous attend dans la cour.');await receiver.page.getByRole('button',{name:'J’ai lu',exact:true}).click();await expect(receiver.page.locator('[data-message-inbox]')).toHaveText('Messages du MJ');}finally{await receiver.context.close();}
});
test('Relire plus tard garde le message non lu et les pop-ups suivants restent disponibles',async({page,browser})=>{
  const receiver=await recipient(browser,'deferred-b');try{
    const group=await create(page,[receiver]);for(const body of ['Premier secret','Second secret'])expect((await page.request.post('/atelier/api/groupes/'+group+'/messages',{headers:{Origin:origin},data:{id:randomUUID(),recipientIds:[receiver.id],body}})).status()).toBe(200);
    await receiver.page.bringToFront();const popup=receiver.page.locator('[data-message-popup]');await expect(popup).toContainText('Premier secret');await receiver.page.getByRole('button',{name:'Relire plus tard',exact:true}).click();await expect(popup).toContainText('Second secret');await receiver.page.getByRole('button',{name:'J’ai lu',exact:true}).click();
    await expect(receiver.page.locator('[data-message-inbox]')).toContainText('1 non lu');await receiver.page.locator('[data-message-inbox]').click();await expect(popup).toContainText('Premier secret');await receiver.page.getByRole('button',{name:'J’ai lu',exact:true}).click();await expect(receiver.page.locator('[data-message-inbox]')).toHaveText('Messages du MJ');
  }finally{await receiver.context.close();}
});
