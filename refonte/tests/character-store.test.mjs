import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {validateSavedCharacter,characterSnapshot} from '../maquette/character-storage.mjs';
import {createCharacterStore} from '../access/character-store.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../data/rules-mongodb.json',import.meta.url),'utf8')));
const id='12345678-1234-1234-1234-123456789abc';
const state=()=>({schemaVersion:2,name:'Clerc test',classId:'clerc',speciesId:'humain',backgroundId:'charlatan',equipment:'A',level:3,scores:{FOR:12,DEX:11,CON:14,INT:14,SAG:18,CHA:9},statsMethod:'physical',bonusMode:'three',bonusTwo:'',bonusOne:'',divineOrder:'Thaumaturge',subclassId:'clerc_domaine_vie',classSkills:['Médecine','Religion'],speciesSkill:'Perception',speciesSize:'M',originFeatId:'robuste',hpMode:'fixed',hpRolls:{},variantId:'',backgroundTool:'',cantrips:[],prepared:[],rolls:[],step:7,details:{story:'Une histoire à conserver'}});
function setup(){
  const records=[];const matches=(doc,filter)=>Object.entries(filter).every(([k,v])=>doc[k]===v);
  const collection={
    async findOne(filter){return structuredClone(records.find(d=>matches(d,filter))||null);},
    async insertOne(doc){if(records.some(d=>d.user_id===doc.user_id&&d.client_id===doc.client_id)){const error=new Error();error.code=11000;throw error;}records.push(structuredClone(doc));},
    async updateOne(filter,update){const index=records.findIndex(d=>matches(d,filter));if(index<0)return {matchedCount:0};records[index]={...records[index],...structuredClone(update.$set)};return {matchedCount:1};},
    find(filter){return {sort(){return this;},limit(){return this;},async toArray(){return structuredClone(records.filter(d=>matches(d,filter)));}};},
  };
  return {records,store:createCharacterStore({collection,validate:s=>validateSavedCharacter(s,c),catalogueFingerprint:'test-catalogue'})};
}
test('Enregistrer puis relire toutes les sélections et les notes sans modifier le personnage',async()=>{
  const {store,records}=setup(),s=state(),before=JSON.stringify(s);const saved=await store.save('account-a',id,s,0);assert.equal(saved.revision,1);
  const read=await store.get('account-a',id);assert.deepEqual(read.character,saved.character);assert.equal(read.character.details.story,s.details.story);assert.equal(JSON.stringify(s),before);assert.equal(records[0].user_id,'account-a');assert.equal(records[0].catalogue_fingerprint,'test-catalogue');
});
test('Répéter la même sauvegarde après une coupure ne crée pas de doublon',async()=>{
  const {store,records}=setup();await store.save('a',id,state(),0);const retry=await store.save('a',id,state(),0);assert.equal(records.length,1);assert.equal(retry.revision,1);
});
test('Mettre à jour le même personnage conserve sa création et augmente sa version',async()=>{
  const {store,records}=setup(),first=await store.save('a',id,state(),0),changed=state();changed.details.story='Nouvelle histoire';const next=await store.save('a',id,changed,1);assert.equal(next.revision,2);assert.equal(next.createdAt,first.createdAt);assert.equal(records.length,1);assert.equal((await store.get('a',id)).character.details.story,'Nouvelle histoire');
});
test('Un autre compte ne peut ni lire, ni lister, ni écraser le personnage',async()=>{
  const {store}=setup();await store.save('a',id,state(),0);assert.deepEqual(await store.list('b'),[]);await assert.rejects(store.get('b',id),e=>e.status===404);const b=state();b.name='Compte B';await store.save('b',id,b,0);assert.equal((await store.get('a',id)).character.name,'Clerc test');assert.equal((await store.list('b'))[0].name,'Compte B');
});
test('Une ancienne version ne remplace pas silencieusement les changements d’un autre appareil',async()=>{
  const {store}=setup();await store.save('a',id,state(),0);const s=state();s.name='Version récente';await store.save('a',id,s,1);s.name='Ancienne version';await assert.rejects(store.save('a',id,s,1),e=>e.status===409);assert.equal((await store.get('a',id)).character.name,'Version récente');
});
test('Le propriétaire et les valeurs dérivées fournis par le navigateur ne sont jamais enregistrés',async()=>{
  const {store,records}=setup(),s=state();s.user_id='victim';s.pv=999;s.cloudRevision=999;const saved=await store.save('real-owner',id,s,0);assert.equal(records[0].user_id,'real-owner');assert.equal(saved.character.user_id,undefined);assert.equal(saved.character.pv,undefined);assert.equal(saved.character.cloudRevision,undefined);
});
test('Une fiche incomplète peut être conservée dans le compte sans être annoncée complète',async()=>{
  const {store}=setup();const saved=await store.save('a',id,state(),0);assert.equal(saved.status,'draft');assert.ok(saved.issues.length);assert.equal(saved.character.level,3);
});
test('Des types invalides, caractéristiques hors limites ou identifiants inconnus sont refusés avant écriture',async()=>{
  const {store,records}=setup();for(const modify of [s=>s.scores.CON=100,s=>s.classId='unknown',s=>s.name='',s=>s.cantrips={bad:true},s=>s.level=21]){const s=state();modify(s);await assert.rejects(store.save('a',id,s,0),e=>e.status===400);}assert.equal(records.length,0);
});
test('Le snapshot envoyé en ligne exclut les métadonnées locales et conserve dés physiques et détails',()=>{
  const s=state();s.cloudSnapshot='local-only';const copy=characterSnapshot(s);assert.equal(copy.cloudSnapshot,undefined);assert.equal(copy.statsMethod,'physical');assert.deepEqual(copy.details,s.details);assert.deepEqual(copy.scores,s.scores);
});
