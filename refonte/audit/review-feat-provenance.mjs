// Read-only source classification and traceability of the feat wording edition.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildCatalogue} from '../catalogue.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(base,f),'utf8'));
const hash=v=>createHash('sha256').update(v).digest('hex');
const normal=v=>v.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const plan=read('data/non-srd-feat-rewrite-20261031.json'),snapshot=read('tests/fixtures/rules-2024.json');
const before=buildCatalogue(snapshot,{editorialUntil:plan.previousEditorialRevision.id}),after=buildCatalogue(snapshot);
assert.equal(hash(JSON.stringify(before)),plan.baseCatalogueSha256);
assert.equal(hash(JSON.stringify(after)),read('access/rules-release.json').sha256);
const pdf=fs.readFileSync(path.join(base,'.local/descriptions-review/SRD-fr-5.2.1.pdf'));
assert.equal(hash(pdf),read('audit/spell-reference-2024.json').sourcePdfSha256);
const pages=fs.readFileSync(path.join(base,'.local/descriptions-review/SRD-fr-5.2.1.txt'),'utf8').split('\f');
const source='https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf';
const refs=[92,93,94].flatMap(page=>[...pages[page-1].replaceAll('\r','').replace(/\n{2,}/g,'\n').matchAll(/^([^\n]+)\nDon (?:d’origines|général|de Style de combat|de faveur épique)/gm)].map(m=>({name:m[1],page})));
assert.equal(refs.length,17);
for(const ref of refs)assert.equal(before.feats.filter(f=>normal(f.nom)===normal(ref.name)).length,1,ref.name);
const entries=before.feats.map(f=>{
 const ref=refs.find(e=>normal(e.name)===normal(f.nom)),changes=plan.corrections.filter(c=>c.id===f.id);
 for(const c of changes){assert.equal(c.path.reduce((v,k)=>v[k],f),c.before);assert.equal(hash(c.before),c.beforeSha256);assert.equal(c.path.reduce((v,k)=>v[k],after.feats.find(x=>x.id===f.id)),c.after);}
 return {id:f.id,name:f.nom,category:f.categorie,status:f.categorie==='archive'?'legacy-archive-not-current-feat':ref?'included-in-srd-5.2.1':'not-included-in-srd-5.2.1',srdName:ref?.name||null,pdfPage:ref?.page||null,source:ref?source+'#page='+ref.page:source,permissionStatus:ref?'srd-membership-confirmed-prose-origin-separate':'non-srd-rights-not-established',wordingStatus:changes.length?'rewritten-in-editorial-edition':f.categorie==='archive'?'legacy-archive-preserved':'srd-wording-preserved',edition:changes.length?plan.id:null,changedFields:changes.map(c=>c.path.join('.'))};
});
const summary={entries:entries.length,active:entries.filter(e=>e.category!=='archive').length,srd:entries.filter(e=>e.status==='included-in-srd-5.2.1').length,nonSrdActive:entries.filter(e=>e.status==='not-included-in-srd-5.2.1').length,archived:entries.filter(e=>e.category==='archive').length};
assert.deepEqual(summary,{entries:77,active:75,srd:17,nonSrdActive:58,archived:2});
assert(entries.filter(e=>e.status==='not-included-in-srd-5.2.1').every(e=>e.changedFields.includes('description')));
const report={referenceDate:'2026-10-31',catalogueSha256:plan.baseCatalogueSha256,baselineEdition:plan.previousEditorialRevision.id,currentCatalogueSha256:read('access/rules-release.json').sha256,appliedEdition:plan.id,pdfSha256:hash(pdf),source,scope:'All 77 feat records mapped to the complete feat chapter (PDF pages 92-94). 75 active feats and two legacy archives distinguished. All 58 non-SRD active feat descriptions and their non-ability-increase effect strings rewritten. Membership and wording are not rights clearance. Mechanical rules remain fixed to the 28 October 2026 reference.',summary,entries};
fs.writeFileSync(path.join(base,'audit/feat-srd-membership-2024.json'),JSON.stringify(report,null,2)+'\n');
const category={origine:'Origine',general:'Général',combat:'Style de combat',epique:'Faveur épique',archive:'Archive'};
const rows=entries.map(e=>'| '+e.name+' | '+category[e.category]+' | '+(e.pdfPage?'SRD, page '+e.pdfPage:e.category==='archive'?'Archive héritée':'Hors SRD')+' | '+(e.changedFields.length?e.changedFields.length+' champs réécrits':'Conservé')+' |');
const markdown=`# Dons : sources et réécriture — 31 octobre 2026\n\nLe chapitre complet du [SRD français 5.2.1](${source}#page=92), pages 92 à 94, contient **17 dons** présents dans le catalogue. Celui-ci compte **75 dons actifs** et **deux archives héritées**. Les **58 dons actifs hors SRD** reçoivent une nouvelle rédaction technique de leur description et de leurs effets textuels. Le classement repose sur les titres du chapitre, non sur l’URL utilisée antérieurement pour vérifier une mécanique.\n\n## Périmètre appliqué\n\nLe journal [non-srd-feat-rewrite-20261031.json](../data/non-srd-feat-rewrite-20261031.json) contient **169 champs réécrits** : 58 descriptions et 111 effets. Les 46 expressions structurées de hausse de caractéristique sont conservées exactement, ainsi que les identifiants, catégories, prérequis, types d’effets et plafonds. Les 17 entrées SRD et les deux archives ne changent pas. Les noms anglais non vérifiés restent des identifiants lisibles ; les notes internes sur leur traduction sont retirées des descriptions destinées au joueur.\n\nLes mots et formules nécessaires à la résolution des valeurs, comme les dés, les caractéristiques et les références au bonus de maîtrise, sont conservés. Ce travail n’ajoute aucune mécanique ni autorisation. Il ne constitue pas une comparaison exhaustive phrase par phrase avec les livres hors SRD ; la référence de travail est le catalogue déjà figé.\n\n## Tableau complet\n\n| Entrée | Catégorie | Appartenance au SRD | Rédaction |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n\n## Vérification et suite\n\nLa restitution des valeurs précédentes et de la métadonnée d’édition retrouve exactement le catalogue antérieur. Les signatures numériques restent identiques champ par champ. Les tests vérifient les hausses de caractéristiques, plafonds, répétitions, prérequis et valeurs résolues des fiches. Les sources, résultats d’exécution et conditions de publication du lot sont consignés dans son bilan.\n\nLes droits de redistribution hors SRD restent distincts de la qualité de la reformulation. Les historiques, espèces, autres profils et tableaux complémentaires ne sont pas présentés comme réécrits par ce lot. Les données archivées restent explicitement archivées et ne redeviennent pas des choix de création.\n`;
fs.writeFileSync(path.join(base,'audit/DONS-SRD.md'),markdown);console.log(JSON.stringify({...summary,rewrittenTextFields:plan.corrections.length}));
