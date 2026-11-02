import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createGateway} from '../access/server.mjs';
import {setup as fixture,player} from './spell-fixture.mjs';
const origin='https://myrpgtable.fr';
async function setup(t){
  const s=await fixture(),tokens=new Map(),fetcher=async(url,options)=>{
    if(url.endsWith('/user'))return Response.json({id:tokens.get(options.headers.Authorization?.slice(7))});
    const input=JSON.parse(options.body),token=`x.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.${randomUUID()}`;
    tokens.set(token,input.email.split('@')[0]);return Response.json({access_token:token});
  };
  const server=createGateway({supabaseUrl:'https://test.invalid',anonKey:'test-only',appRoot:fileURLToPath(new URL('../maquette',import.meta.url)),groups:s.groups,characters:s.characters,combats:s.combats,origin,fetcher});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  const request=(path,options={})=>fetch(`http://127.0.0.1:${server.address().port}`+path,{redirect:'manual',...options});
  const post=(path,data,cookie='',site=origin)=>request(path,{method:'POST',headers:{Origin:site,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
  const login=async name=>(await post('/auth/login',{email:name+'@example.test',password:randomUUID()})).headers.get('set-cookie').split(';')[0];
  return {...s,request,post,mjCookie:await login('mj'),playerCookie:await login('player'),outsideCookie:await login('outsider'),route:'/atelier/api/groupes/'+s.groupId+'/combat/sorts'};
}
test('API sorts : identité et origine vérifiées, rôles et modules privés protégés',async t=>{
  const s=await setup(t);
  assert.equal((await s.request(s.route+'?caster='+s.pc.id)).status,401);
  assert.equal((await s.request(s.route+'?caster='+s.pc.id,{headers:{Cookie:s.outsideCookie}})).status,404);
  assert.equal((await s.request(s.route+'?caster='+s.npc.id,{headers:{Cookie:s.playerCookie}})).status,403);
  assert.equal((await s.post(s.route,{type:'prepare'},s.playerCookie,'https://evil.invalid')).status,403);
  for(const body of [null,[],{type:'constructor'},{type:'end',castId:{$ne:null}}])assert.equal((await s.post(s.route,body,s.playerCookie)).status,400);
  assert.equal((await s.request('/atelier/spell-combat-view.mjs',{headers:{Cookie:s.playerCookie}})).status,200);
  for(const file of ['spell-rules.mjs','combat-spells.mjs','character-store.mjs'])assert.equal((await s.request('/atelier/'+file,{headers:{Cookie:s.playerCookie}})).status,404);
});
test('API sorts : proposition sans dépense, approbation MJ et coût conservé à la relecture',async t=>{
  const s=await setup(t),optionsResponse=await s.request(s.route+'?caster='+s.pc.id,{headers:{Cookie:s.playerCookie}});assert.equal(optionsResponse.status,200);assert.equal(optionsResponse.headers.get('cache-control'),'no-store');
  const options=await optionsResponse.json(),spell=options.spells.find(x=>x.id==='soins');
  const prepared=await s.post(s.route,{type:'prepare',combatId:options.combatId,revision:options.revision,casterId:s.pc.id,spellKey:spell.key,payment:'spell-1',targetIds:[s.npc.id]},s.playerCookie);assert.equal(prepared.status,200);
  const c=(await prepared.json()).cast;assert.equal((await s.characters.get(player.userId,s.id)).revision,1);
  const approve={type:'approve',castId:c.id,completed:true,plan:{...c.spell.suggestions[1],rounds:0,note:'Soins vérifiés'}};
  assert.equal((await s.post(s.route,approve,s.playerCookie)).status,403);assert.equal((await s.post(s.route,approve,s.mjCookie)).status,200);
  assert.equal((await s.characters.get(player.userId,s.id)).character.playState.slotUsed['spell-1'],1);
  assert.equal((await s.post(s.route,approve,s.mjCookie)).status,409);assert.equal((await s.characters.get(player.userId,s.id)).character.playState.slotUsed['spell-1'],1);
});
