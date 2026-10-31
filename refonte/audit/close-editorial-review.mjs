// Field-level editorial decisions. This is not a legal clearance certificate.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildCatalogue} from '../catalogue.mjs';
const base=new URL('../',import.meta.url);
const read=f=>JSON.parse(fs.readFileSync(new URL(f,base)));
const write=(f,v)=>fs.writeFileSync(new URL(f,base),JSON.stringify(v,null,2)+'\n');
const catalogue=buildCatalogue(read('tests/fixtures/rules-2024.json'));
const inventory=read('audit/description-provenance-2024.json');
const plan=read('data/editorial-final-rewrite-20261031.json');
const sha=v=>createHash('sha256').update(v).digest('hex');
assert.equal(sha(JSON.stringify(catalogue)),inventory.summary.catalogueSha256);
const pdf=fs.readFileSync(new URL('.local/descriptions-review/SRD-fr-5.2.1.pdf',base));
assert.equal(sha(pdf),inventory.method.pdfSha256);
const pages=fs.readFileSync(new URL('.local/descriptions-review/SRD-fr-5.2.1.txt',base),'utf8').replaceAll('\r','').replace(/\n{2,}/g,'\n').split('\f');
const norm=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const source='https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf';
const backgroundNames=['Acolyte','Criminel','Sage','Soldat'];
for(const name of backgroundNames)assert(pages[86].includes('\n'+name+'\n'));
const speciesPages={drakeide:88,elfe:88,gnome:89,goliath:89,halfelin:90,humain:90,nain:90,orc:90,tieffelin:91};
for(const [id,page]of Object.entries(speciesPages)){
 const name=id==='drakeide'?'Drakéide':catalogue.species.find(s=>s.id===id).nom;
 assert(norm(pages[page-1]).includes(norm(name+'Type de créature')));
}
const excluded=new Set(catalogue.shapeForms.filter(x=>!x.reference2024?.verified).map(x=>x.slug));assert.equal(excluded.size,5);
const membership=inventory.entries.filter(e=>['backgrounds','species','familiars'].includes(e.type)).map(e=>({
 type:e.type,id:e.id,name:e.name,
 status:e.type==='backgrounds'?(backgroundNames.includes(e.name)?'included-in-srd-5.2.1':'not-included-in-srd-5.2.1'):e.type==='species'?(speciesPages[e.id]?'included-in-srd-5.2.1':'not-included-in-srd-5.2.1'):(e.id==='slaad-tadpole'?'not-included-in-srd-5.2.1':'included-in-srd-5.2.1'),
 source:e.type==='backgrounds'?source+'#page=87':e.type==='species'?(speciesPages[e.id]?source+'#page='+speciesPages[e.id]:null):e.comparisonSource,
 wordingPolicy:e.type==='backgrounds'?'All introductions and optional personality examples newly authored; mechanics and generated feat link retained':e.type==='species'?'All introductions newly authored; Aasimar traits newly summarized; SRD trait summaries retained':'Slaad technical texts newly summarized; six SRD profiles retained',
}));
const dispositions=[];
for(const entry of inventory.entries)for(const field of entry.fields){
 let decision,evidence;
 if(field.editorialChange){decision='new-editorial-wording';evidence=field.editorialChange.edition;}
 else if(entry.type==='shapeForms'&&excluded.has(entry.id)||entry.type==='feats'&&entry.srdMembership==='legacy-archive-not-current-feat'){decision='legacy-archive-not-offered';evidence='Existing frozen exclusions retained; not reintroduced into creation. No current prose approval claimed.';}
 else if(/^reference2024\.|^reference\.|^provenance\./.test(field.path)){decision='audit-metadata-not-player-description';evidence='Documentary trace, not a playable rule description.';}
 else if(entry.type==='species'&&entry.id==='aasimar'&&field.path==='taille.details'){decision='mechanical-expression-retained';evidence='Size alternatives and height measurements; existing factual reference retained.';}
 else if(entry.type==='feats'&&/^effets\.\d+\.valeur$/.test(field.path)&&entry.srdMembership==='not-included-in-srd-5.2.1'){
  const feat=catalogue.feats.find(f=>f.id===entry.id),effect=feat.effets[Number(field.path.split('.')[1])];assert.equal(effect.type,'caracteristique');decision='mechanical-expression-retained';evidence='Exact characteristic expression used by the rules parser; not narrative prose.';
 }else if(entry.type==='backgrounds'){
  assert.equal(field.path,'aptitude.description',entry.id+'/'+field.path);decision='application-cross-reference';evidence='Generated link sentence to the feat section, not a book passage.';
 }else{
  assert(!(entry.srdMembership==='not-included-in-srd-5.2.1'),entry.type+'/'+entry.id+'/'+field.path+' is unreviewed');
  assert(!(entry.type==='species'&&entry.id==='aasimar'),entry.id+'/'+field.path);
  assert(!(entry.type==='familiars'&&entry.id==='slaad-tadpole'),entry.id+'/'+field.path);
  assert(!(entry.type==='species'&&field.path==='description'),'Species lore must be replaced');
  decision='srd-reference-or-technical-summary-retained';
  evidence=entry.srdNamedReference||field.source||entry.comparisonSource;
  assert(evidence&&/srd/i.test(evidence),entry.type+'/'+entry.id+'/'+field.path+' requires a source');
 }
 dispositions.push({collection:entry.type,id:entry.id,path:field.path,sha256:field.sha256,decision,evidence});
}
const supplemental=[];
for(const group of inventory.supplements)for(const field of group.fields){
 let decision,evidence;
 if(group.type==='fighterSupplements'){
  const c=plan.corrections.find(c=>c.collection===group.type&&c.path.join('.')===field.path);assert(c,field.path);
  decision='new-editorial-wording';evidence=plan.id;
 }else if(group.type==='invocations'){
  decision='srd-reference-or-technical-summary-retained';evidence=source+'#page=71';
 }else if(group.type==='remainingSupplements'&&/^(rogueStrikes|metamagic)\./.test(field.path)){
  decision='srd-reference-or-technical-summary-retained';evidence=field.path.startsWith('rogueStrikes')?source+'#page=85':source+'#page=52';
 }else if(group.type==='originCorrections'&&field.path.startsWith('goliathAncestries.')){
  decision='srd-reference-or-technical-summary-retained';evidence=source+'#page=89';
 }else{
  assert(group.type==='classSupplements'&&field.path==='land2024.legacy'||group.type==='remainingSupplements'&&['gloryFirstSpells.authorization','unresolvedPolicy'].includes(field.path)||group.type==='originCorrections'&&/^(notes|legacyNotes)\.\d+$/.test(field.path),group.type+'/'+field.path);
  decision='application-or-archival-metadata';evidence='Authored implementation/traceability note; no copied narrative.';
 }
 supplemental.push({collection:group.type,path:field.path,sha256:sha(field.path.split('.').reduce((v,k)=>v[k],catalogue[group.type])),decision,evidence});
}
const tally=rows=>rows.reduce((r,x)=>(r[x.decision]=(r[x.decision]||0)+1,r),{});
const report={status:'editorial-review-complete',date:'2026-10-31',rulesVersion:'phb2024-2026-10-28',catalogueId:plan.id,catalogueSha256:inventory.summary.catalogueSha256,sourcePdfSha256:inventory.method.pdfSha256,
 scope:'All detected catalogue text fields, all 95 supplemental text fields, and all 128 optional background personality examples. Classification includes prose previously inherited inside SRD entries; a matching option name is not treated as proof of provenance of its lore.',
 qualification:'Editorial completion only. Technical summaries identify their mechanical reference, not a legal clearance or a verbatim attribution of every legacy phrase. Short names, numerical formulas, equipment names, component objects, costs and table labels remain factual reference terms. Five unavailable animal variants and two legacy feats remain excluded/archived. PDF, artwork, trademarks and general legal/privacy requirements are separate from this text pass.',
 unresolvedActiveDescriptionFields:0,mainTextFields:dispositions.length,supplementTextFields:supplemental.length,decisions:tally(dispositions),supplementDecisions:tally(supplemental),membership,fields:dispositions,supplements:supplemental};
write('audit/editorial-final-dispositions-20261031.json',report);
console.log(JSON.stringify({status:report.status,main:report.mainTextFields,supplements:report.supplementTextFields,decisions:report.decisions,supplementDecisions:report.supplementDecisions}));
