// Documentary check only: no runtime catalogue, database or character writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildCatalogue} from '../catalogue.mjs';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const digest=value=>createHash('sha256').update(value).digest('hex');
const normal=value=>String(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const source='https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf';
const pdf=fs.readFileSync(path.join(base,'.local/descriptions-review/SRD-fr-5.2.1.pdf'));
const pdfSha256=digest(pdf);
assert.equal(pdfSha256,read('audit/spell-reference-2024.json').sourcePdfSha256);
const pages=fs.readFileSync(path.join(base,'.local/descriptions-review/SRD-fr-5.2.1.txt'),'utf8').split('\f');
const catalogue=buildCatalogue(read('tests/fixtures/rules-2024.json'));
const catalogueSha256=digest(JSON.stringify(catalogue));
assert.equal(catalogueSha256,read('access/rules-release.json').sha256);
const inventory=read('audit/description-provenance-2024.json');
assert.equal(inventory.summary.catalogueSha256,catalogueSha256);

// Identity mapping was checked against each full subclass heading in the PDF.
// The existing site labels are kept; this is not a rename or a rules revision.
const srd=[
  ['barbare','barbare_berserker','Voie du Berserker',32,'Sous-classe de Barbare'],
  ['barde','barde_college_savoir','Collège du Savoir',37,'Sous-classe de Barde'],
  ['clerc','clerc_domaine_vie','Domaine de la Vie',42,'Sous-classe de Clerc'],
  ['druide','druide_cercle_terre','Cercle de la Terre',48,'Sous-classe de Druide'],
  ['ensorceleur','ensorceleur_sorcellerie_draconique','Sorcellerie draconique',55,'Sous-classe d’Ensorceleur'],
  ['guerrier','guerrier_champion','Champion',58,'Sous-classe de Guerrier'],
  ['magicien','magicien_evocateur','Évocateur',64,'Sous-classe de Magicien'],
  ['moine','moine_credo_paume','Credo de la Paume',67,'Sous-classe de Moine'],
  ['occultiste','occultiste_protecteur_fielon','Protecteur Fiélon',74,'Sous-classe d’Occultiste'],
  ['paladin','paladin_serment_devotion','Serment de Dévotion',79,'Sous-classe de Paladin'],
  ['rodeur','rodeur_chasseur','Chasseur',83,'Sous-classe de Rôdeur'],
  ['roublard','roublard_voleur','Voleur',86,'Sous-classe de Roublard'],
];
assert.equal(catalogue.subclasses.length,48);
const headings=pages.flatMap((p,i)=>i>=10&&i<87?[...p.matchAll(/Sous-classe (?:de |d[’'])[A-Za-zÀ-ÿ]+\s*:/g)].map(()=>i+1):[]);
assert.deepEqual(headings,srd.map(e=>e[3]),'Every subclass body heading must be accounted for');
for(const [parent,id,name,page,heading]of srd){
  assert(normal(pages[page-1]).includes(normal(heading+' '+name)),id+' PDF heading');
  assert(catalogue.subclasses.some(s=>s.id===id&&s.classe_parente===parent),id+' catalogue identity');
  assert.equal(catalogue.subclasses.filter(s=>s.classe_parente===parent).length,4);
}

const entries=catalogue.subclasses.map(item=>{
  const match=srd.find(row=>row[1]===item.id);
  const row=inventory.entries.find(e=>e.type==='subclasses'&&e.id===item.id);
  assert(row);
  for(const field of row.fields){
    const value=field.path.split('.').reduce((obj,key)=>obj[key],item);
    assert.equal(digest(value),field.sha256,item.id+' '+field.path+' text unchanged');
  }
  return {id:item.id,classId:item.classe_parente,catalogueName:item.nom,status:match?'included-in-srd-5.2.1':'not-included-in-srd-5.2.1',srdName:match?.[2]||null,pdfPage:match?.[3]||null,source:match?source+'#page='+match[3]:source,comparisonSource:row.comparisonSource,textFields:row.fields.map(f=>({path:f.path,sha256:f.sha256,provenance:f.provenance,source:f.source})),review:{scope:'Current prose inspected for technical summary versus narrative/example material; no exhaustive comparison against non-SRD books.',style:['ensorceleur_sorcellerie_mecanique','rodeur_vagabond_feerique'].includes(item.id)?'mechanical-summary-and-cosmetic-examples':'concise-mechanical-summary',permissionStatus:match?'srd-inclusion-confirmed-current-prose-origin-separate':'non-srd-redistribution-rights-unverified',requiredFollowUp:match?'Do not extend SRD licensing to unrelated linked spells, profiles or legacy prose automatically.':'Resolve the permission basis for redistribution; prose style alone does not establish it.'}};
});
assert.equal(entries.filter(e=>e.status==='included-in-srd-5.2.1').length,12);
assert.equal(entries.filter(e=>e.status==='not-included-in-srd-5.2.1').length,36);
assert.equal(entries.reduce((n,e)=>n+e.textFields.length,0),239);

// Editorial drafts for two narrative example lists found during the reading.
// They remain reviewable proposals and are not imported into the frozen rules.
const drafts=[
  {id:'ensorceleur_sorcellerie_mecanique',path:['niveaux','3','capacites',1,'description'],after:'Décidez de l’apparence et des sons qui accompagnent votre magie. Cette personnalisation est descriptive : elle n’ajoute aucun effet de jeu et ne déclenche aucun lancer de dés.',reason:'Replace the source-specific list of cosmetic manifestations with an open player choice.'},
  {id:'rodeur_vagabond_feerique',path:['niveaux','3','capacites',2,'description'],after:'Imaginez un signe visible ou perceptible de votre lien féerique et décrivez-le à votre table. Il sert à personnaliser le personnage, sans effet mécanique ni lancer de dés.',reason:'Replace the source-specific list of fairy appearance examples with an open player choice.'},
].map(draft=>{
  const item=catalogue.subclasses.find(s=>s.id===draft.id);
  const before=draft.path.reduce((obj,key)=>obj[key],item);
  return {...draft,before,beforeSha256:digest(before),status:'draft-not-applied',mechanicsChanged:false};
});
const report={schemaVersion:1,referenceDate:'2026-10-30',source,pdfSha256,catalogueSha256,scope:'SRD 5.2.1 membership for the 48 PHB 2024 subclasses in the current catalogue; current prose shape reviewed. Not a legal clearance or a comparison of every non-SRD phrase with the books.',summary:{classes:12,subclasses:48,srd:12,nonSrd:36,textFields:239,nonSrdTextFields:entries.filter(e=>e.status==='not-included-in-srd-5.2.1').reduce((n,e)=>n+e.textFields.length,0),editorialDrafts:drafts.length,runtimeChanges:0},entries,drafts};
fs.writeFileSync(path.join(base,'audit/subclass-srd-membership-2024.json'),JSON.stringify(report,null,2)+'\n');
const classNames={barbare:'Barbare',barde:'Barde',clerc:'Clerc',druide:'Druide',ensorceleur:'Ensorceleur',guerrier:'Guerrier',magicien:'Magicien',moine:'Moine',occultiste:'Occultiste',paladin:'Paladin',rodeur:'Rôdeur',roublard:'Roublard'};
const rows=srd.map(([parent,id,name,page])=>{
  const entry=entries.find(e=>e.id===id);
  return '| '+classNames[parent]+' | '+name+(name!==entry.catalogueName?' (site : '+entry.catalogueName+')':'')+' | '+page+' | '+entries.filter(e=>e.classId===parent&&e.status==='not-included-in-srd-5.2.1').map(e=>e.catalogueName).join(' ; ')+' |';
});
const markdown=`# Sous-classes : appartenance au SRD et revue des textes\n\nContrôle du 30 octobre 2026. **12 sous-classes figurent dans le SRD 5.2.1, 36 n’y figurent pas.** Les 48 identifiants du catalogue sont rapprochés individuellement des douze titres du corps du [PDF officiel français](${source}). Les numéros ci-dessous sont les pages du PDF. Les noms et identifiants existants sont conservés.\n\n| Classe | Sous-classe du SRD | Page PDF | Trois autres sous-classes du site, hors SRD 5.2.1 |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n\n## Ce que la lecture établit\n\nLes 239 champs textuels des sous-classes ont été parcourus, dont ${report.summary.nonSrdTextFields} pour les 36 hors SRD. Il s’agit de descriptions d’aptitudes, d’options et de traits, principalement sous forme de résumés techniques courts : coûts, portée, durée, jets et effets. Il n’y a pas de longue introduction narrative de sous-classe dans ce catalogue. Le journal rattache tous ces champs à des corrections documentées ; cela donne une référence de comparaison, sans établir une autorisation de redistribution.\n\nOnze des douze sous-classes du SRD avaient été comparées à une autre publication. Elles ne doivent plus être confondues avec les 36 hors SRD. La présence de la sous-classe dans le SRD ne prouve pas que chaque formulation actuelle vient de ce document, ni que tous ses sorts ou profils liés sont couverts.\n\n## Deux passages éditoriaux à remplacer\n\nLes listes d’exemples de Manifestations de l’Âme mécanique et du Don féerique du Vagabond féerique sont du texte d’ambiance. Deux propositions indépendantes remplacent ces listes par une personnalisation libre du joueur, sans ajouter de mécanique. Elles figurent, avec les valeurs précédentes et leurs empreintes, dans [subclass-srd-membership-2024.json](subclass-srd-membership-2024.json), section drafts. **Elles ne sont pas appliquées au catalogue ni en production.**\n\n## Limite du contrôle et suite\n\nCe classement est terminé pour les 48 sous-classes. La forme concise des résumés n’est pas une validation des droits : les textes hors SRD n’ont pas été comparés exhaustivement aux livres ni déclarés libres. Réécrire les deux listes ne règle donc pas à elle seule la diffusion des 36 sous-classes. Il reste à établir les conditions de réutilisation des textes et, si nécessaire, préparer une version de diffusion qui évite les éléments sans autorisation établie. La revue des 51 sorts signalés, des dons et des autres textes reste distincte.\n\nAucune règle, donnée MongoDB, fiche existante ou version de production n’a changé. Les vérifications de ce lot portent sur les 48 identités, les douze titres/pages, les quatre options par classe et les 239 empreintes de texte. Une campagne de calcul ou de navigateur n’est pas relancée pour ce contrôle documentaire.\n`;
fs.writeFileSync(path.join(base,'audit/SOUS-CLASSES-SRD.md'),markdown);
console.log(JSON.stringify(report.summary));
