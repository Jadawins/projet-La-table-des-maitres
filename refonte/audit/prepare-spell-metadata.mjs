import fs from 'node:fs';
import {buildCatalogue} from '../catalogue.mjs';

// A bounded preparation pass: headers and CC BY reference text only.
// Saves, damage, zones, scaling and summon profiles still require comparison.
const root=new URL('../',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,root),'utf8'));
const write=(name,value)=>fs.writeFileSync(new URL(name,root),JSON.stringify(value,null,2)+'\n');
const snapshot=read('tests/fixtures/rules-2024.json'),catalogue=buildCatalogue(snapshot);
const reference=read('audit/spell-reference-2024.json');
const complete=new Set(read('audit/spell-comparisons-2024.json').entries.map(e=>e.id));
const plan=read('data/rules-2024-corrections.json'),ledger=read('audit/rules-2024-ledger.json'),status=read('audit/rules-2024-status.json');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
let prepared=0;
for(const entry of reference.entries){
  if(entry.catalogueIds.length!==1)continue;
  const id=entry.catalogueIds[0],raw=snapshot.collections.sorts.find(s=>s.id===id);
  if(!raw||complete.has(id))continue;
  const m=entry.metadata,current=catalogue.spells.find(s=>s.id===id);
  if((entry.raw.match(/Temps d’incantation/g)||[]).length!==1||!m.duree_source||!m.portee||!m.composantes_source||!m.temps_incantation)throw Error('Incomplete or overlapping reference '+id);
  const body=entry.raw.slice(entry.raw.indexOf('Durée :')).replace(/^Durée[^\n]+\n/,'');
  if(!body)throw Error('Missing reference body '+id);
  const material=m.composantes_source.match(/\bM\s*\(([\s\S]*)\)$/)?.[1]||false;
  const fields={niveau:m.niveau,ecole:m.ecole,classes:m.classes,temps_incantation:m.temps_incantation.replace(/ ou rituel$/,''),portee:m.portee,composantes:{V:/\bV\b/.test(m.composantes_source),S:/\bS\b/.test(m.composantes_source),M:material},duree:m.duree_source,concentration:/Concentration/i.test(m.duree_source),rituel:/rituel/.test(m.temps_incantation),description:body};
  let correction=plan.corrections.find(c=>c.collection==='sorts'&&c.id===id);
  for(const [field,after]of Object.entries(fields)){
    if(equal(current[field],after))continue;
    if(!correction){correction={collection:'sorts',id,source:entry.url,checkedAt:'2026-10-29',scope:'metadata-and-official-reference-text',reason:'En-tête et texte français CC BY 5.2.1 rétablis ; contrôle des champs de calcul suivi séparément, pas de conformité complète déclarée.',changes:[]};plan.corrections.push(correction);}
    const old=correction.changes.find(c=>c.path.length===1&&c.path[0]===field);
    if(correction.changes.some(c=>c.path[0]===field&&c.path.length!==1))throw Error('Overlapping metadata correction '+id+'/'+field);
    if(old)old.after=after;else correction.changes.push({path:[field],...(Object.hasOwn(raw,field)?{before:raw[field]}:{beforeMissing:true}),after});
  }
  const row=ledger.entries.find(r=>r.collection==='sorts'&&r.id===id);
  Object.assign(row,{status:'partial-fields-prepared',fieldsCompared:[...new Set([...(row.fieldsCompared||[]),...Object.keys(fields)])],source:entry.url,scope:'metadata-and-official-reference-text',note:'En-tête et texte officiel préparés. Restent : dégâts/JS/attaque/zone, montée en puissance et profils éventuels, puis tests finaux.',evidence:'refonte/audit/spell-reference-2024.json'});
  entry.status='partial-fields-prepared';
  prepared++;
}
const rows=ledger.entries.filter(r=>r.collection==='sorts');
Object.assign(status.modules.find(m=>m.id==='sorts'),{reviewed:rows.filter(r=>['verified','data-compared-tests-pending'].includes(r.status)).length,prepared:rows.filter(r=>r.status!=='pending').length,status:'partial-module',verified:rows.filter(r=>r.status==='verified').length});
status.correctionsPrepared=plan.corrections.length+plan.additions.length;
status.updatedAt=new Date().toISOString();
status.phase='Profils et dons préparés ; sorts : textes et en-têtes du SRD rétablis, champs de calcul en cours de comparaison. Tests finaux différés.';
write('data/rules-2024-corrections.json',plan);write('audit/rules-2024-ledger.json',ledger);write('audit/rules-2024-status.json',status);write('audit/spell-reference-2024.json',reference);
console.log('Prepared headers and reference text for '+prepared+' spells; calculation fields still open.');
