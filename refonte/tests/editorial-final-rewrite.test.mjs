import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildCatalogue} from '../catalogue.mjs';
import {applyEditorialRevision} from '../editorial-revision.mjs';
import {originCases,originFixture} from '../audit/origin-fixtures.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import plan from '../data/editorial-final-rewrite-20261031.json' with {type:'json'};
const source=JSON.parse(fs.readFileSync(new URL('fixtures/rules-2024.json',import.meta.url)));
const before=buildCatalogue(source,{editorialUntil:plan.previousEditorialRevision.id}),after=buildCatalogue(source);
const hash=v=>createHash('sha256').update(v).digest('hex');
const at=(catalogue,c)=>c.id==='$root'?catalogue[c.collection]:catalogue[c.collection].find(r=>(r.id||r.slug)===c.id);
test('Dernière édition : 244 rédactions, avec restitution exacte du catalogue antérieur',()=>{
 assert.equal(hash(JSON.stringify(before)),plan.baseCatalogueSha256);
 assert.equal(plan.corrections.length,244);
 const restored=structuredClone(after);
 for(const c of plan.corrections){
  let row=at(restored,c);for(const k of c.path.slice(0,-1))row=row[k];
  assert.equal(row[c.path.at(-1)],c.after);assert.equal(hash(c.before),c.beforeSha256);
  const numbers=s=>(s.match(/\d+(?:[.,]\d+)?(?:d\d+)?/g)||[]).sort();assert.deepEqual(numbers(c.after),numbers(c.before),c.id);
  row[c.path.at(-1)]=c.before;
 }
 restored.provenance.editorialRevision=plan.previousEditorialRevision;assert.deepEqual(restored,before);
});
test('Tous les historiques, présentations d’espèce et aides hors SRD restantes sont traités',()=>{
 for(const b of after.backgrounds){const changes=plan.corrections.filter(c=>c.collection==='backgrounds'&&c.id===b.id);assert.equal(changes.length,9);assert.equal(changes.filter(c=>c.path[0]==='caracteristiques_suggerees').length,8);}
 for(const s of after.species)assert(plan.corrections.some(c=>c.collection==='species'&&c.id===s.id&&c.path.join('.')==='description'));
 assert.equal(plan.corrections.filter(c=>c.collection==='fighterSupplements').length,21);
 assert.equal(plan.corrections.filter(c=>c.collection==='familiars').length,2);
 assert.deepEqual(after.feats,before.feats);assert.deepEqual(after.shapeForms,before.shapeForms);assert.deepEqual(after.dragonForms,before.dragonForms);
 assert.deepEqual(after.invocations,before.invocations);assert.deepEqual(after.remainingSupplements,before.remainingSupplements);
});
test('L’édition de textes ne permet pas de modifier un score, un coût ou un type de créature',()=>{
 for(const change of [
  {collection:'backgrounds',id:'acolyte',path:['bonus_caracteristiques','suggerees',0],before:'INT',after:'FOR'},
  {collection:'fighterSupplements',id:'$root',path:['maneuvers',0,'level'],before:'3',after:'20'},
  {collection:'familiars',id:'slaad-tadpole',path:['type'],before:'Aberration',after:'Beast'},
 ])assert.throws(()=>applyEditorialRevision(before,{...plan,corrections:[change]}));
 assert.throws(()=>applyEditorialRevision(after,plan),/précédente/);
});
const keys=['scores','mods','proficiency','skills','saves','attacks','ac','magic','slots','hp','initiative','passive','speed','darkvision','blindvision','climb','swim','immunities','resistances','attacksPerAction','classResources','speciesResources','weaponTraining','armorTraining','tools','errors'];
const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['description','desc','trait','notes','summaries'].includes(k)).map(([k,x])=>[k,clean(x)])):v;
const project=m=>({...clean(Object.fromEntries(keys.map(k=>[k,m[k]]))),spellMechanics:m.spells.map(s=>({id:s.id,dc:s.dc,attackBonus:s.attackBonus,damageAtLevel:s.damageAtLevel,cantripBonus:s.cantripBonus}))});
test('Parité des fiches pour les 16 historiques avec les 12 classes',()=>{
 for(const cls of before.classes)for(const bg of before.backgrounds){const state=originFixture(before,cls.id,3,{speciesId:'humain'},bg.id);assert.deepEqual(project(sheetModel(state,after)),project(sheetModel(state,before)),cls.id+'/'+bg.id);}
});
test('Parité des variantes et tailles d’espèce aux niveaux 1, 3 et 20',()=>{
 for(const origin of originCases(before))for(const level of [1,3,20]){const state=originFixture(before,'clerc',level,origin,'acolyte');assert.deepEqual(project(sheetModel(state,after)),project(sheetModel(state,before)),JSON.stringify([origin,level]));}
});
test('Parité des 48 sous-classes aux niveaux 3, 10 et 20 après les dernières rédactions',()=>{
 for(const sub of before.subclasses)for(const level of [3,10,20]){const state=classFixture(before,sub.classe_parente,level,sub.id);assert.deepEqual(project(sheetModel(state,after)),project(sheetModel(state,before)),sub.id+'/'+level);}
});
test('Les sorts mineurs rédigés conservent leurs dégâts aux cinq paliers de contrôle',()=>{
 const norm=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
 const changed=new Set(plan.corrections.filter(c=>c.collection==='spells').map(c=>c.id));
 for(const spell of before.spells.filter(s=>s.niveau===0&&changed.has(s.id)))for(const level of [1,5,11,17,20]){
  const cls=before.classes.find(c=>spell.classes.some(name=>norm(name)===norm(c.nom)));assert(cls,spell.id);
  const sub=before.subclasses.find(s=>s.classe_parente===cls.id);
  const state=classFixture(before,cls.id,level,sub.id);state.cantrips=[spell.id];
  const old=sheetModel(state,before).spells.find(s=>s.id===spell.id),current=sheetModel(state,after).spells.find(s=>s.id===spell.id);
  assert(old&&current,spell.id);assert.equal(current.damageAtLevel,old.damageAtLevel,spell.id+'/'+level);assert.equal(current.dc,old.dc);
 }
});
