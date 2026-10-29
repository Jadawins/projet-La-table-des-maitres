import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createGateway} from '../access/server.mjs';
const origin='https://myrpgtable.fr';
const token=`x.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.x`;
async function setup(t,{rejectUser=false,unavailable=false,characters,catalogueText}={}){
  const calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url,options});if(unavailable)throw new Error('offline');
    if(url.includes('/user'))return {ok:!rejectUser,json:async()=>rejectUser?{}:{id:'test-user',is_anonymous:false}};
    return {ok:true,json:async()=>({access_token:token,refresh_token:'private-refresh'})};
  };
  const server=createGateway({supabaseUrl:'https://auth.example.test',anonKey:'test-public-key',origin,appRoot:fileURLToPath(new URL('../maquette',import.meta.url)),fetcher,characters,catalogueText});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=(route,opts={})=>fetch(base+route,{redirect:'manual',...opts});
  const post=(route,body,cookie='')=>request(route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  return {request,post,calls};
}
test('Aucun fichier de la refonte ni catalogue sans connexion, y compris avec cookie inventé',async t=>{
  const {request}=await setup(t);
  for(const route of ['/atelier/','/atelier/app.js','/atelier/catalogue.json','/atelier/sheet-model.mjs']){
    const response=await request(route,{headers:{Cookie:'__Host-myrpgtable_session=forged'}});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/connexion.html');
  }
});

test('Le catalogue chargé en mémoire est servi après connexion, sans fichier catalogue.json',async t=>{
  const catalogueText=JSON.stringify({version:'test-only',spells:[{id:'example'}]});
  const {post,request}=await setup(t,{catalogueText});
  const login=await post('/auth/login',{email:'test@example.test',password:'test-only'}),cookie=login.headers.get('set-cookie').split(';')[0];
  const response=await request('/atelier/catalogue.json',{headers:{Cookie:cookie}});
  assert.equal(response.status,200);assert.equal(await response.text(),catalogueText);assert.equal(response.headers.get('cache-control'),'no-store');
  const head=await request('/atelier/catalogue.json',{method:'HEAD',headers:{Cookie:cookie}});assert.equal(head.status,200);assert.equal(await head.text(),'');
});

test('Un catalogue manquant ne déclenche jamais une lecture de secours sur disque',async t=>{
  const {post,request}=await setup(t);
  const login=await post('/auth/login',{email:'test@example.test',password:'test-only'}),cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/atelier/catalogue.json',{headers:{Cookie:cookie}})).status,503);
});
test('L’API des personnages exige la session et utilise son propriétaire, jamais celui du formulaire',async t=>{
  const calls=[];const characters={list:async owner=>{calls.push(owner);return [];},save:async(owner,id,character,revision)=>{calls.push(owner);return {id,revision:revision+1};}};
  const {request,post}=await setup(t,{characters});const id='12345678-1234-1234-1234-123456789abc';
  assert.equal((await request('/atelier/api/personnages')).status,401);
  const login=await post('/auth/login',{email:'test@example.test',password:'test-only'}),cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/atelier/api/personnages',{headers:{Cookie:cookie}})).status,200);
  const result=await request('/atelier/api/personnages/'+id,{method:'PUT',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({character:{user_id:'other-account'},revision:0})});
  assert.equal(result.status,200);assert.deepEqual(calls,['test-user','test-user']);
  const forbidden=await request('/atelier/api/personnages/'+id,{method:'PUT',headers:{Cookie:cookie,Origin:'https://elsewhere.test'},body:'{}'});assert.equal(forbidden.status,403);assert.equal(calls.length,2);
});
test('Connexion validée par Supabase, cookie protégé, identité et brouillon isolés',async t=>{
  const {post,request,calls}=await setup(t);const response=await post('/auth/login',{email:'test@example.test',password:'test-only'});
  assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);
  assert.ok(calls.some(c=>c.url.endsWith('/user')));const text=await response.text();assert.ok(!text.includes(token));assert.ok(!text.includes('private-refresh'));
  const page=await request('/atelier/',{headers:{Cookie:cookie.split(';')[0]}});assert.equal(page.status,200);assert.match(await page.text(),/name="refonte-user" content="test-user"/);
});
test('Un jeton refusé par Supabase ne crée aucune session',async t=>{
  const {post}=await setup(t,{rejectUser:true});const response=await post('/auth/login',{email:'test@example.test',password:'test-only'});assert.equal(response.status,401);assert.equal(response.headers.get('set-cookie'),null);
});
test('Panne de vérification : accès refusé, aucun repli par décodage du jeton',async t=>{
  const {post}=await setup(t,{unavailable:true});const response=await post('/auth/login',{email:'test@example.test',password:'test-only'});assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);
});
test('Refus des connexions envoyées depuis un autre site',async t=>{
  const {request,calls}=await setup(t);const response=await request('/auth/login',{method:'POST',headers:{Origin:'https://elsewhere.test'},body:'{}'});assert.equal(response.status,403);assert.equal(calls.length,0);
});
test('La déconnexion invalide réellement le cookie côté serveur',async t=>{
  const {post,request}=await setup(t);const login=await post('/auth/login',{email:'test@example.test',password:'test-only'});const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('/auth/logout',{},cookie)).status,200);assert.equal((await request('/atelier/app.js',{headers:{Cookie:cookie}})).status,302);
});
test('Google et Discord utilisent un vérificateur PKCE lié au navigateur',async t=>{
  const {request,post}=await setup(t);const response=await request('/auth/oauth?provider=google');assert.equal(response.status,302);const target=new URL(response.headers.get('location'));
  assert.equal(target.searchParams.get('code_challenge_method'),'s256');assert.ok(target.searchParams.get('code_challenge'));assert.ok(!target.searchParams.has('code_verifier'));
  assert.equal((await post('/auth/callback',{code:'test-code'})).status,401);
  const cookie=response.headers.get('set-cookie').split(';')[0];assert.equal((await post('/auth/callback',{code:'test-code'},cookie)).status,200);
  assert.equal((await post('/auth/callback',{code:'test-code'},cookie)).status,401);
});
test('Seuls les fichiers prévus sont servis après connexion, pas de remontée vers le serveur',async t=>{
  const {post,request}=await setup(t);const login=await post('/auth/login',{email:'test@example.test',password:'test-only'});const cookie=login.headers.get('set-cookie').split(';')[0];
  for(const route of ['/atelier/server.mjs','/atelier/.env','/atelier/audit.html'])assert.equal((await request(route,{headers:{Cookie:cookie}})).status,404);
});
