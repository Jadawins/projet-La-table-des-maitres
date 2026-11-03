import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
import {createGateway} from '../access/server.mjs';import {lootFixture,mj,a} from './loot-fixture.mjs';
const origin='https://myrpgtable.fr';
async function setup(t){
  const s=await lootFixture(),tokens=new Map();const fetcher=async(url,options)=>{
    if(url.endsWith('/user'))return Response.json({id:tokens.get(options.headers.Authorization?.slice(7)),email:'test@example.test',email_confirmed_at:'2026-11-03'});
    const {email}=JSON.parse(options.body),token='x.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.'+randomUUID();tokens.set(token,email.split('@')[0]);return Response.json({access_token:token});
  };
  const server=createGateway({supabaseUrl:'https://test.invalid',anonKey:'test-only',appRoot:fileURLToPath(new URL('../maquette',import.meta.url)),characters:s.characters,groups:s.groups,loot:s.loot,origin,fetcher});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  const request=(path,options={})=>fetch('http://127.0.0.1:'+server.address().port+path,{redirect:'manual',...options}),post=(path,input,cookie='',site=origin)=>request(path,{method:'POST',headers:{Origin:site,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(input)});
  const login=async user=>(await post('/auth/login',{email:user+'@example.test',password:'test-only'})).headers.get('set-cookie').split(';')[0];return {...s,request,post,mjCookie:await login(mj.userId),playerCookie:await login(a.userId),base:'/atelier/api/groupes/'+s.groupId+'/butin'};
}
test('API butin : session, origine, rôle MJ, méthodes et fichiers privés',async t=>{
  const s=await setup(t),input=s.input();assert.equal((await s.request(s.base)).status,401);assert.equal((await s.post(s.base,input)).status,401);assert.equal((await s.post(s.base,input,s.mjCookie,'https://evil.invalid')).status,403);assert.equal((await s.post(s.base,input,s.playerCookie)).status,403);
  const response=await s.post(s.base,input,s.mjCookie);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const {allocation}=await response.json();assert.equal((await s.post(s.base+'/'+allocation.id+'/confirmer',{revision:allocation.revision,confirmed:false},s.mjCookie)).status,400);
  assert.equal((await s.request(s.base,{method:'DELETE',headers:{Origin:origin,Cookie:s.mjCookie}})).status,405);for(const file of ['loot-view.mjs','loot-rules.mjs']){assert.equal((await s.request('/atelier/'+file)).status,302);assert.equal((await s.request('/atelier/'+file,{headers:{Cookie:s.mjCookie}})).status,200);}assert.equal((await s.request('/atelier/group-loot.mjs',{headers:{Cookie:s.mjCookie}})).status,404);
});
test('API butin : confirmation sans doublon, historique privé et données internes absentes',async t=>{
  const s=await setup(t),{allocation}=await(await s.post(s.base,s.input(),s.mjCookie)).json();assert.equal((await s.request(s.base+'/'+allocation.id,{headers:{Cookie:s.playerCookie}})).status,404);
  const result=await s.post(s.base+'/'+allocation.id+'/confirmer',{revision:allocation.revision,confirmed:true},s.mjCookie);assert.equal(result.status,200);assert.equal((await result.json()).allocation.status,'done');assert.equal((await s.post(s.base+'/'+allocation.id+'/confirmer',{revision:allocation.revision,confirmed:true},s.mjCookie)).status,200);
  const own=await(await s.request(s.base,{headers:{Cookie:s.playerCookie}})).json();assert.equal(own.allocations.length,1);assert.equal(own.allocations[0].recipients.length,1);assert.equal(own.allocations[0].stamp,undefined);const record=await(await s.request('/atelier/api/personnages/'+s.ids.a,{headers:{Cookie:s.playerCookie}})).json();assert.equal(record.loot_receipts,undefined);assert.equal(record.character.inventoryItems.length,1);assert.equal(record.revision,2);
});
