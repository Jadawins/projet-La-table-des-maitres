import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildCatalogue} from '../catalogue.mjs';
import {applyEditorialRevision} from '../editorial-revision.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import plan from '../data/non-srd-description-rewrite-20261030.json' with {type:'json'};
import membership from '../audit/subclass-srd-membership-2024.json' with {type:'json'};
const snapshot=JSON.parse(readFileSync(new URL('fixtures/rules-2024.json',import.meta.url)));
const before=applyEditorialRevision(buildCatalogue(snapshot,{editorial:false})),after=buildCatalogue(snapshot,{editorialUntil:plan.id});
const hash=v=>createHash('sha256').update(v).digest('hex');
const at=(c,change)=>change.path.reduce((v,k)=>v[k],c[change.collection].find(r=>r.id===change.id));

test('Réécriture : 51 sorts, huit profils et les aptitudes des 36 sous-classes, sans autre modification',()=>{
  assert.equal(hash(JSON.stringify(before)),plan.baseCatalogueSha256);
  assert.equal(plan.corrections.length,238);
  const spellMain=plan.corrections.filter(c=>c.collection==='spells'&&c.path.join('.')==='description');assert.equal(spellMain.length,51);
  assert.equal(plan.corrections.filter(c=>c.collection==='spells'&&c.path.join('.')==='invocation.description').length,8);
  const ids=new Set(plan.corrections.filter(c=>c.collection==='subclasses').map(c=>c.id));assert.equal(ids.size,36);
  assert.deepEqual([...ids].sort(),membership.entries.filter(e=>e.status==='not-included-in-srd-5.2.1').map(e=>e.id).sort());
  const restored=structuredClone(after);
  for(const c of plan.corrections){assert.equal(at(before,c),c.before);assert.equal(hash(c.before),c.beforeSha256);assert.equal(at(after,c),c.after);assert.notEqual(c.before,c.after);let row=restored[c.collection].find(r=>r.id===c.id);for(const k of c.path.slice(0,-1))row=row[k];row[c.path.at(-1)]=c.before;}
  restored.provenance.editorialRevision=plan.previousEditorialRevision;assert.deepEqual(restored,before);
  assert.equal(after.provenance.revision.id,before.provenance.revision.id);
});

test('Toutes les valeurs numériques et tous les dés sont conservés dans chaque résumé',()=>{
  const numbers=t=>(t.match(/\d+(?:[.,]\d+)?(?:d\d+)?/g)||[]).sort();
  for(const c of plan.corrections)assert.deepEqual(numbers(c.after),numbers(c.before),c.id+'/'+c.path.join('.'));
  assert.equal(plan.retained.length,2);for(const c of plan.retained)assert.equal(hash(at(after,c)),c.beforeSha256);
});

test('Le lot refuse un texte ou une édition source différent, sans mutation',()=>{
  const drift=structuredClone(before);drift.provenance.editorialRevision.id='different';const copy=structuredClone(drift);
  assert.throws(()=>applyEditorialRevision(drift,plan),/précédente/);assert.deepEqual(drift,copy);
  assert.throws(()=>applyEditorialRevision(after,plan),/précédente/);
});

test('Parité des fiches avant/après aux niveaux 3, 10 et 20 pour les 36 sous-classes',()=>{
  const keys=['scores','mods','proficiency','skills','saves','attacks','ac','magic','slots','hp','initiative','passive','speed','darkvision','blindvision','climb','swim','immunities','resistances','attacksPerAction','classResources','speciesResources','weaponTraining','armorTraining','tools','errors'];
  const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['description','trait','notes','summaries'].includes(k)).map(([k,x])=>[k,clean(x)])):v;
  const project=m=>clean(Object.fromEntries(keys.map(k=>[k,m[k]])));
  let compared=0;
  for(const sub of membership.entries.filter(e=>e.status==='not-included-in-srd-5.2.1'))for(const level of [3,10,20]){
    const state=classFixture(before,sub.classId,level,sub.id);
    assert.deepEqual(project(sheetModel(state,after)),project(sheetModel(state,before)),sub.id+' niveau '+level);compared++;
  }
  assert.equal(compared,108);
});
