import test from 'node:test';
import assert from 'node:assert/strict';
import {createBestiaryStore,normalizeBestiaryMonster,bestiaryCR} from '../access/bestiary-store.mjs';
import {bestiaryFixtures,bestiaryMemory} from './bestiary-fixture.mjs';
test('Bestiaire Mongo : noms français/anglais, accents, type, taille et FP fractionnaire',async()=>{
  const collection=bestiaryMemory(),store=createBestiaryStore({collection});
  assert.equal((await store.search({q:'goblin'})).monsters[0].name,'Gobelin');
  assert.equal((await store.search({q:'AIGLE GEANT'})).monsters[0].id,'giant-eagle');
  assert.equal((await store.search({type:'beast',size:'G',min:'1/2',max:'1'})).total,1);
  assert.equal((await store.search({min:'1/4',max:'1/4'})).total,2);
  assert.equal((await store.search({q:'.*'})).total,0);assert.equal((await store.search({q:'gobelin humanoide'})).total,1);
  const filters=(await store.search()).filters;assert(filters.types.some(t=>t.id==='Beast'&&t.label==='Bête'));
});
test('Lecture paginée et stable : aucun résultat au-delà des 40 premiers n’est perdu',async()=>{
  const rows=Array.from({length:91},(_,i)=>({...bestiaryFixtures()[0],slug:'goblin-'+i,nom:'Gobelin '+String(i).padStart(3,'0')}));
  const store=createBestiaryStore({collection:bestiaryMemory(rows)}),a=await store.search(),b=await store.search({offset:40}),c=await store.search({offset:80});
  assert.equal(a.total,91);assert.equal(a.available,91);assert(a.hasMore);assert.equal(c.hasMore,false);
  assert.equal(new Set([...a.monsters,...b.monsters,...c.monsters].map(m=>m.id)).size,91);
});
test('Aperçu structuré : attaques normalisées, bonus zéro et valeurs absentes conservés sans invention',async()=>{
  const raw=bestiaryFixtures()[0];raw.attaques[0].bonus=0;const record=normalizeBestiaryMonster(raw);
  assert.equal(record.maxHp,7);assert.equal(record.ac,15);assert.equal(record.attacks[0].attackBonus,0);
  assert.equal(record.abilities.DEX.modifier,2);assert.equal(record.initiativeBonus,null);
  assert.equal(record.abilities.INT.score,10);assert.equal(record.actions.length,0);
  assert.equal(record.fingerprint,normalizeBestiaryMonster(raw).fingerprint);
  assert.equal(normalizeBestiaryMonster({...raw,pv:undefined}).usable,false);
  assert.equal(normalizeBestiaryMonster({...raw,ca:0}).usable,true);
});
test('Validation des filtres, des identifiants et des FP sans expressions exécutables',async()=>{
  const store=createBestiaryStore({collection:bestiaryMemory()});
  for(const options of [{min:'n/a'},{min:'2',max:'1'},{offset:-1},{offset:1.5},{q:'x'.repeat(101)},{type:[]}])await assert.rejects(store.search(options),e=>e.status===400);
  for(const id of ['../goblin','',{},'missing'])await assert.rejects(store.get(id),e=>e.status===404);
  assert.equal(bestiaryCR('1/8'),0.125);assert.equal(bestiaryCR('1/0'),null);assert.equal(bestiaryCR('1junk'),null);
});
test('Cache de recherche, ajout frais et copies isolées : aucune écriture dans le bestiaire',async()=>{
  const collection=bestiaryMemory(),store=createBestiaryStore({collection});
  const original=JSON.stringify(collection.rows);await Promise.all([store.search(),store.search()]);assert.equal(collection.reads,1);
  const profile=await store.get('goblin');profile.maxHp=1000;assert.equal((await store.get('goblin')).maxHp,7);assert.equal(JSON.stringify(collection.rows),original);
  collection.rows[0].pv=12;assert.equal((await store.get('goblin',{fresh:true})).maxHp,12);assert.equal(collection.reads,2);
});
test('Erreur source, doublons et catalogue excessif : pas de faux bestiaire vide',async()=>{
  const store=createBestiaryStore({collection:{find(){return {limit(){return this;},async toArray(){throw Error('offline');}};}}});await assert.rejects(store.search());
  const duplicate=createBestiaryStore({collection:bestiaryMemory([bestiaryFixtures()[0],bestiaryFixtures()[0]])});await assert.rejects(duplicate.search(),e=>e.status===503);
  const tooLarge=createBestiaryStore({collection:bestiaryMemory(Array(10001).fill(bestiaryFixtures()[0]))});await assert.rejects(tooLarge.search(),e=>e.status===503);
});
test('Descriptions héritées très longues : aperçu borné et abréviation signalée',()=>{
  const raw=bestiaryFixtures()[0];raw.traits=Array.from({length:40},()=>({nom:'Trait',description:'龍'.repeat(10000)}));
  const profile=normalizeBestiaryMonster(raw);assert(profile.descriptionsAbbreviated);assert(Buffer.byteLength(JSON.stringify(profile))<100500);
});
