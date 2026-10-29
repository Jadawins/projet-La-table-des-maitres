import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildCatalogue} from '../catalogue.mjs';

const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node index-spell-reference.mjs ordered-pages.json reference.json');
const bytes=fs.readFileSync(input),document=JSON.parse(bytes);
const offsets=[];let text='';
for(const page of document.pages)for(const column of page.columns){offsets.push({offset:text.length,page:page.page});text+=column+'\n';}
const start=/^([^\n]+)\n(Abjuration|Divination|Évocation|Enchantement|Illusion|Invocation|Nécromancie|Transmutation)\s+(?:du\s+(\d+)(?:er|e)\s*niveau|mineur(?:e)?)\s*\(([^)]+)\)\s*\nTemps d’incantation\s*:/gm;
const starts=[...text.matchAll(start)];
const catalogue=buildCatalogue(JSON.parse(fs.readFileSync(new URL('../tests/fixtures/rules-2024.json',import.meta.url))));
const aliases=JSON.parse(fs.readFileSync(new URL('./spell-reference-aliases-2024.json',import.meta.url))).aliases;
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const entries=[];
for(let n=0;n<starts.length;n++){
  const match=starts[n],raw=text.slice(match.index,starts[n+1]?.index??text.length).trim();
  const page=offsets.filter(p=>p.offset<=match.index).at(-1).page;
  const header=raw.slice(0,raw.indexOf('Durée :'));
  const matches=catalogue.spells.filter(s=>normalize(s.nom)===normalize(match[1])||s.id===aliases[match[1]]);
  entries.push({name:match[1],catalogueIds:matches.map(s=>s.id),page,url:'https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf#page='+page,status:'extracted-not-compared',metadata:{niveau:match[3]?Number(match[3]):0,ecole:match[2],classes:match[4].split(',').map(s=>s.replace(/\s+/g,' ').trim()),temps_incantation:header.match(/Temps d’incantation\s*:\s*([\s\S]*?)\nPortée/)?.[1].replace(/\s+/g,' '),portee:header.match(/Portée\s*:\s*([\s\S]*?)\nComposantes/)?.[1].replace(/\s+/g,' '),composantes_source:header.match(/Composantes\s*:\s*([\s\S]*)/)?.[1].replace(/\s+/g,' ').trim(),duree_source:raw.match(/Durée\s*:\s*([^\n]+)/)?.[1]},raw});
}
fs.writeFileSync(output,JSON.stringify({source:'SRD français 5.2.1, CC BY 4.0',sourcePdfSha256:document.sourcePdfSha256,inputSha256:createHash('sha256').update(bytes).digest('hex'),policy:'Extraction documentaire uniquement : aucune entrée ne devient comparée ou validée par ce script.',entries},null,2)+'\n');
console.log(JSON.stringify({extracted:entries.length,matched:entries.filter(e=>e.catalogueIds.length).length,unmatched:entries.filter(e=>!e.catalogueIds.length).map(e=>e.name)}));
