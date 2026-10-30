// Documentary and editorial review. Does not alter the catalogue or MongoDB.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildCatalogue} from '../catalogue.mjs';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const digest=value=>createHash('sha256').update(value).digest('hex');
const normal=value=>String(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const source='https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf';
const reference=read('audit/spell-reference-2024.json');
const pdfSha256=digest(fs.readFileSync(path.join(base,'.local/descriptions-review/SRD-fr-5.2.1.pdf')));
assert.equal(pdfSha256,reference.sourcePdfSha256);
const pages=fs.readFileSync(path.join(base,'.local/descriptions-review/SRD-fr-5.2.1.txt'),'utf8').split('\f');
// Independent count of spell stat block starts in the complete spell chapter.
const starts=[...pages.slice(113,186).join('\n').replaceAll('\r','').matchAll(/^Temps d’incantation\s*:/gm)].length;
assert.equal(starts,339);
assert.equal(reference.entries.length,starts,'The index must account for every SRD spell stat block');
for(const entry of reference.entries)assert(normal(pages[entry.page-1]).includes(normal(entry.name)),entry.name+' heading on its indexed PDF page');

const editorial=read('data/editorial-description-corrections-20261030.json');
const catalogue=buildCatalogue(read('tests/fixtures/rules-2024.json'),{editorial:false});
const catalogueSha256=digest(JSON.stringify(catalogue));
assert.equal(catalogueSha256,editorial.baseCatalogueSha256);
const inventory=read('audit/description-provenance-2024.json');
assert([catalogueSha256,read('access/rules-release.json').sha256].includes(inventory.summary.catalogueSha256));
for(const row of inventory.entries)for(const field of row.fields){const c=editorial.corrections.find(c=>c.collection===row.type&&c.id===row.id&&c.path.join('.')===field.path);if(c)field.sha256=c.beforeSha256;}
const aliases=read('audit/spell-reference-aliases-2024.json').aliases;
const linked=reference.entries.flatMap(e=>e.catalogueIds);
assert.equal(linked.length,339);assert.equal(new Set(linked).size,339);
assert.equal(catalogue.spells.length,390);

const proposals=[
  {id:'frappe_du_vent_d_acier',after:'Brandissez l’arme servant de composante. Désignez jusqu’à 5 créatures visibles à portée et résolvez une attaque de sort au corps à corps contre chacune. Chaque touche inflige 6d10 dégâts de force. Après ces attaques, vous vous téléportez vers un espace visible et inoccupé à 1,50 m ou moins d’une des cibles.',reason:'Replace the narrative introduction with technical instructions; retain the weapon component gesture, targets, attacks, damage and final placement.'},
  {id:'mind_sliver',after:'Une créature visible à portée effectue un JS INT. Échec : 1d6 psychiques et retranche 1d4 à sa prochaine sauvegarde avant la fin de votre prochain tour.',reason:'Remove the internal note about the unverified French title from the player-facing description. Preserve it in documentary metadata instead.'},
  {id:'voile_defensif',after:'Pendant la durée du sort, chaque créature qui effectue un jet d’attaque contre vous retranche 1d4 au résultat de ce jet.',reason:'Use a technical summary without the introductory image of a protective veil.'},
  {id:'armure_d_agathys',after:'Vous gagnez 5 PV temporaires. Pendant le sort, une créature qui vous touche avec une attaque au corps à corps subit 5 dégâts de froid. L’effet prend fin quand vous n’avez plus de PV temporaires. Les PV temporaires qui maintiennent cet effet peuvent venir d’une autre source.',reason:'Correct the awkward wording of the melee-hit trigger without changing temporary hit points, damage or the termination condition.'},
];
const drafts=proposals.map(p=>{
  const spell=catalogue.spells.find(s=>s.id===p.id);assert(spell&&!linked.includes(p.id));
  const before=spell.description;
  // Numeric signatures are a guard, not a substitute for a mechanical review.
  const numbers=s=>s.match(/\d+(?:[.,]\d+)?(?:d\d+)?/g)||[];
  assert.deepEqual(numbers(p.after),numbers(before),p.id+' numeric values must be retained');
  return {...p,path:['description'],before,beforeSha256:digest(before),status:'applied-in-editorial-edition',mechanicsChanged:false};
});
const entries=catalogue.spells.map(spell=>{
  const ref=reference.entries.find(e=>e.catalogueIds.includes(spell.id));
  if(ref)assert(normal(ref.name)===normal(spell.nom)||aliases[ref.name]===spell.id,spell.id+' explicit SRD identity or alias');
  else assert(!reference.entries.some(e=>normal(e.name)===normal(spell.nom)||aliases[e.name]===spell.id),spell.id+' no overlooked SRD name or alias');
  const row=inventory.entries.find(e=>e.type==='spells'&&e.id===spell.id);assert(row);
  const comparisonSource=row.comparisonSource||spell.source_url||row.fields.find(f=>f.source)?.source||null;
  const englishIdentity=comparisonSource?.match(/Spells:([^?&#]+)/)?.[1];
  for(const f of row.fields){const text=f.path.split('.').reduce((v,key)=>v[key],spell);assert.equal(digest(text),f.sha256,spell.id+' '+f.path+' unchanged');}
  return {id:spell.id,catalogueName:spell.nom,level:spell.niveau,status:ref?'included-in-srd-5.2.1':'not-included-in-srd-5.2.1',srdName:ref?.name||null,pdfPage:ref?.page||null,srdSource:ref?.url||null,comparisonSource,englishIdentity:englishIdentity?decodeURIComponent(englishIdentity):null,...(!ref?{textReview:{status:'current-prose-reviewed-not-rights-cleared',scope:'All inventoried current fields inspected: description, scaling, casting trigger, material component and summoned profile where present. No exhaustive non-SRD source-book comparison.',style:spell.id==='frappe_du_vent_d_acier'?'technical-summary-with-narrative-introduction':spell.id==='mind_sliver'?'technical-summary-with-internal-editorial-note':'technical-summary',containsSummonedProfile:row.fields.some(f=>f.path==='invocation.description'),containsMaterialComponent:row.fields.some(f=>f.path==='composantes.M'),editorialDraft:drafts.some(d=>d.id===spell.id),translationNote:spell.id==='mind_sliver'?'English title retained because the official French title was not verified; this belongs in the audit, not the rules description.':null,fields:row.fields.map(f=>({path:f.path,sha256:f.sha256,provenance:f.provenance,source:f.source,similarity:f.similarity})),permissionStatus:'non-srd-redistribution-rights-unverified'}}:{permissionStatus:'srd-inclusion-confirmed-current-prose-origin-separate'})};
});
const outside=entries.filter(e=>e.status==='not-included-in-srd-5.2.1');
assert.equal(outside.length,51);assert(outside.every(e=>e.comparisonSource&&e.englishIdentity),'Every non-SRD spell must have a documented identity');
const fields=outside.flatMap(e=>e.textReview.fields);
assert.equal(fields.length,110);
const summary={spells:390,srd:339,nonSrd:51,reviewedNonSrdTextFields:110,fieldsWithCorrectionOrAdditionSource:fields.filter(f=>f.provenance==='documented-other-field').length,fieldsWithComparisonSourceOnly:fields.filter(f=>f.provenance==='other-comparison-only').length,summonedProfiles:outside.filter(e=>e.textReview.containsSummonedProfile).length,materialComponents:outside.filter(e=>e.textReview.containsMaterialComponent).length,editorialDrafts:drafts.length,runtimeChanges:0};
const report={schemaVersion:1,referenceDate:'2026-10-30',source,pdfSha256,catalogueSha256,appliedEditorialEdition:editorial.id,scope:'Membership in the frozen French SRD 5.2.1 for all 390 catalogue spells; current text fields reviewed for the 51 non-SRD entries. Names/aliases and prose provenance remain separate. No redistribution permission is inferred from concise wording or public URLs.',evidence:{indexedSRDSpells:reference.entries.length,independentSpellBlockMarkers:starts,allIndexedHeadingsFoundOnTheirPages:true,explicitAliasFile:'spell-reference-aliases-2024.json',sourceAccessibility:{checkedURLs:['Steel Wind Strike','Mind Sliver','Blade Ward'].map(name=>'https://roll20.net/compendium/dnd5e/Spells:'+encodeURIComponent(name)+'?expansion=32231'),finding:'HTTP 200 alone is not access or licensing evidence. The sampled Roll20 HTML includes an unowned-content sign-in/unlock dialog. No exhaustive source-text comparison or permission clearance is claimed; no access control is bypassed.',searchService:'Unavailable (503); frozen official PDF verified locally by its SHA-256.'}},summary,entries,drafts};
fs.writeFileSync(path.join(base,'audit/spell-srd-membership-2024.json'),JSON.stringify(report,null,2)+'\n');
const levels=n=>n===0?'Sort mineur':String(n);
const rows=outside.map(e=>'| '+e.catalogueName+' | '+e.englishIdentity+' | '+levels(e.level)+' | '+e.textReview.fields.length+' | '+(e.textReview.editorialDraft?'Proposition éditoriale prête':e.textReview.containsSummonedProfile?'Résumé + profil convoqué':'Résumé technique')+' |');
const markdown=`# Sorts : appartenance au SRD et revue des 51 textes signalés\n\nContrôle du 30 octobre 2026 sur la référence avant édition de textes. **339 sorts figurent dans le SRD français 5.2.1 ; les 51 autres n’y figurent pas.** Le contrôle des noms et des 21 alias existants n’a pas révélé de faux manquant supplémentaire. Les 339 marqueurs de début de fiche dans le chapitre des sorts concordent avec les 339 fiches indexées ; chaque titre est retrouvé à la page annoncée du [PDF officiel](${source}).\n\n## Lecture des descriptions\n\nLes **110 champs textuels** des 51 sorts ont été parcourus : 51 descriptions principales, 29 textes de progression, sept déclencheurs d’incantation, treize composantes matérielles, huit descriptions de profils convoqués et deux autres précisions. Ils sont principalement des résumés techniques ; il ne faut pas oublier les profils et composantes dans une revue des textes.\n\nPour 92 champs, une correction, un ajout ou une source explicite documente la référence. Pour 18, seule la référence de comparaison de l’entrée est connue : leur origine rédactionnelle n’est pas établie. Aucun de ces nombres ne prouve une autorisation. Les pages Roll20 échantillonnées renvoient un statut HTTP 200 mais présentent une invitation de connexion/déblocage : leur présence en ligne ne rend pas leur contenu libre. Les livres hors SRD ne sont pas comparés exhaustivement dans ce lot.\n\n## Corrections éditoriales appliquées\n\n- **Frappe du vent d’acier** : remplacer l’introduction d’ambiance par une consigne technique, en conservant geste de composante, cibles, attaques, dégâts et téléportation.\n- **Mind Sliver** : retirer de la description joueur la note interne sur le nom français non vérifié ; la conserver dans l’audit.\n- **Voile défensif** : ramener la phrase d’introduction à l’effet sur le jet d’attaque.\n- **Armure d’Agathys** : corriger la formulation du déclencheur « attaque au corps à corps », sans changer PV temporaires, dégâts ou condition de fin.\n\nLes quatre valeurs avant/après sont dans [spell-srd-membership-2024.json](spell-srd-membership-2024.json), section drafts. Leurs valeurs numériques sont contrôlées à l’identique et les effets relus. **Elles sont appliquées dans l’édition de textes du 30 octobre 2026.** Ces retouches ne valent pas autorisation de redistribution des sorts hors SRD.\n\n## Liste complète des 51 sorts hors SRD 5.2.1\n\nLes noms anglais identifient les sorts malgré les libellés historiques du site ; ils ne renomment pas les personnages ni les choix. Les références individuelles et empreintes de champs figurent dans le JSON.\n\n| Nom du site | Identité anglaise documentée | Niveau | Champs lus | Résultat éditorial |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n## Limites et suite\n\nLe classement et la lecture des textes actuels de ces 51 entrées sont terminés. Leurs droits de redistribution restent **non établis** : une traduction, un résumé ou une reformulation n’est pas automatiquement libre. Les profils convoqués, composantes et noms liés au contenu hors SRD restent dans ce périmètre. Aucun texte n’est déclaré exempt de reprise sur la seule base d’une comparaison avec le SRD français.\n\nLes quatre retouches rejoignent les deux retouches RP des sous-classes dans l’édition de textes du 30 octobre 2026. La vérification des dons, historiques et autres éléments reste à faire ; l’inventaire principal conserve cette distinction. Le présent rapport conserve les empreintes avant édition. Le journal éditorial trace les textes appliqués ; les valeurs de calcul et les fiches existantes restent inchangées. Les contrôles de ce lot vérifient le PDF, les 339 titres et identités SRD, les 390 identifiants, les 110 empreintes et les signatures numériques des quatre propositions. Aucune campagne de calcul/navigateur n’est relancée pour un contrôle documentaire.\n`;
fs.writeFileSync(path.join(base,'audit/SORTS-SRD.md'),markdown);
console.log(JSON.stringify(summary));
