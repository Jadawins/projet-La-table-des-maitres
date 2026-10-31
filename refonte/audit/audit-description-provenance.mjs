// Read-only documentary inventory. Text similarity is evidence, not a rights verdict.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildCatalogue} from '../catalogue.mjs';
import {catalogueEntries} from '../maquette/portal-view.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const output=path.join(base,'.local/descriptions-review');fs.mkdirSync(output,{recursive:true});
const pdf=path.join(output,'SRD-fr-5.2.1.pdf'),textFile=path.join(output,'SRD-fr-5.2.1.txt');
const hash=value=>createHash('sha256').update(value).digest('hex');
const reference=read('audit/spell-reference-2024.json');assert.equal(hash(fs.readFileSync(pdf)),reference.sourcePdfSha256,'Official PDF must match the frozen documentary reference');
const catalogue=buildCatalogue(read('tests/fixtures/rules-2024.json'));assert.equal(hash(JSON.stringify(catalogue)),read('access/rules-release.json').sha256,'Inventory must match production catalogue');
const editorial=read('data/editorial-description-corrections-20261030.json');
const rewrite=read('data/non-srd-description-rewrite-20261030.json');
const featRewrite=read('data/non-srd-feat-rewrite-20261031.json');
const finalRewrite=read('data/editorial-final-rewrite-20261031.json');
const finalReview=read('audit/editorial-final-dispositions-20261031.json');assert.equal(finalReview.catalogueSha256,read('access/rules-release.json').sha256);
const featMembership=read('audit/feat-srd-membership-2024.json');assert.equal(featMembership.catalogueSha256,featRewrite.baseCatalogueSha256,'Feat membership must match the reference before feat rewrite');assert.equal(featMembership.pdfSha256,reference.sourcePdfSha256,'Feat membership must use the same SRD');
const textEdits=new Map();for(const edition of [editorial,rewrite,featRewrite,finalRewrite])for(const c of edition.corrections)textEdits.set(JSON.stringify([c.collection,c.id,c.path.join('.')]),{...c,edition:edition.id});
const subclassMembership=read('audit/subclass-srd-membership-2024.json');assert.equal(subclassMembership.catalogueSha256,editorial.baseCatalogueSha256,'Subclass membership must match the frozen mechanical baseline');assert.equal(subclassMembership.pdfSha256,reference.sourcePdfSha256,'Subclass membership must use the same SRD');
const spellMembership=read('audit/spell-srd-membership-2024.json');assert.equal(spellMembership.catalogueSha256,editorial.baseCatalogueSha256,'Spell membership must match the frozen mechanical baseline');assert.equal(spellMembership.pdfSha256,reference.sourcePdfSha256,'Spell membership must use the same SRD');
const revision=read('data/rules-2024-corrections.json'),ledger=read('audit/rules-2024-ledger.json').entries;
const norm=value=>String(value).replace(/(\p{L})[-\u00ad]\s*\r?\n\s*(\p{L})/gu,'$1$2').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const tokenPages=fs.readFileSync(textFile,'utf8').split('\f').filter(p=>p.trim()).map(p=>norm(p).split(' '));
const sourceWords=[],pageAt=[],index=new Map();
tokenPages.forEach((words,page)=>{for(const word of words){sourceWords.push(word);pageAt.push(page+1);}});
for(let i=0;i<=sourceWords.length-12;i++){const key=sourceWords.slice(i,i+12).join(' ');let positions=index.get(key);if(!positions)index.set(key,positions=[]);if(positions.length<20)positions.push(i);}
function similarity(text){
  const words=norm(text).split(' ');if(words.length<12)return {kind:'short-text',words:words.length};
  let best=0,page=null;
  for(let i=0;i<=words.length-12;i++)for(const start of index.get(words.slice(i,i+12).join(' '))||[]){let length=12;while(i+length<words.length&&sourceWords[start+length]===words[i+length])length++;if(length>best){best=length;page=pageAt[start];}}
  return {kind:best===words.length?'exact-after-normalization':best>=12?'shared-span':'no-long-match',words:words.length,longestMatchingWords:best,page};
}
const collectionMap={classes:'classes',subclasses:'sous_classes',species:'especes',backgrounds:'backgrounds',spells:'sorts',feats:'dons',weapons:'armes',armors:'armures',tools:'outils',masteries:'armes_bottes',skills:'competences',shapeForms:'formes_animales',dragonForms:'formes_draconiques',familiars:'familiers'};
const skip=new Set(['id','_id','_source','source','source_url','url','reference','references','sources','version','derniere_maj','checkedAt','date','policy','note','nom','name']);
function passages(value,path=[],result=[]){
  if(typeof value==='string'){
    const key=String(path.at(-1)||'');if(!/^https?:/.test(value)&&(/description|^desc$|texte|details|regle|niveau_superieur/.test(key)||value.length>=40&&/\s/.test(value)))result.push({path,text:value});
  }else if(Array.isArray(value))value.forEach((v,i)=>passages(v,[...path,i],result));
  else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))if(!skip.has(k))passages(v,[...path,k],result);
  return result;
}
const prefix=(a,b)=>a.every((key,i)=>String(key)===String(b[i]));
const main=catalogueEntries(catalogue);
const rows=[...main,...['skills','shapeForms','dragonForms','familiars'].flatMap(type=>catalogue[type].map((item,i)=>({type,id:String(item.id||item.slug||i),item})))];
const inventory=[];
for(const entry of rows){
  const collection=collectionMap[entry.type],item=entry.item,identity=String(item.id||item.slug||item._source||item.nom||entry.id);
  const matching=e=>e.collection===collection&&(e.id===identity||e.id===item.nom||e.id===item._source||norm(e.name||'')===norm(item.nom||'__missing__'));
  const comparison=ledger.find(matching),corrections=revision.corrections.filter(matching),addition=revision.additions.find(matching);
  const fields=passages(item).map(({path,text})=>{
    const changes=corrections.flatMap(c=>c.changes.filter(change=>prefix(change.path,path)||prefix(path,change.path)).map(change=>({source:c.source,path:change.path}))).sort((a,b)=>b.path.length-a.path.length);
    const direct=changes[0]?.source||addition?.source||item.source_url||null;
    const provenance=direct?/srd/i.test(direct)?'documented-srd-field':'documented-other-field':comparison?/srd/i.test(comparison.source||'')?'srd-comparison-only':'other-comparison-only':'not-traced';
    const edit=textEdits.get(JSON.stringify([entry.type,entry.id,path.join('.')]));
    if(edit)assert.equal(text,edit.after,'Inventoried editorial text must match the approved correction');
    return {path:path.join('.'),characters:text.length,sha256:hash(text),provenance,source:direct,comparisonSource:comparison?.source||null,...(edit?{editorialChange:{edition:edit.edition,kind:edit.kind,beforeSha256:edit.beforeSha256}}:{}),similarity:similarity(text)};
  });
  const subclass=entry.type==='subclasses'?subclassMembership.entries.find(e=>e.id===entry.id):null;
  if(entry.type==='subclasses')assert(subclass,'Subclass membership must cover '+entry.id);
  const spellIdentity=entry.type==='spells'?spellMembership.entries.find(e=>e.id===entry.id):null;
  if(entry.type==='spells')assert(spellIdentity,'Spell membership must cover '+entry.id);
  const featIdentity=entry.type==='feats'?featMembership.entries.find(e=>e.id===entry.id):null;
  if(entry.type==='feats')assert(featIdentity,'Feat membership must cover '+entry.id);
  const originIdentity=finalReview.membership.find(e=>e.type===entry.type&&e.id===entry.id);
  const srdNamedReference=entry.type==='spells'?reference.entries.find(e=>e.catalogueIds.includes(entry.id))?.url||null:subclass?.status==='included-in-srd-5.2.1'?subclass.source:featIdentity?.status==='included-in-srd-5.2.1'?featIdentity.source:originIdentity?.status==='included-in-srd-5.2.1'?originIdentity.source:null;
  inventory.push({type:entry.type,id:entry.id,name:item.nom||item.name||entry.id,comparisonSource:comparison?.source||null,srdNamedReference,...(subclass?{srdMembership:subclass.status,srdName:subclass.srdName,srdPdfPage:subclass.pdfPage,proseRightsStatus:subclass.review.permissionStatus}:spellIdentity?{srdMembership:spellIdentity.status,srdName:spellIdentity.srdName,srdPdfPage:spellIdentity.pdfPage,proseRightsStatus:spellIdentity.textReview?.permissionStatus||spellIdentity.permissionStatus}:featIdentity?{srdMembership:featIdentity.status,srdName:featIdentity.srdName,srdPdfPage:featIdentity.pdfPage,proseRightsStatus:featIdentity.permissionStatus}:originIdentity?{srdMembership:originIdentity.status,srdName:originIdentity.name,proseRightsStatus:originIdentity.status==='included-in-srd-5.2.1'?'srd-attribution-required':'non-srd-rights-not-established'}:{}),reviewGroup:entry.type==='spells'?(srdNamedReference?'listed-in-srd-spell-index':'not-listed-in-srd-spell-index'):subclass?subclass.status:featIdentity?featIdentity.status:originIdentity?originIdentity.status:comparison?(/srd/i.test(comparison.source||'')?'srd-comparison-reference':'other-comparison-reference-membership-unresolved'):'reference-not-traced',fields});
}
const extras=['classSupplements','fighterSupplements','remainingSupplements','invocations','originCorrections'].map(type=>({type,fields:passages(catalogue[type]).map(({path,text})=>({path:path.join('.'),characters:text.length,sha256:hash(text),provenance:'supplement-file-needs-field-attribution',similarity:similarity(text)}))}));
const count=(rows,key)=>Object.fromEntries([...new Set(rows.map(key))].map(k=>[k,rows.filter(r=>key(r)===k).length]));
const fields=inventory.flatMap(e=>e.fields),spell=inventory.filter(e=>e.type==='spells');
const summary={catalogueSha256:read('access/rules-release.json').sha256,mainEntries:main.length,entriesIncludingProfiles:inventory.length,entriesWithText:inventory.filter(e=>e.fields.length).length,textFields:fields.length,byCategory:Object.fromEntries([...new Set(inventory.map(e=>e.type))].map(type=>{const items=inventory.filter(e=>e.type===type);return [type,{entries:items.length,textFields:items.reduce((n,e)=>n+e.fields.length,0),comparisonSRD:items.filter(e=>/srd/i.test(e.comparisonSource||'')).length,comparisonOther:items.filter(e=>e.comparisonSource&&!/srd/i.test(e.comparisonSource)).length,comparisonNotTraced:items.filter(e=>!e.comparisonSource).length}];})),fieldProvenance:count(fields,e=>e.provenance),similarity:count(fields,e=>e.similarity.kind),correctionSources:count(revision.corrections,e=>/FR_SRD_CC_v5\.2\.1/.test(e.source||'')?'SRD-5.2.1-FR':'other-reference'),supplementTextFields:extras.reduce((n,e)=>n+e.fields.length,0),spellDescriptions:count(spell.flatMap(e=>e.fields.filter(f=>f.path==='description')),e=>e.similarity.kind)};
summary.spellMembership=count(spell,e=>e.reviewGroup);
summary.confirmedSpellMembership=count(spell,e=>e.srdMembership);
summary.subclassMembership=count(inventory.filter(e=>e.type==='subclasses'),e=>e.srdMembership);
summary.confirmedFeatMembership=count(inventory.filter(e=>e.type==='feats'),e=>e.srdMembership);
summary.editorialReview={status:finalReview.status,unresolvedActiveDescriptionFields:finalReview.unresolvedActiveDescriptionFields,report:'editorial-final-dispositions-20261031.json'};
summary.editorialEdition={id:finalRewrite.id,changedFields:finalRewrite.corrections.length,proseEdits:finalRewrite.corrections.length,spacingEdits:0,previousEdition:featRewrite.id,coverage:finalRewrite.coverage};
const report={createdAt:new Date().toISOString(),scope:'Read-only text provenance and normalized comparison; no application/rule/database changes. Main catalogue and additional profiles inventoried. Supplemental JSON text inventoried separately. UI/generated labels and source books outside the supplied references are not exhaustively compared.',method:{reference:'Official FR SRD 5.2.1',pdfSha256:hash(fs.readFileSync(pdf)),pages:tokenPages.length,comparison:'PDF extracted in column order using PDFium. Case/accents/punctuation normalized; at least 12 consecutive matching words. This is a documentary similarity signal, not a plagiarism finding or a permission verdict. A source used to check a mechanic does not establish the origin of unchanged legacy prose. A paraphrase alone does not establish lawful reuse.'},summary,entries:inventory,supplements:extras};
fs.writeFileSync(path.join(output,'inventory.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
