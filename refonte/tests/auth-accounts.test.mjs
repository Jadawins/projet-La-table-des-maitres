import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthAccounts} from '../access/auth-accounts.mjs';
import {createAdminStore} from '../access/admin-store.mjs';
import {memoryCollection} from './admin-memory.mjs';
import {randomUUID} from 'node:crypto';
const actor={userId:'owner',isAdmin:true};
test('Le total et les destinataires viennent des inscriptions, même sans connexion MongoDB',async()=>{
  let people=[{id:'owner',email:'owner@example.test'},{id:'new',email:'NEW@example.test',email_confirmed_at:null,user_metadata:{username:'Nouveau'}}],calls=0;
  const accounts=createAuthAccounts({url:'https://auth.invalid',key:'server-test-only',fetcher:async(url,options)=>{calls++;assert.equal(options.cache,'no-store');assert.equal(options.headers.apikey,'server-test-only');return Response.json({users:people});}});
  const store=createAdminStore({db:{collection:()=>memoryCollection([])},rulesVersion:'test',accounts});
  const [metrics,directory]=await Promise.all([store.overview(actor),store.directory(actor)]);assert.equal(calls,1);assert.equal(metrics.accounts,2);assert.equal(directory.accounts.find(a=>a.id==='new').email,'new@example.test');assert.equal(JSON.stringify(metrics).includes('server-test-only'),false);
  people=people.concat({id:'third',email:'third@example.test'});assert.equal((await store.overview(actor)).accounts,3);assert.equal(calls,2);
  people=people.filter(p=>p.id!=='new');assert.equal((await store.overview(actor)).accounts,2);
});
test('Pagination complète, déduplication et exclusion des invités et comptes supprimés',async()=>{
  const first=Array.from({length:1000},(_,i)=>({id:String(i),email:i+'@example.test'}));let calls=0;
  const accounts=createAuthAccounts({url:'https://auth.invalid',key:'server-test-only',fetcher:async url=>{calls++;return Response.json({users:new URL(url).searchParams.get('page')==='1'?first:[first[0],{id:'guest',is_anonymous:true},{id:'deleted',deleted_at:'2026-01-01'},{id:'last',email:'last@example.test'}]});}});
  const result=await accounts.snapshot();assert.equal(result.total,1001);assert.equal(calls,2);assert.equal(result.accounts.some(a=>a.id==='guest'),false);
});
test('Erreur ou clé absente : aucun faux total, caractères disponibles et annuaire de secours signalé',async()=>{
  for(const response of [null,Response.json({error:'private upstream information'},{status:401}),Response.json({wrong:[]})]){
    const accounts=createAuthAccounts({url:'https://auth.invalid',key:response?'server-test-only':'',fetcher:async()=>response});
    const store=createAdminStore({db:{collection:name=>memoryCollection(name==='users'?[{supabase_id:'cached',email:'cached@example.test'}]:[])},rulesVersion:'test',accounts});
    const metrics=await store.overview(actor),directory=await store.directory(actor);assert.equal(metrics.accounts,null);assert(metrics.accountsWarning);assert.equal(metrics.characters,0);assert.equal(directory.accounts.length,1);assert(directory.accountsWarning);assert(!JSON.stringify([metrics,directory]).includes('private upstream'));
  }
});
test('Les comptes sont recherchés par identité réelle sans transférer la réponse brute',async()=>{
  const accounts=createAuthAccounts({url:'https://auth.invalid',key:'server-test-only',fetcher:async url=>url.endsWith('/missing')?Response.json({},{status:404}):Response.json({id:'new',email:'new@example.test',encrypted_password:'never-forward',identities:[{token:'private'}]})});
  assert.deepEqual(await accounts.find('new'),{id:'new',email:'new@example.test',name:'new@example.test'});assert.equal(await accounts.find('missing'),null);
});
test('Les opérations non administrateur ne consultent pas la source des comptes',async()=>{
  let calls=0;const accounts={snapshot:async()=>{calls++;return {total:0,accounts:[]};},find:async()=>{calls++;return null;}};
  const store=createAdminStore({db:{collection:()=>memoryCollection([])},rulesVersion:'test',accounts});
  await assert.rejects(store.overview({userId:'ordinary',isAdmin:false}),{status:403});await assert.rejects(store.directory(null),{status:403});assert.equal(calls,0);
});
test('Une fiche peut être attribuée à un inscrit authentique qui ne figure pas encore dans MongoDB',async()=>{
  const id=randomUUID(),requestId=randomUUID(),characters=memoryCollection([{user_id:'owner',client_id:id,revision:1,character:{name:'Fiche conservée'},created_at:new Date()}]);
  const accounts={snapshot:async()=>({total:2,accounts:[]}),find:async id=>id==='new'?{id,email:'new@example.test'}:null};
  const store=createAdminStore({db:{collection:name=>name==='users'?memoryCollection([]):characters},rulesVersion:'test',accounts});
  await store.assign(actor,{ownerId:'owner',id,targetId:'new',revision:1,mode:'copy',requestId});
  assert.deepEqual((await characters.findOne({user_id:'new',client_id:requestId})).character,{name:'Fiche conservée'});
});
