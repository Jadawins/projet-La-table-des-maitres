import fs from 'node:fs';
import {buildCatalogue} from '../catalogue.mjs';

// Apply only explicitly compared fields. Preserve the original snapshot and
// original before values when a previous partial correction is extended.
const root=new URL('../',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,root),'utf8'));
const write=(name,value)=>fs.writeFileSync(new URL(name,root),JSON.stringify(value,null,2)+'\n');
const snapshot=read('tests/fixtures/rules-2024.json');
const catalogue=buildCatalogue(snapshot);
const reference=read('audit/feat-reference-2024.json');
const plan=read('data/rules-2024-corrections.json');
const ledger=read('audit/rules-2024-ledger.json');
const status=read('audit/rules-2024-status.json');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const seen=new Set();
for(const entry of reference.entries){
  if(seen.has(entry.id))throw Error('Duplicate feat reference '+entry.id);
  seen.add(entry.id);
  const raw=snapshot.collections.dons.find(f=>f.id===entry.id);
  const current=catalogue.feats.find(f=>f.id===entry.id);
  if(!raw||!current||!entry.source)throw Error('Invalid feat reference '+entry.id);
  let correction=plan.corrections.find(c=>c.collection==='dons'&&c.id===entry.id);
  for(const [field,after]of Object.entries(entry.fields)){
    if(equal(current[field],after))continue;
    if(!correction){correction={collection:'dons',id:entry.id,checkedAt:'2026-10-29',source:entry.source,scope:'full-feat-comparison',reason:'Comparaison du don complet ; prérequis, augmentation et bénéfices corrigés selon la référence retenue.',changes:[]};plan.corrections.push(correction);}
    const old=correction.changes.find(c=>c.path.length===1&&c.path[0]===field);
    if(correction.changes.some(c=>c.path[0]===field&&c.path.length!==1))throw Error('Overlapping correction '+entry.id+'/'+field);
    if(old)old.after=after;
    else correction.changes.push({path:[field],...(Object.hasOwn(raw,field)?{before:raw[field]}:{beforeMissing:true}),after});
  }
  if(correction){correction.source=entry.source;correction.scope='full-feat-comparison';}
  const row=ledger.entries.find(r=>r.collection==='dons'&&r.id===entry.id);
  if(!row)throw Error('Missing ledger feat '+entry.id);
  Object.assign(row,{status:'data-compared-tests-pending',fieldsCompared:['categorie','prerequis','description','effets'],source:entry.source,scope:'full-feat-comparison',note:'Prérequis et bénéfices comparés ; calculs, choix et rendu à contrôler lors des tests finaux.',evidence:'refonte/audit/feat-reference-2024.json'});
}
const rows=ledger.entries.filter(r=>r.collection==='dons');
Object.assign(status.modules.find(m=>m.id==='dons'),{reviewed:rows.filter(r=>['verified','data-compared-tests-pending'].includes(r.status)).length,prepared:rows.filter(r=>r.status!=='pending').length,status:rows.every(r=>['verified','data-compared-tests-pending'].includes(r.status))?'data-compared-tests-pending':'partial-module',verified:rows.filter(r=>r.status==='verified').length});
status.correctionsPrepared=plan.corrections.length+plan.additions.length;
status.updatedAt=new Date().toISOString();
write('data/rules-2024-corrections.json',plan);
write('audit/rules-2024-ledger.json',ledger);
write('audit/rules-2024-status.json',status);
console.log('Prepared '+seen.size+' compared feats; '+status.correctionsPrepared+' journal entries.');
