import fs from 'node:fs';
import {buildCatalogue} from '../catalogue.mjs';

const root=new URL('../',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,root),'utf8'));
const write=(name,value)=>fs.writeFileSync(new URL(name,root),JSON.stringify(value,null,2)+'\n');
const snapshot=read('tests/fixtures/rules-2024.json');
const catalogue=buildCatalogue(snapshot);
const reference=read('audit/spell-comparisons-2024.json');
const plan=read('data/rules-2024-corrections.json');
const ledger=read('audit/rules-2024-ledger.json');
const status=read('audit/rules-2024-status.json');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const seen=new Set();
for(const entry of reference.entries){
  if(seen.has(entry.id))throw Error('Duplicate spell comparison '+entry.id);
  seen.add(entry.id);
  const raw=snapshot.collections.sorts.find(s=>s.id===entry.id);
  const current=catalogue.spells.find(s=>s.id===entry.id);
  if(!raw||!current||!entry.source)throw Error('Invalid spell reference '+entry.id);
  let correction=plan.corrections.find(c=>c.collection==='sorts'&&c.id===entry.id);
  for(const [field,after]of Object.entries(entry.fields)){
    if(equal(current[field],after))continue;
    if(!correction){correction={collection:'sorts',id:entry.id,checkedAt:reference.checkedAt,source:entry.source,scope:'full-spell-comparison',reason:'Métadonnées, effets et champs structurés comparés ; descriptions remplacées par la référence française CC BY lorsque disponible.',changes:[]};plan.corrections.push(correction);}
    const old=correction.changes.find(c=>c.path.length===1&&c.path[0]===field);
    if(correction.changes.some(c=>c.path[0]===field&&c.path.length!==1))throw Error('Overlapping spell correction '+entry.id+'/'+field);
    if(old)old.after=after;
    else correction.changes.push({path:[field],...(Object.hasOwn(raw,field)?{before:raw[field]}:{beforeMissing:true}),after});
  }
  if(correction){correction.source=entry.source;correction.scope='full-spell-comparison';}
  const row=ledger.entries.find(r=>r.collection==='sorts'&&r.id===entry.id);
  if(!row)throw Error('Missing spell ledger entry '+entry.id);
  Object.assign(row,{status:'data-compared-tests-pending',fieldsCompared:entry.fieldsCompared,source:entry.source,scope:'full-spell-comparison',note:entry.note,evidence:'refonte/audit/spell-comparisons-2024.json'});
}
const rows=ledger.entries.filter(r=>r.collection==='sorts');
Object.assign(status.modules.find(m=>m.id==='sorts'),{reviewed:rows.filter(r=>['verified','data-compared-tests-pending'].includes(r.status)).length,prepared:rows.filter(r=>r.status!=='pending').length,status:'partial-module',verified:rows.filter(r=>r.status==='verified').length});
status.correctionsPrepared=plan.corrections.length+plan.additions.length;
status.updatedAt=new Date().toISOString();
write('data/rules-2024-corrections.json',plan);
write('audit/rules-2024-ledger.json',ledger);
write('audit/rules-2024-status.json',status);
console.log('Prepared '+seen.size+' complete spell comparisons; '+status.correctionsPrepared+' journal entries.');
