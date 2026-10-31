import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildCatalogue} from '../catalogue.mjs';
import {applyEditorialRevision} from '../editorial-revision.mjs';
import {featAbilityOptions} from '../maquette/progression.mjs';
import {isRepeatable} from '../maquette/origin-rules.mjs';
import {featFixture} from '../audit/feat-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import plan from '../data/non-srd-feat-rewrite-20261031.json' with {type:'json'};
import membership from '../audit/feat-srd-membership-2024.json' with {type:'json'};
const snapshot=JSON.parse(readFileSync(new URL('fixtures/rules-2024.json',import.meta.url)));
const before=buildCatalogue(snapshot,{editorialUntil:membership.baselineEdition}),after=buildCatalogue(snapshot);
const hash=v=>createHash('sha256').update(v).digest('hex');
const numbers=t=>(String(t).match(/\d+(?:[.,]\d+)?(?:d\d+)?/g)||[]).sort();

test('Dons : 169 textes des 58 dons hors SRD, sans modification des autres champs',()=>{
 assert.equal(hash(JSON.stringify(before)),plan.baseCatalogueSha256);assert.equal(plan.corrections.length,169);
 const ids=[...new Set(plan.corrections.map(c=>c.id))].sort();assert.deepEqual(ids,membership.entries.filter(e=>e.status==='not-included-in-srd-5.2.1').map(e=>e.id).sort());assert.equal(ids.length,58);
 const restored=structuredClone(after);
 for(const c of plan.corrections){let row=restored[c.collection].find(r=>r.id===c.id);for(const key of c.path.slice(0,-1))row=row[key];assert.equal(row[c.path.at(-1)],c.after);assert.equal(hash(c.before),c.beforeSha256);assert.deepEqual(numbers(c.after),numbers(c.before),c.id);row[c.path.at(-1)]=c.before;}
 restored.provenance.editorialRevision=plan.previousEditorialRevision;assert.deepEqual(restored,before);
});

test('Les 17 dons SRD, deux archives, hausses de caractéristique et répétitions sont préservés',()=>{
 assert.equal(plan.retained.length,46);
 for(const old of before.feats){const current=after.feats.find(f=>f.id===old.id),entry=membership.entries.find(e=>e.id===old.id);
  if(entry.status!=='not-included-in-srd-5.2.1')assert.deepEqual(current,old);
  assert.deepEqual(featAbilityOptions(current),featAbilityOptions(old));assert.equal(isRepeatable(current),isRepeatable(old));
  assert.deepEqual(current.prerequis,old.prerequis);assert.deepEqual(current.effets.filter(e=>e.type==='caracteristique'),old.effets.filter(e=>e.type==='caracteristique'));
 }
 assert.equal(membership.summary.srd,17);assert.equal(membership.summary.archived,2);
});

test('Le journal ne peut pas changer une hausse de caractéristique ou une édition source différente',()=>{
 const retained=plan.retained[0],feat=before.feats.find(f=>f.id===retained.id),value=retained.path.reduce((v,k)=>v[k],feat);
 assert.throws(()=>applyEditorialRevision(before,{...plan,corrections:[{...retained,before:value,after:'+8 à FOR'}]}),/hausse de caractéristique/);
 assert.throws(()=>applyEditorialRevision(after,plan),/précédente/);
 assert.throws(()=>buildCatalogue(snapshot,{editorialUntil:'unknown-edition'}),/introuvable/);
 assert.equal(hash(JSON.stringify(buildCatalogue(snapshot,{editorialUntil:membership.baselineEdition}))),plan.baseCatalogueSha256);
});

test('Parité des fiches et des valeurs résolues pour chaque don hors SRD admissible',()=>{
 const keys=['scores','mods','proficiency','skills','saves','attacks','ac','magic','slots','hp','initiative','passive','speed','darkvision','blindvision','climb','swim','immunities','resistances','attacksPerAction','classResources','speciesResources','weaponTraining','armorTraining','tools','errors'];
 const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['description','trait','notes','summaries'].includes(k)).map(([k,x])=>[k,clean(x)])):v;
 const projection=m=>clean(Object.fromEntries(keys.map(k=>[k,m[k]])));
 const covered=[];
 for(const e of membership.entries.filter(e=>e.status==='not-included-in-srd-5.2.1')){
  const feat=before.feats.find(f=>f.id===e.id);let selected=null;
  for(const cls of before.classes){const fixture=featFixture(before,cls.id,feat);if(fixture?.eligible){selected=fixture.state;break;}}
  if(!selected){assert.equal(feat.categorie,'combat',feat.id+' must have an admissible fixture');continue;}
  const old=sheetModel(selected,before),current=sheetModel(selected,after);assert.deepEqual(projection(current),projection(old),feat.id);
  const a=old.effects.summaries.find(s=>s.name===feat.nom),b=current.effects.summaries.find(s=>s.name===feat.nom);assert(a&&b,feat.id);
  assert.deepEqual(b.effects.map(numbers),a.effects.map(numbers),feat.id+' resolved values');covered.push(feat.id);
 }
 assert.equal(covered.length,52);
});
