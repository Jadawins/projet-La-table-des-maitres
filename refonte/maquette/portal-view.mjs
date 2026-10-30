export const welcomeText='Bienvenue à ma table ! J’ai créé cet espace pour préparer vos aventures et garder vos personnages à portée de main. Le site évolue petit à petit : explorez le grimoire, créez votre héros et faites-moi vos retours. À bientôt autour des dés !';
export const booksNotice="Cette application accompagne vos parties et ne remplace pas les livres de règles. Pour profiter de l’ensemble des règles et de leurs explications, nous vous recommandons d’acheter les ouvrages officiels et de soutenir leurs créateurs.";
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeHTML;
export const renderGrimoireSources=()=>`<aside class="grimoire-attribution" aria-label="Sources du grimoire"><p>Cette œuvre inclut du matériel issu du System Reference Document 5.2.1 (« SRD 5.2.1 ») de Wizards of the Coast LLC, disponible à l’adresse <a href="https://www.dndbeyond.com/srd">https://www.dndbeyond.com/srd</a>. Le SRD 5.2.1 est régi par la Licence Creative Commons Attribution 4.0 International, disponible à l’adresse <a href="https://creativecommons.org/licenses/by/4.0/legalcode">https://creativecommons.org/licenses/by/4.0/legalcode</a>.</p><p>Des textes ont été adaptés ou résumés. <a href="/sources.html">Sources, autres attributions et portée des licences</a>.</p></aside>`;
const categories={spells:'Sorts',classes:'Classes',subclasses:'Sous-classes',feats:'Dons',species:'Espèces',backgrounds:'Historiques',weapons:'Armes',armors:'Armures',tools:'Outils',masteries:'Bottes d’armes'};
const normalize=value=>String(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const label=key=>({nom:'Nom',niveau:'Niveau',description:'Description',niveaux:'Progression par niveau',capacites:'Aptitudes',effets:'Effets',prerequis:'Prérequis',composantes:'Composantes',temps_incantation:'Incantation',portee:'Portée',duree:'Durée',ecole:'École',classe_parente:'Classe',degats:'Dégâts',prix:'Prix',maitrises_armes:'Maîtrises d’armes',maitrises_armures:'Maîtrises d’armures'}[key]||key.replaceAll('_',' ').replace(/([a-z])([A-Z])/g,'$1 $2'));
// Readable catalogue fields; metadata and internal IDs never become player instructions.
export function readableData(value){
  if(value===null||value===undefined)return '—';
  if(typeof value==='boolean')return value?'Oui':'Non';
  if(typeof value!=='object')return esc(value);
  if(Array.isArray(value))return `<ul>${value.map(v=>`<li>${readableData(v)}</li>`).join('')}</ul>`;
  return `<dl class="portal-data">${Object.entries(value).filter(([k])=>!['id','_id','source','_source','version','derniere_maj','reference'].includes(k)).map(([k,v])=>`<div><dt>${esc(label(k))}</dt><dd>${readableData(v)}</dd></div>`).join('')}</dl>`;
}
export function renderHome(){return `<section class="portal-home"><p class="eyebrow">VOTRE TABLE. VOS HISTOIRES.</p><h1>Bienvenue à la Table du Maître</h1><article class="portal-welcome"><h2>Un mot du créateur</h2><p>${esc(welcomeText)}</p></article><div class="portal-actions"><a class="button primary" href="#nouveau">Créer un personnage</a><a class="button secondary" href="#personnages">Mes personnages</a><a class="button secondary" href="#grimoire">Explorer le grimoire</a></div><aside class="portal-card portal-book-notice" aria-labelledby="books-title"><h2 id="books-title">Un complément à vos livres</h2><p>${esc(booksNotice)}</p></aside><h2>Les nouveautés du site</h2><div class="portal-grid"><article class="portal-card"><p class="eyebrow">PERSONNAGES</p><h3>Vos héros, à portée de main</h3><p>Créez votre personnage D&D 2024 du niveau 1 au niveau 20, puis retrouvez vos fiches dans votre compte.</p></article><article class="portal-card"><p class="eyebrow">GRIMOIRE</p><h3>Une règle à retrouver ?</h3><p>Recherchez un sort, une classe, un don ou votre équipement dans le catalogue du site.</p></article><article class="portal-card"><p class="eyebrow">AUTOUR DE LA TABLE</p><h3>Vos dés, votre façon de jouer</h3><p>Gardez le choix des dés physiques ou des lancers dans l’application. Aucun lancer ne se déclenche automatiquement.</p></article></div></section>`;}
export function catalogueEntries(catalogue){return Object.entries(categories).flatMap(([type,category])=>(catalogue[type]||[]).filter(item=>!item.disabled&&!item.exclu).map((item,index)=>({type,category,id:String(item.id??index),item,search:normalize(`${category} ${JSON.stringify(item)}`)})));}
export function searchCatalogue(entries,{query='',category=''}={}){const terms=normalize(query).trim().split(/\s+/).filter(Boolean);return entries.filter(e=>(!category||e.type===category)&&terms.every(term=>e.search.includes(term)));}
export function renderGrimoire(){return `<p class="eyebrow">LE SAVOIR À PORTÉE DE MAIN</p><h1>Grimoire</h1><p>Consultez les règles du catalogue utilisé pour vos personnages.</p><form class="portal-filters" role="search" id="grimoire-search"><label class="field">Rechercher<input type="search" id="grimoire-query" placeholder="Un sort, une classe, un don…" maxlength="200"></label><label class="field">Catégorie<select id="grimoire-category"><option value="">Tout le grimoire</option>${Object.entries(categories).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label></form><p id="grimoire-count" role="status"></p><div class="portal-grid" id="grimoire-results"></div><button class="button secondary" id="grimoire-more" hidden>Afficher plus</button>${renderGrimoireSources()}`;}
export function renderResults(entries,limit){return entries.slice(0,limit).map(e=>`<article class="portal-card"><p class="eyebrow">${esc(e.category)}${e.type==='spells'?` · ${e.item.niveau===0?'Sort mineur':`Niveau ${esc(e.item.niveau)}`}`:''}</p><h2><a href="#grimoire/${e.type}/${encodeURIComponent(e.id)}">${esc(e.item.nom||e.id)}</a></h2><p>${esc(String(e.item.description||e.item.classe_parente||'Consulter les informations et les choix disponibles.').slice(0,180))}</p></article>`).join('')||'<p>Aucun résultat. Essayez un autre mot ou une autre catégorie.</p>';}
const words=value=>String(value??'').replaceAll('_',' ');
const prose=value=>typeof value==='string'?value.trim().split(/\n\s*\n/).map(p=>`<p>${esc(p.replace(/\s*\n\s*/g,' '))}</p>`).join(''):readableData(value);
const chips=values=>`<div class="grimoire-chips">${values.filter(Boolean).map(value=>`<span>${esc(words(value))}</span>`).join('')}</div>`;
const facts=values=>`<dl class="grimoire-facts">${values.filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([name,value])=>`<div><dt>${esc(name)}</dt><dd>${esc(words(value))}</dd></div>`).join('')}</dl>`;
const section=(title,body)=>body?`<section class="grimoire-section"><h2>${esc(title)}</h2>${body}</section>`:'';
function remaining(item,used,title='Informations complémentaires'){
  const fields=Object.fromEntries(Object.entries(item).filter(([key,value])=>!['nom','id','_id','source','_source','version','derniere_maj','reference',...used].includes(key)&&value!==null&&value!==undefined&&value!==false&&!(Array.isArray(value)&&!value.length)));
  return Object.keys(fields).length?`<details class="grimoire-extra"><summary>${esc(title)}</summary>${readableData(fields)}</details>`:'';
}
function abilities(items=[]){return items.map(item=>`<article class="grimoire-ability${item.nom?'':' grimoire-effect'}">${item.nom?`<h3>${esc(words(item.nom))}</h3>`:''}${item.niveau_min>1?chips(['À partir du niveau '+item.niveau_min]):''}${item.description?prose(item.description):typeof item.valeur==='string'?prose(item.valeur):''}${remaining(item,['description','niveau_min',...(typeof item.valeur==='string'?['type','valeur']:[])],'Précisions')}</article>`).join('');}
function spellReading(item){
  const c=item.composantes,components=c?['V','S','M'].filter(k=>c[k]).join(', '):null;
  const classes=Array.isArray(item.classes)?item.classes:[];
  return chips([item.niveau===0?'Sort mineur':item.niveau!==undefined?'Niveau '+item.niveau:null,item.ecole,item.concentration?'Concentration':null,item.rituel?'Rituel':null])+
    facts([['Incantation',item.temps_incantation],['Portée',item.portee],['Durée',item.duree],['Composantes',components||'Aucune']])+
    (classes.length?`<div class="grimoire-classes"><span>Classes</span>${chips(classes)}</div>`:'')+
    section('Description',prose(item.description||''))+
    (typeof c?.M==='string'?section('Composante matérielle',prose(c.M)):'')+
    (item.niveau_superieur?section('Aux niveaux supérieurs',prose(item.niveau_superieur)):'')+
    remaining(item,['niveau','ecole','concentration','rituel','temps_incantation','portee','duree','composantes','classes','description','niveau_superieur'],'Précisions du sort');
}
function classReading(item){
  const base=item.niveaux?.[0]||{},levels=Object.entries(item.niveaux||{}).filter(([level])=>Number(level)>0).sort(([a],[b])=>Number(a)-Number(b));
  return (item.classe_parente?chips([item.classe_parente]):'')+
    facts([['Caractéristique principale',base.caracteristique_principale],['Dé de vie',base.de_vie?.type],['Sauvegardes maîtrisées',base.sauvegardes_maitrise?.join(' · ')]])+
    (item.description?section('Présentation',prose(item.description)):'')+
    section('Progression',`<p class="grimoire-guide">Ouvrez un niveau pour consulter les aptitudes et les choix obtenus.</p><div class="grimoire-levels">${levels.map(([level,row],index)=>`<details ${index===0?'open':''}><summary><strong>Niveau ${esc(level)}</strong><span>${esc((row.capacites||[]).map(c=>c.nom).filter(Boolean).join(' · '))}</span></summary><div class="grimoire-level-body">${abilities(row.capacites||[])}${readableData(Object.fromEntries(Object.entries(row).filter(([key])=>key!=='capacites')))}</div></details>`).join('')}</div>`)+
    remaining(base,['caracteristique_principale','de_vie','sauvegardes_maitrise'],'Formations et choix de départ')+
    remaining(item,['niveaux','niveaux_aptitudes','classe_parente','description']);
}
function originReading(item,type){
  const isSpecies=type==='species';
  return facts(isSpecies?[['Taille',typeof item.taille==='object'?item.taille.details||item.taille.categorie:item.taille],['Vitesse',item.vitesse!==undefined?item.vitesse+' m':null]]:[['Don d’origine',item.don],['Compétences',item.competences?.join(' · ')],['Outils',item.outils?.join(' · ')]])+
    section('Présentation',prose(item.description||''))+
    section(isSpecies?'Traits d’espèce':'Aptitude',abilities(isSpecies?item.traits||[]:item.aptitude?[item.aptitude]:[]))+
    remaining(item,['description',...(isSpecies?['taille','vitesse','traits']:['don','competences','outils','aptitude'])],isSpecies?'Lignages et autres particularités':'Équipement et inspirations');
}
function objectReading(item,type){
  if(type==='feats')return chips([item.categorie])+section('Description',prose(item.description||''))+(item.prerequis?section('Prérequis',readableData(Object.fromEntries(Object.entries(item.prerequis).filter(([,v])=>v!==null)))):'')+section('Ce que ce don vous apporte',abilities(item.effets||[]))+remaining(item,['categorie','description','prerequis','effets']);
  const price=typeof item.prix==='object'?`${item.prix?.quantite??''} ${item.prix?.monnaie||''}`:item.prix!==undefined?String(item.prix):null;
  return chips([item.categorie])+facts([['Dégâts',item.degats?.de?`${item.degats.de} ${item.degats.type||''}`:null],['Poids',item.poids!==undefined?item.poids+' kg':null],['Prix',price],['Caractéristique',item.caracteristique],['Botte d’arme',item.botte]])+
    (item.description?section('Description',prose(item.description)):'')+
    (item.proprietes?.length?section('Propriétés',readableData(item.proprietes)):'')+
    (type==='masteries'?section('Effets',abilities(item.effets||[])):'')+
    remaining(item,['categorie','prix','poids','caracteristique','botte','description','proprietes',...(type==='masteries'?['effets']:[])],type==='tools'?'Utilisations et fabrication':'Règles et précisions');
}
export function renderCatalogueDetail(entries,type,id){
  const entry=entries.find(e=>e.type===type&&e.id===id);
  if(!entry)return '<h1>Entrée introuvable</h1><a href="#grimoire">Retour au grimoire</a>';
  const item=entry.item,body=type==='spells'?spellReading(item):['classes','subclasses'].includes(type)?classReading(item):['species','backgrounds'].includes(type)?originReading(item,type):objectReading(item,type);
  return `<div class="grimoire-reading"><a class="back" href="#grimoire">← Retour au grimoire</a><header class="grimoire-heading"><p class="eyebrow">${esc(entry.category)}</p><h1>${esc(words(item.nom||id))}</h1></header><article class="portal-card portal-detail">${body}</article><a class="back grimoire-bottom-back" href="#grimoire">← Revenir aux résultats</a>${renderGrimoireSources()}</div>`;
}
