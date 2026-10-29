import fs from 'node:fs';
import {createHash} from 'node:crypto';

// Audit utility only. Input is the plain text extracted from the official French
// SRD 5.2.1, not a third-party bestiary. Keep full source text beside parsed data.
const [input,output,collection='formes_animales']=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node extract-animal-reference.mjs pages.json output.json');
if(!['formes_animales','formes_draconiques','familiers'].includes(collection))throw Error('Unsupported profile collection');
const pages=JSON.parse(fs.readFileSync(input,'utf8')).filter(p=>p.page>=270);
const pageOffsets=[];let text='';
for(const p of pages){pageOffsets.push({offset:text.length,page:p.page});text+=p.text.replace(/^\d+\s*\nDocument de Référence du Système 5\.2\.1\s*\n/,'')+'\n';}
text=text.replace(/[−–]/g,'-');
const starts=[...text.matchAll(/^([^\n]+)\n((?:Bête|Céleste|Monstruosité|Élémentaire|Nuée|Dragon|Fée|Fiélon|Mort-vivant)[^\n]*)\nCA\s+(\d+)/gm)];
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={'axe-beak':'Autrache',ape:'Grand singe','blood-hawk':'Faucon de sang',deer:'Petit cervidé','dire-wolf':'Loup sanguinaire',elk:'Grand cervidé','giant-centipede':'Mille-pattes géant','giant-elk':'Cervidé géant','giant-fire-beetle':'Scarabée de feu géant','giant-owl':'Chouette géante','giant-wolf-spider':'Araignée-loup géante','killer-whale':'Épaulard',mastiff:'Molosse',owl:'Chouette','polar-bear':'Ours polaire','tyrannosaurus-rex':'Tyrannosaure','swarm-of-bats':'Nuée de chauves-souris',azer:'Sentinelle azer','dust-mephit':'Méphite poussiéreux','ice-mephit':'Méphite gelé','magma-mephit':'Méphite magmatique','steam-mephit':'Méphite vaporeux',magmin:'Magmatique','invisible-stalker':'Traqueur invisible',stirge:'Strige'};
Object.assign(aliases,{sprite:'Esprit follet',quasit:'Quasit'});
const originals=[...JSON.parse(fs.readFileSync(new URL('../tests/fixtures/rules-2024.json',import.meta.url),'utf8')).collections[collection]];
// Missing from the snapshot, but required by the existing 2024 Pact of the Chain.
if(collection==='familiers'&&!originals.some(r=>r.slug==='sphinx-of-wonder'))originals.push({slug:'sphinx-of-wonder',nom:'Sphinx merveilleux'});
const identities=new Map(originals.map(row=>[normalize(aliases[row.slug]||row.nom),row.slug]));
const number=s=>Number(s.replace(',','.'));
const conditions=new Set(['À terre','Agrippé','Assourdi','Aveuglé','Charmé','Effrayé','Empoisonné','Entravé','Épuisement','Étourdi','Inconscient','Invisible','Neutralisé','Paralysé','Pétrifié'].map(normalize));
const entries=[];
for(let i=0;i<starts.length;i++){
  const m=starts[i],next=starts[i+1]?.index??text.length;
  const id=identities.get(normalize(m[1]));if(!id)continue;
  // A following monster of another type also terminates this block.
  const tail=text.slice(m.index,next);
  const other=tail.slice(m[0].length).search(/^[^\n]+\n[^\n]+de taille[^\n]*\nCA\s+\d+/m);
  const raw=(other<0?tail:tail.slice(0,m[0].length+other)).trim().replace(/\n[\p{Lu}][\p{L} ’'’-]+$/u,'').trim();
  const compact=raw.replace(/([\p{L}])-\s*\n([\p{L}])/gu,'$1$2').replace(/\s+/g,' ').trim();
  const hp=compact.match(/\bPv\s+(\d+)\s*\(([^)]+)\)/),fp=compact.match(/\bFP\s+(\d+(?:\/\d+)?)\s*\(([\d ]+)\s*PX\s*;\s*BM\s*\+(\d+)\)/);
  if(!hp||!fp)throw Error('Incomplete header: '+m[1]);
  const size=m[2].match(/de taille (TP|TG|Gig|P|M|G)\b/),stats={},saves={};
  for(const [fr,id]of [['For','FOR'],['Dex','DEX'],['Con','CON'],['Int','INT'],['Sag','SAG'],['Cha','CHA']]){
    const v=compact.match(new RegExp('\\b'+fr+'\\s+(\\d+)\\s+([+-]?\\d+)\\s+([+-]?\\d+)'));
    if(!v)throw Error('Missing ability '+m[1]+' '+id);
    stats[id]=+v[1];stats[id+'_mod']=+v[2];saves[id]=+v[3];
    if(Math.floor((stats[id]-10)/2)!==stats[id+'_mod'])throw Error('Ability modifier mismatch '+m[1]+' '+id);
  }
  const getField=label=>compact.match(new RegExp('(?:^| )'+label+' (.*?)(?= (?:Compétences|Vulnérabilités|Résistances|Immunités|Équipement|Sens|Langues|FP|Traits|Actions) |$)'))?.[1]||'';
  const skills={};for(const v of getField('Compétences').matchAll(/([\p{L}’' -]+)\s+([+-]\d+)/gu))skills[v[1].replace(/^,\s*/,'').trim()]=+v[2];
  const split=s=>s.split(/[,;]|\s+et\s+/).map(x=>x.trim()).filter(Boolean);
  const immunities=split(getField('Immunités'));
  const speedText=getField('Vitesse').split(' MOD ')[0],speed={marche:null,nage:null,vol:null,fouissement:null,escalade:null};
  const first=speedText.match(/^(\d+(?:,\d+)?)\s*m/);if(first)speed.marche=number(first[1]);
  for(const label of ['nage','vol','fouissement','escalade']){const v=speedText.match(new RegExp('\\b'+label+' (\\d+(?:,\\d+)?)\\s*m'));if(v)speed[label]=number(v[1]);}
  const senses={vision_dans_le_noir:null,vision_aveugle:null,vision_vraie:null,perception_passive:null,tremblements:null};
  for(const [label,id]of [['Vision dans le noir','vision_dans_le_noir'],['Vision aveugle','vision_aveugle'],['Vision lucide','vision_vraie'],['Perception passive','perception_passive'],['Perception des vibrations','tremblements']]){const v=getField('Sens').match(new RegExp(label+' (\\d+(?:,\\d+)?)'));if(v)senses[id]=number(v[1]);}
  const headings=[...raw.matchAll(/^(Traits|Actions Bonus|Actions Légendaires|Actions|Réactions)\s*$/gm)];
  const sections={traits:[],actions:[],actions_bonus:[],actions_legendaires:[],reactions:[]};
  const sectionIds={Traits:'traits',Actions:'actions','Actions Bonus':'actions_bonus','Actions Légendaires':'actions_legendaires','Réactions':'reactions'};
  for(let n=0;n<headings.length;n++){const h=headings[n],body=raw.slice(h.index+h[0].length,headings[n+1]?.index??raw.length).trim();if(body)sections[sectionIds[h[1]]].push({nom:h[1],description:body.replace(/([\p{L}])-\s*\n([\p{L}])/gu,'$1$2')});}
  const page=pageOffsets.filter(p=>p.offset<=m.index).at(-1).page;
  const type=m[2].startsWith('Nuée')?'Beast':({Bête:'Beast',Céleste:'Celestial',Monstruosité:'Monstrosity',Élémentaire:'Elemental',Dragon:'Dragon',Fée:'Fey',Fiélon:'Fiend','Mort-vivant':'Undead'})[m[2].split(/[ (]/)[0]];
  const parts=fp[1].split('/'),xp=+fp[2].replaceAll(' ','');
  entries.push({id,name:m[1],page,url:'https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf#page='+page,raw,parsed:{nom:m[1],taille:size?.[1],type,sous_type:m[2].startsWith('Nuée')?'Swarm':m[2].match(/\(([^)]+)\)/)?.[1]||null,alignement:m[2].split(',').slice(1).join(',').trim(),ca:+m[3],ca_detail:null,pv:+hp[1],pv_formule:hp[2],vitesse:speed,caracteristiques:stats,jets_sauvegarde:saves,competences:skills,resistances:split(getField('Résistances')),immunites_degats:immunities.filter(x=>!conditions.has(normalize(x))),immunites_etats:immunities.filter(x=>conditions.has(normalize(x))),vulnerabilites:split(getField('Vulnérabilités')),sens:senses,langues:getField('Langues')==='aucune'?[]:[getField('Langues')].filter(Boolean),fp:fp[1],fp_numerique:parts.length===2?+parts[0]/+parts[1]:+parts[0],bonus_maitrise:+fp[3],experience:xp,xp,...sections,attaques:[],actions_leg_nb:0,resistances_leg_nb:0},initiative:+compact.match(/Initiative\s+([+-]?\d+)/)?.[1]});
}
fs.writeFileSync(output,JSON.stringify({source:'SRD français 5.2.1',sourcePdfSha256:'480604d949a3bb77f639cf31c1e9e1e7ebb04ae481d943db662ba546828d94bf',inputSha256:createHash('sha256').update(fs.readFileSync(input)).digest('hex'),entries},null,2)+'\n');
console.log('Extracted '+entries.length+' profiles');
