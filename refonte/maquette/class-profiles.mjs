import {activeFeatures,inheritedValue,classTraining} from './progression.mjs';
import {originSkills,toolOptions} from './origin-rules.mjs';
import {ritualGrantSpells} from './feat-effects.mjs';
import {classMagic} from './class-magic.mjs';
const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const canonical=(name,c)=>c.skills.find(s=>key(s.nom)===key(name)||key(name)==='intuition'&&key(s.nom)==='perspicacite')?.nom||name;
export const supportedClasses=['clerc','barbare','rodeur','barde','druide','guerrier'];
const picked=(state,name)=>state.classChoices?.[name]||[];
const subFor=(state,c)=>state.level>=3?c.subclasses.find(s=>s.id===state.subclassId&&s.classe_parente===state.classId):null;
const maxRank=row=>Math.max(0,...Object.entries(row?.emplacements_de_sort||{}).filter(([,n])=>n>0).map(([n])=>+n));
function lookupSpell(c,name){
  const aliases={detectiondessorts:'detection_de_la_magie',infiltrationillusoire:'deguisement',lueurfeerique:'lueurs_feeriques',guidance:'assistance',etoilefilante:'rayon_tracant',augmentationdescaracteristiques:'amelioration_caracteristique',marchesurleau:'marche_sur_l_onde',vaguetonnante:'vague_tonnante'};
  return c.spells.find(s=>s.id===name||s.id===aliases[key(name)]||key(s.nom)===key(name));
}
export function shapePool(state,c){
  if(state.classId!=='druide'||state.level<2)return [];
  const value=inheritedValue(state,c,'forme_sauvage_fp_max'),parts=String(value).split('/');
  const moon=state.subclassId==='druide_cercle_lune'&&state.level>=3;
  const cap=moon?Math.floor(state.level/3):parts.length===2?+parts[0]/+parts[1]:+value;
  const flight=moon||inheritedValue(state,c,'forme_sauvage_vol');
  return (c.shapeForms||[]).filter(f=>key(f.type)==='beast'?f.fp_numerique<=cap&&(flight||!f.vitesse?.vol):moon&&state.level>=6&&['Air Elemental','Earth Elemental','Fire Elemental','Water Elemental'].includes(f.nom_original));
}
function skillNames(state,c,through=state.level){
  const sub=through>=3?subFor({...state,level:through},c):null;
  const result=[...originSkills({...state,level:through},c),...(state.classSkills||[])];
  if(state.classId==='barbare'&&through>=3)result.push(...picked(state,'wildSkill'));
  if(sub?.id==='barde_college_savoir')result.push(...picked(state,'loreSkills'));
  if(sub?.id==='barde_college_danse')result.push('Acrobaties','Représentation');
  for(const [level,row]of Object.entries(state.advancements||{}))if(row.mode==='feat'&&+level<=through){if(row.featId==='comedien')result.push(row.choices?.skill);if(row.featId==='observateur')result.push(row.choices?.expertise);if(row.featId==='faveur_de_competence')result.push(...c.skills.map(s=>s.nom));}
  return [...new Set(result.filter(Boolean).map(n=>canonical(n,c)))];
}
function weaponOptions(state,c){
  const allowed=classTraining(state,c).weapons;
  return c.weapons.filter(w=>w.botte&&allowed.some(t=>t==='armes_courantes'&&w.categorie.includes('courante')||t==='armes_de_guerre'&&w.categorie.includes('guerre'))).map(w=>({id:key(w.nom),nom:w.nom,description:'Botte : '+w.botte}));
}
export function classChoiceSpecs(state,c){
  if(!supportedClasses.includes(state.classId)||state.classId==='clerc')return [];
  const cls=c.classes.find(x=>x.id===state.classId),base=cls?.niveaux?.[0]||{},sub=subFor(state,c),specs=[];
  const options=names=>names.map(n=>({id:canonical(n,c),nom:canonical(n,c)}));
  const add=(id,nom,count,opts,level=1,extra={})=>{if(state.level>=level)specs.push({key:id,nom,count,options:opts,level,...extra});};
  const languages=(id,nom,count,level)=>add(id,nom,count,[],level,{kind:'names'});
  if(state.classId==='guerrier'){
    const styles=c.feats.filter(f=>f.id.startsWith('style_')).map(f=>({id:f.id,nom:f.nom,description:f.effets.map(e=>e.valeur).join(' · ')}));
    add('weaponMasteries','Vos techniques d’armes',inheritedValue(state,c,'techniques_arme_nombre')||0,weaponOptions(state,c));
    add('combatStyle','Votre style de combat',1,styles);
    if(sub?.id==='guerrier_champion')add('combatStyle10','Second style de combat',1,styles.filter(s=>!picked(state,'combatStyle').includes(s.id)),10);
    if(sub?.id==='guerrier_maitre_guerre'){
      add('maneuvers','Vos manœuvres',3+2*[7,10,15,18].filter(n=>state.level>=n).length,c.fighterSupplements.maneuvers.map(m=>({...m})),3,{description:c.fighterSupplements.maneuverNote});
      add('maneuverAbility','Caractéristique du DD de manœuvre',1,options(['FOR','DEX']),3);
      add('artisanTool','Votre outil d’artisan',1,toolOptions(c).filter(t=>t.category==='artisan').map(t=>({id:t.id,nom:t.name})),3);
    }
    if(sub?.id==='guerrier_chevalier_occulte')add('boundWeapons','Armes liées · jusqu’à deux, après le rituel',2,c.weapons.map(w=>({id:key(w.nom),nom:w.nom})),3,{min:0});
  }
  if(state.classId==='barbare'){
    add('weaponMasteries','Vos bottes d’armes',inheritedValue(state,c,'bottes_armes')?.nombre||0,weaponOptions(state,c));
    add('wildSkill','Connaissance sauvage · compétence supplémentaire',1,options((base.competences_choisies?.options||[]).filter(n=>!skillNames({...state,classChoices:{}},c).some(s=>key(s)===key(n)))),3);
    if(sub?.id==='barbare_voie_arbre_monde')languages('treeLanguages','Langues de l’Arbre-Monde',2,3);
  }
  if(state.classId==='rodeur'){
    add('weaponMasteries','Vos bottes d’armes',2,weaponOptions(state,c));
    add('combatStyle','Votre style de combat',1,[...c.feats.filter(f=>f.id.startsWith('style_')).map(f=>({id:f.id,nom:f.nom,description:f.description})),{id:'natural',nom:'Combattant naturel',description:'Deux sorts mineurs de Druide, par la Sagesse.'}],2);
    add('expertise2','Expertise · niveau 2',1,options(skillNames(state,c,2)),2);
    add('expertise9','Expertises supplémentaires · niveau 9',2,options(skillNames(state,c,9).filter(n=>!picked(state,'expertise2').includes(n))),9);
    languages('rangerLanguages','Langues d’Éclaireur naturel',2,2);
    if(sub?.id==='rodeur_chasseur')for(const [level,id,nom,names]of [
      [3,'hunter3','Proie du chasseur',['Tueur de colosses','Massacreur de géants','Tueur de hordes']],
      [7,'hunter7','Tactiques défensives',['Pas de la chasse','Esquive instinctive','Défense d’acier']],
      [11,'hunter11','Carnage multiple',['Déluge de flèches','Tourbillon d’acier','Multiattaque de monstre']],
      [15,'hunter15','Supériorité du chasseur',['Esquive brutale','Repli agile','Immunité aux volées']],
    ])add(id,nom,1,names.map(n=>({id:n,nom:n})),level);
    if(sub?.id==='rodeur_belluaire'){
      add('companion','Votre compagnon animal',1,(c.shapeForms||[]).filter(f=>key(f.type)==='beast'&&f.fp_numerique<=0.25).map(f=>({id:f.slug,nom:f.nom,description:'NC '+f.fp})),3);
      add('companionHp','Modificateurs de PV du compagnon à préciser avec le MJ',1,[],3,{kind:'number',description:'La BDD donne 4 × niveau + SAG + « ses propres modificateurs », sans préciser ces derniers. Saisissez le complément convenu avec votre MJ.'});
      languages('companionUpgrade','Don ou amélioration du compagnon · niveau 7',1,7);
      add('companion11','Amélioration de la bête · niveau 11',1,['Griffes perçantes','Vitesse augmentée','Armure naturelle'].map(n=>({id:n,nom:n})),11);
    }
  }
  if(state.classId==='barde'){
    add('instruments','Vos trois instruments maîtrisés',3,toolOptions(c).filter(t=>t.category==='instruments_de_musique').map(t=>({id:t.id,nom:t.name})));
    if(state.equipment!=='B')add('equipmentInstrument','Instrument de votre équipement de départ · option A',1,toolOptions(c).filter(t=>picked(state,'instruments').includes(t.id)).map(t=>({id:t.id,nom:t.name})));
    add('expertise2','Expertises · niveau 2',2,options(skillNames(state,c,2)),2);
    add('expertise9','Expertises supplémentaires · niveau 9',2,options(skillNames(state,c,9).filter(n=>!picked(state,'expertise2').includes(n))),9);
    if(sub?.id==='barde_college_savoir'){
      add('loreSkills','Compétences du Collège du Savoir',3,options(c.skills.map(s=>s.nom).filter(n=>![...originSkills(state,c),...(state.classSkills||[])].some(x=>key(x)===key(n)))),3);
      add('loreSpells','Secrets magiques supplémentaires',2,c.spells.filter(s=>s.niveau>=1&&s.niveau<=maxRank(cls.niveaux[6])).map(s=>({id:s.id,nom:s.nom,description:'Niveau '+s.niveau})),6);
    }
  }
  if(state.classId==='druide'){
    const vocation=cls.niveaux[1]?.capacites?.find(f=>f.nom==='Vocation naturelle');
    add('vocationnaturelle','Votre vocation naturelle',1,(vocation?.options||[]).map(o=>({id:o.nom,nom:o.nom})));
    add('shapes','Vos formes animales connues',inheritedValue(state,c,'forme_sauvage_formes_connues')||0,shapePool(state,c).map(f=>({id:f.slug,nom:f.nom,description:`NC ${f.fp} · CA ${f.ca} · ${f.pv} PV`})),2);
    if(sub?.id==='druide_cercle_terre')add('terrain','Votre terrain du Cercle de la Terre',1,Object.keys(c.classSupplements?.terrainSpells||{}).map(n=>({id:n,nom:n})),3,{description:'Les terrains de la BDD correspondent à l’ancienne version du cercle. Les listes manquantes ont été complétées depuis les références officielles correspondantes, sans remplacer les aptitudes de la BDD.'});
    if(state.level>=7){const feature=cls.niveaux[7]?.capacites?.find(f=>f.nom==='Élan élémentaire');add('elementalStrike','Votre Élan élémentaire',1,(feature?.options||[]).map(o=>({id:o.nom,nom:o.nom})),7);}
  }
  return specs;
}
export function classChoiceErrors(state,c){
  const errors=[];
  for(const spec of classChoiceSpecs(state,c)){
    const selected=state.classChoices?.[spec.key]||[];
    const free=['names','number'].includes(spec.kind);
    if(!Array.isArray(selected)||selected.length<(spec.min??spec.count)||selected.length>spec.count||new Set(selected.map(key)).size!==selected.length||selected.some(v=>typeof v!=='string'||!v.trim()||!free&&!spec.options.some(o=>o.id===v)||spec.kind==='number'&&!/^[+-]?\d{1,4}$/.test(v)))errors.push(`${spec.nom} : choisissez ${spec.count} choix distinct${spec.count>1?'s':''} disponible${spec.count>1?'s':''}.`);
  }
  return errors;
}
export function buildClassProfile(state,c){
  if(!supportedClasses.includes(state.classId)||state.classId==='clerc'||!Number.isInteger(state.level)||state.level<1||state.level>20)return null;
  const cls=c.classes.find(x=>x.id===state.classId),magic=classMagic(state,c),row=magic.row;if(!cls?.niveaux?.[state.level])return null;
  const sub=subFor(state,c),features=activeFeatures(state,c),castingAbility=magic.ability;
  const always=[],extraSpells=[],missing=[];
  function grant(name,source,ability=castingAbility,utilisation=null,prepared=true){
    const spell=lookupSpell(c,name);
    if(!spell){missing.push(name);return;}
    const value={...spell,source,grantSource:source,caracteristique:ability,utilisation,sourceName:spell.nom};
    (prepared?always:extraSpells).push(value);
  }
  for(const f of features)for(const e of f.effets||[]){if(e.type==='sort_toujours_prepare')grant(e.sort,f.nom);if(e.type==='sorts_toujours_prepares')for(const id of e.sorts)grant(id,f.nom);if(e.type==='lancer_sort'&&e.sort)grant(e.sort,f.nom,castingAbility,e.cout?.options?.join(' ou ')||null,false);}
  for(const [n,data]of Object.entries(sub?.niveaux||{}))if(+n<=state.level)for(const name of data.sorts_connus_supplementaires||[])grant(name,sub.nom);
  if(sub?.id==='barbare_voie_arbre_monde'&&state.level>=14)grant('passage_par_les_arbres',sub.nom,'CON','1_repos_long',false);
  if(sub?.id==='rodeur_traqueur_tenebres')for(const id of ['detection_de_la_magie','tenebres','silence'])grant(id,'Magie des ténèbres','SAG','SAG fois/repos_long',false);
  if(sub?.id==='rodeur_vagabond_feerique'&&state.level>=7)grant('porte_dimensionnelle','Porte des fées','SAG','1_repos_court_ou_long',false);
  if(sub?.id==='barde_college_savoir'){
    if(state.level>=6)for(const id of picked(state,'loreSpells'))grant(id,'Secrets magiques supplémentaires','CHA',null,false);
    if(state.level>=14)grant('suggestion_de_groupe','Parole sans faille','CHA','1_repos_long',false);
  }
  if(sub?.id==='barde_college_seduction'&&state.level>=14)grant('domination_de_personne','Domination mentale','CHA','1_repos_long',false);
  if(sub?.id==='druide_cercle_terre'){
    const terrain=c.classSupplements?.terrainSpells?.[picked(state,'terrain')[0]];
    for(const [n,ids]of Object.entries(terrain||{}))if(+n<=state.level)for(const id of ids)grant(id,'Sorts de terrain · '+picked(state,'terrain')[0]);
  }
  if(sub?.id==='druide_cercle_astres'){
    grant('assistance','Carte stellaire','SAG',null,false);
    grant('rayon_tracant','Carte stellaire','SAG','SAG fois/repos_long',false);
    grant('amelioration_caracteristique','Carte stellaire','SAG','1_repos_long',false);
    if(state.level>=10)for(const id of ['clairvoyance','divination'])grant(id,'Œil des astres','SAG','1_repos_long',false);
  }
  if(sub?.id==='druide_cercle_mers'){
    for(const id of ['vague_tonnante','nappe_de_brouillard'])grant(id,'Enfant des mers','SAG','SAG fois/repos_long',false);
    if(state.level>=6)for(const id of ['marche_sur_l_onde','respiration_aquatique'])grant(id,'Promenade des profondeurs','SAG','1_repos_long',false);
  }
  const ritual=ritualGrantSpells(state,c);
  always.push(...ritual);
  const uniqueAlways=always.filter((s,i,a)=>a.findIndex(x=>x.id===s.id)===i);
  const bonusIds=[...uniqueAlways,...extraSpells].map(s=>s.id);
  const lists=state.classId==='barde'&&state.level>=10?['barde','clerc','druide','magicien']:[magic.spellClass];
  const pool=c.spells.filter(s=>s.classes?.some(n=>lists.includes(key(n))));
  const cantripPool=state.classId==='rodeur'?c.spells.filter(s=>s.classes?.some(n=>key(n)==='druide')):c.spells.filter(s=>s.classes?.some(n=>key(n)===magic.spellClass));
  const cantripCount=state.classId==='rodeur'?(state.level>=2&&picked(state,'combatStyle')[0]==='natural'?2:0):(row.sorts_mineurs||0)+(state.classId==='druide'&&picked(state,'vocationnaturelle')[0]==='Mage'?1:0)+(sub?.id==='druide_cercle_terre'?1:0);
  const rage=inheritedValue(state,c,'ragesParJour'),rageDamage=inheritedValue(state,c,'bonusDegatsDeRage');
  const resources=[];
  if(state.classId==='guerrier'){
    resources.push({nom:'Souffle vital',valeur:inheritedValue(state,c,'second_souffle_utilisations'),details:'Soin 1d10 + '+state.level+' · repos court : +1, repos long : maximum.'});
    if(state.level>=2)resources.push({nom:'Élan guerrier',valeur:state.level>=17?2:1,details:'Repos court/long · 1 par tour · action supplémentaire hors Magie.'});
    if(state.level>=9)resources.push({nom:'Ténacité',valeur:inheritedValue(state,c,'tenacite_utilisations')||1,details:'Repos long · relance JS raté + '+state.level+', nouveau résultat obligatoire.'});
    if(sub?.id==='guerrier_maitre_guerre')resources.push({nom:'Dés de supériorité',valeur:(state.level>=18?6:4)+'d'+(state.level>=18?12:state.level>=10?10:8),details:'Repos court/long · quantités et paliers de la BDD conservés.'});
    if(sub?.id==='guerrier_soldat_psi')resources.push({nom:'Dés psioniques',valeur:state.level>=18?'6d10':state.level>=15?'4d8':'2d6',details:'Récupération au repos long, selon la BDD.'});
  }
  if(state.classId==='barbare')resources.push({nom:'Rage',valeur:rage,details:'Repos court : +1 utilisation ; repos long : récupération complète.'},{nom:'Dégâts de Rage',valeur:'+'+rageDamage,details:'Attaque de corps à corps avec FOR pendant la Rage, sans armure lourde.'},...(state.level>=9?[{nom:'Frappe dévastatrice',valeur:state.level>=17?'2d10':'1d10',details:state.level>=17?'Deux effets par frappe, selon les conditions de l’aptitude.':'Un effet par frappe, selon les conditions de l’aptitude.'}]:[]));
  if(state.classId==='rodeur')resources.push({nom:'Proie jurée',valeur:inheritedValue(state,c,'proie_juree_utilisations'),details:'Utilisations gratuites de Marque du chasseur par repos long.'});
  if(state.classId==='barde')resources.push({nom:'Élan artistique',ability:'CHA',minimum:1,die:inheritedValue(state,c,'de_inspiration'),details:state.level>=5?'Récupération au repos court ou long.':'Récupération au repos long.'});
  if(state.classId==='druide'&&state.level>=2)resources.push({nom:'Forme animale',valeur:inheritedValue(state,c,'forme_sauvage_utilisations'),details:`${inheritedValue(state,c,'forme_sauvage_formes_connues')} formes connues · durée ${state.level/2} heures · ${state.level} PV temporaires à l’adoption.`});
  return {classId:state.classId,subclass:sub,domain:sub,row,castingAbility,hasMagic:magic.enabled,spellcastingNote:magic.note,spellcastingSource:magic.source,cantripCount,preparedCount:row.sorts_prepares||0,
    cantrips:cantripPool.filter(s=>s.niveau===0&&!bonusIds.includes(s.id)),prepared:pool.filter(s=>s.niveau>=1&&s.niveau<=maxRank(row)&&!bonusIds.includes(s.id)),
    slots:row.emplacements_de_sort||{},always:uniqueAlways,automaticCantrips:[],extraSpells,missingSpells:missing,domainFeatures:features.filter(f=>f.source.startsWith(sub?.nom+' ·')),maxSpellLevel:maxRank(row),proficiency:inheritedValue(state,c,'bonusMaitrise'),
    attacks:state.classId==='guerrier'?Math.max(1,...features.flatMap(f=>(f.effets||[]).filter(e=>e.total_attaques).map(e=>e.total_attaques))):state.classId==='barbare'&&state.level>=5||state.classId==='rodeur'&&state.level>=5||sub?.id==='barde_college_vaillance'&&state.level>=6?2:1,rage,rageDamage,resources};
}
export function classChoiceEffects(state,c){
  const specs=classChoiceSpecs(state,c),sub=subFor(state,c),skills=[],expertise=[],tools=[],languages=[],masteries=picked(state,'weaponMasteries');
  if(state.classId==='barbare'&&state.level>=3)skills.push(...picked(state,'wildSkill'));
  if(['rodeur','barde'].includes(state.classId)){if(state.level>=2)expertise.push(...picked(state,'expertise2'));if(state.level>=9)expertise.push(...picked(state,'expertise9'));}
  if(sub?.id==='barde_college_savoir')skills.push(...picked(state,'loreSkills'));
  if(sub?.id==='barde_college_danse')skills.push('Acrobaties','Représentation');
  if(state.classId==='barde')for(const id of picked(state,'instruments')){const tool=toolOptions(c).find(t=>t.id===id);if(tool)tools.push(tool.name);}
  if(sub?.id==='guerrier_maitre_guerre')for(const id of picked(state,'artisanTool')){const tool=toolOptions(c).find(t=>t.id===id);if(tool)tools.push(tool.name);}
  const cls=c.classes.find(x=>x.id===state.classId);
  if(Array.isArray(cls?.niveaux?.[0]?.maitrises_outils))for(const id of cls.niveaux[0].maitrises_outils)tools.push(c.tools.find(t=>key(t.id)===key(id)||key(id).includes('herboriste')&&key(t.nom).includes('herboriste'))?.nom||id.replaceAll('_',' '));
  for(const spec of specs.filter(s=>s.kind==='names'&&/Languages$/.test(s.key)))languages.push(...picked(state,spec.key));
  if(state.classId==='druide')languages.push('Druidique');
  const forms=state.classId==='druide'?picked(state,'shapes').map(id=>shapePool(state,c).find(f=>f.slug===id)).filter(Boolean):[];
  const companion=sub?.id==='rodeur_belluaire'?(c.shapeForms||[]).find(f=>f.slug===picked(state,'companion')[0]&&key(f.type)==='beast'&&f.fp_numerique<=.25):null;
  const equipmentInstrument=state.classId==='barde'?toolOptions(c).find(t=>t.id===picked(state,'equipmentInstrument')[0])?.name:null;
  return {equipmentInstrument,skills:skills.map(n=>canonical(n,c)),expertise,tools,languages,masteries,forms,companion,
    summaries:specs.map(s=>({nom:s.nom,choices:picked(state,s.key).map(id=>s.options.find(o=>o.id===id)?.nom||id)}))};
}
