import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGateway} from '../access/server.mjs';
const origin='https://myrpgtable.fr';
const valid={username:'Aventurier',email:'NEW@example.test',password:'Une phrase de passe 2026',passwordConfirmation:'Une phrase de passe 2026'};
const token=`x.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.x`;
async function setup(t,{signupStatus=200,signupData={id:'new-user'},denyUser=false,unconfirmed=false,fetcher:custom}={}){
  const calls=[],accounts=[];
  const fetcher=custom||(async(url,options)=>{
    const input=options.body?JSON.parse(options.body):null;calls.push({url,input});
    if(url.includes('/signup?'))return Response.json(signupData,{status:signupStatus});
    if(url.includes('grant_type=pkce')){
      const signup=calls.find(c=>c.url.includes('/signup?'));
      if(!signup||createHash('sha256').update(input.code_verifier).digest('base64url')!==signup.input.code_challenge||input.auth_code!=='test-email-code')return Response.json({},{status:401});
      return Response.json({access_token:token});
    }
    if(url.endsWith('/user'))return Response.json(denyUser?{}:{id:'new-user',email:'new@example.test',email_confirmed_at:unconfirmed?null:'2026-10-30'},{status:denyUser?401:200});
    return Response.json({},{status:401});
  });
  const server=createGateway({supabaseUrl:'https://auth.example.test',anonKey:'public-test-key',origin,appRoot:'.',fetcher,admin:{recordAccount:async user=>accounts.push(user.id)}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}`,request=(route,options={})=>fetch(base+route,{redirect:'manual',...options});
  const post=(route,input,cookie='',requestOrigin=origin)=>request(route,{method:'POST',headers:{Origin:requestOrigin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(input)});
  return {post,request,calls,accounts,fetcher};
}
test('Inscription : PKCE et cookie protégé, pas de session ni de compte local avant confirmation',async t=>{
  const {post,request,calls,accounts}=await setup(t),response=await post('/auth/signup',{...valid,isAdmin:true,role:'admin'});
  assert.equal(response.status,202);assert.deepEqual(await response.json(),{ok:true,confirmationRequired:true});
  const cookie=response.headers.get('set-cookie');assert.match(cookie,/__Host-myrpgtable_signup=/);for(const flag of ['HttpOnly','Secure','SameSite=Lax','Max-Age=86400','Path=/'])assert(cookie.includes(flag));assert(!cookie.includes(valid.password));assert(!cookie.includes('session='));assert.deepEqual(accounts,[]);
  const {input,url}=calls[0];assert.equal(input.email,'new@example.test');assert.deepEqual(input.data,{username:'Aventurier'});assert.equal(input.code_challenge_method,'s256');assert.equal(new URL(url).searchParams.get('redirect_to'),origin+'/home.html');assert.equal((await request('/auth/status',{headers:{Cookie:cookie.split(';')[0]}})).status,401);
});
test('Confirmation : vérificateur lié au navigateur, jeton revérifié puis session sans privilège',async t=>{
  const {post,request,accounts}=await setup(t),signup=await post('/auth/signup',valid),cookie=signup.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('/auth/callback',{code:'test-email-code'})).status,401);
  assert.equal((await post('/auth/callback',{code:'test-email-code'},'__Host-myrpgtable_signup='+'x'.repeat(64))).status,401);
  const response=await post('/auth/callback',{code:'test-email-code'},cookie);assert.equal(response.status,200);assert.deepEqual(accounts,['new-user']);
  const session=response.headers.get('set-cookie').split(';')[0];assert.deepEqual(await(await request('/auth/status',{headers:{Cookie:session}})).json(),{ok:true,isAdmin:false});
});
test('La confirmation par e-mail survit à un redémarrage du serveur',async t=>{const first=await setup(t),response=await first.post('/auth/signup',valid),cookie=response.headers.get('set-cookie').split(';')[0];const restarted=await setup(t,{fetcher:first.fetcher});assert.equal((await restarted.post('/auth/callback',{code:'test-email-code'},cookie)).status,200);});
test('Une tentative OAuth abandonnée ne détourne pas la confirmation d’inscription',async t=>{const {post,request}=await setup(t);const oauth=await request('/auth/oauth?provider=google'),old=oauth.headers.get('set-cookie').split(';')[0];const signup=await post('/auth/signup',valid,old);const cookies=signup.headers.getSetCookie();assert(cookies.some(c=>c.startsWith('__Host-myrpgtable_oauth=;')&&c.includes('Max-Age=0')));const response=await post('/auth/callback',{code:'test-email-code'},old+'; '+cookies[0].split(';')[0]);assert.equal(response.status,200);assert(response.headers.getSetCookie().some(c=>c.startsWith('__Host-myrpgtable_signup=;')&&c.includes('Max-Age=0')));});
for(const [name,patch]of [['pseudo vide',{username:''}],['adresse invalide',{email:'bad'}],['mot de passe court',{password:'court',passwordConfirmation:'court'}],['confirmation différente',{passwordConfirmation:'autre'}]])test('Validation serveur : '+name,async t=>{const {post,calls}=await setup(t);assert.equal((await post('/auth/signup',{...valid,...patch})).status,400);assert.equal(calls.length,0);});
test('Inscription : origine du site obligatoire',async t=>{const {post,calls}=await setup(t);assert.equal((await post('/auth/signup',valid,'','https://evil.example')).status,403);assert.equal(calls.length,0);});
test('Adresse existante : même réponse publique, aucun cookie de session',async t=>{const {post}=await setup(t,{signupStatus:422,signupData:{code:'user_already_exists'}});const response=await post('/auth/signup',valid);assert.equal(response.status,202);assert.deepEqual(await response.json(),{ok:true,confirmationRequired:true});assert(!response.headers.get('set-cookie').includes('session='));});
test('Inscription : limitation indépendante des connexions et échec du fournisseur sans fuite',async t=>{const {post}=await setup(t,{signupStatus:500,signupData:{message:'private upstream detail'}});for(let i=0;i<3;i++){const r=await post('/auth/signup',valid);assert.equal(r.status,503);assert(!JSON.stringify(await r.json()).includes('private'));}assert.equal((await post('/auth/signup',valid)).status,429);assert.equal((await post('/auth/login',{email:valid.email,password:valid.password})).status,401);});
test('Un jeton retourné à l’inscription ne dispense jamais de la vérification Supabase',async t=>{const {post}=await setup(t,{signupData:{access_token:token},denyUser:true});const r=await post('/auth/signup',valid);assert.equal(r.status,503);assert.equal(r.headers.get('set-cookie'),null);});
test('Une identité valide mais sans adresse confirmée ne crée ni session ni compte local',async t=>{const {post,accounts}=await setup(t,{signupData:{access_token:token},unconfirmed:true});const r=await post('/auth/signup',valid);assert.equal(r.status,503);assert.equal(r.headers.get('set-cookie'),null);assert.deepEqual(accounts,[]);});
test('Mot de passe faible : erreur exploitable sans exposer la réponse du fournisseur',async t=>{const {post}=await setup(t,{signupStatus:422,signupData:{code:'weak_password'}});const r=await post('/auth/signup',valid);assert.equal(r.status,400);assert.match((await r.json()).error,/faible/);});
