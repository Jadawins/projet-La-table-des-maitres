import {activeFeatures,inheritedValue,classTraining,selectedLevelFeats} from './progression.mjs';
import {originSkills,toolOptions} from './origin-rules.mjs';
import {featGrantSpells} from './feat-effects.mjs';
import {classMagic} from './class-magic.mjs';
import {extraClassChoices,extraClassResources,extraClassGrants,extraClassErrors,wizardSpellbook} from './extra-classes.mjs';
import {primalProfiles,selectedPrimalProfile} from './beast-companion.mjs';
const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const canonical=(name,c)=>c.skills.find(s=>key(s.nom)===key(name)||key(name)==='intuition'&&key(s.nom)==='perspicacite')?.nom||name;
export const supportedClasses=['clerc','barbare','rodeur','barde','druide','guerrier','paladin','roublard','moine','magicien','ensorceleur','occultiste'];
const picked=(state,name)=>state.classChoices?.[name]||[];
const subFor=(state,c)=>state.level>=3?c.subclasses.find(s=>s.id===state.subclassId&&s.classe_parente===state.classId):null;
const maxRank=row=>Math.max(0,...Object.entries(row?.emplacements_de_sort||{}).filter(([,n])=>n>0).map(([n])=>+n));
function lookupSpell(c,name){
  const aliases={couronnedefolie:'couronne_du_dement',couronne_de_folie:'couronne_du_dement',flammecontinue:'flamme_eternelle',croissancedeplantes:'croissance_vegetale',protectioncontrelebienetlemal:'protection_contre_le_mal_et_le_bien',passesanstrace:'passage_sans_trace',soinsdesblessures:'soins',soindesblessures:'soins',agrandissementetretrecissement:'agrandissement_rapetissement',chatimentcourrouce:'chatiment_de_courroux',detectiondessorts:'detection_de_la_magie',infiltrationillusoire:'deguisement',lueurfeerique:'lueurs_feeriques',guidance:'assistance',etoilefilante:'rayon_tracant',augmentationdescaracteristiques:'amelioration_caracteristique',marchesurleau:'marche_sur_l_onde',vaguetonnante:'vague_tonnante'};
  return c.spells.find(s=>s.id===name||s.id===aliases[key(name)]||key(s.nom)===key(name));
}
export function shapePool(state,c){
  if(state.classId!=='druide'||state.level<2)return [];
  const value=inheritedValue(state,c,'forme_sauvage_fp_max'),parts=String(value).split('/');
  const moon=state.subclassId==='druide_cercle_lune'&&state.level>=3;
  const cap=moon?Math.floor(state.level/3):parts.length===2?+parts[0]/+parts[1]:+value;
  const flight=inheritedValue(state,c,'forme_sauvage_vol');
  return (c.shapeForms||[]).filter(f=>f.reference2024?.verified===true&&key(f.type)==='beast'&&f.sous_type!=='Swarm'&&f.fp_numerique<=cap&&(flight||!f.vitesse?.vol));
}
function skillNames(state,c,through=state.level){
  const sub=through>=3?subFor({...state,level:through},c):null;
  const result=[...originSkills({...state,level:through},c),...(state.classSkills||[])];
  if(state.classId==='barbare'&&through>=3)result.push(...picked(state,'wildSkill'));
  if(sub?.id==='barde_college_savoir')result.push(...picked(state,'loreSkills'));
  if(sub?.id==='rodeur_vagabond_feerique')result.push(...picked(state,'feySkill'));
  if(sub?.id==='guerrier_maitre_guerre')result.push(...picked(state,'studentSkill'));
  if(sub?.id==='moine_credo_misericorde')result.push('Perspicacité','Médecine');
  for(const [level,row]of Object.entries(state.advancements||{}))if(row.mode==='feat'&&+level<=through){if(row.featId==='expert')result.push(row.choices?.skill);if(['observateur','keen_mind'].includes(row.featId))result.push(row.choices?.expertise);if(row.featId==='faveur_de_competence')result.push(...c.skills.map(s=>s.nom));}
  return [...new Set(result.filter(Boolean).map(n=>canonical(n,c)))];
}
function weaponOptions(state,c){
  const allowed=classTraining(state,c).weapons;
  return c.weapons.filter(w=>w.botte&&allowed.some(t=>t==='armes_courantes'&&w.categorie.includes('courante')||t==='armes_de_guerre'&&w.categorie.includes('guerre')||t==='armes_de_guerre_finesse_ou_legeres'&&w.categorie.includes('guerre')&&w.proprietes.some(p=>['finesse','legere'].includes(p)))).map(w=>({id:key(w.nom),nom:w.nom,description:'Botte : '+w.botte}));
}
export function classChoiceSpecs(state,c){
  if(!supportedClasses.includes(state.classId)||state.classId==='clerc')return [];
  const cls=c.classes.find(x=>x.id===state.classId),base=cls?.niveaux?.[0]||{},sub=subFor(state,c),specs=[];
  const options=names=>names.map(n=>({id:canonical(n,c),nom:canonical(n,c)}));
  const add=(id,nom,count,opts,level=1,extra={})=>{if(state.level>=level)specs.push({key:id,nom,count,options:opts,level,...extra});};
  const languages=(id,nom,count,level)=>add(id,nom,count,[],level,{kind:'names'});
  if(state.classId==='paladin'){
    add('weaponMasteries','Vos bottes d’armes',2,weaponOptions(state,c));
    add('combatStyle','Votre style de combat',1,[...c.feats.filter(f=>f.id.startsWith('style_')).map(f=>({id:f.id,nom:f.nom,description:f.effets.map(e=>e.valeur).join(' · ')})),{id:'divine',nom:'Combattant divin',description:'Deux sorts mineurs de Clerc, par le Charisme.'}],2);
  }
  if(state.classId==='guerrier'){

    const styles=c.feats.filter(f=>f.id.startsWith('style_')).map(f=>({id:f.id,nom:f.nom,description:f.effets.map(e=>e.valeur).join(' · ')}));
    add('weaponMasteries','Vos techniques d’armes',inheritedValue(state,c,'techniques_arme_nombre')||0,weaponOptions(state,c));
    add('combatStyle','Votre style de combat',1,styles);
    if(sub?.id==='guerrier_champion')add('combatStyle10','Second style de combat · niveau 7',1,styles.filter(s=>!picked(state,'combatStyle').includes(s.id)),7);
    if(sub?.id==='guerrier_maitre_guerre'){
      add('maneuvers','Vos manœuvres',3+2*[7,10,15].filter(n=>state.level>=n).length,c.fighterSupplements.maneuvers.map(m=>({...m})),3,{description:c.fighterSupplements.maneuverNote});
      add('maneuverAbility','Caractéristique du DD de manœuvre',1,options(['FOR','DEX']),3);
      add('artisanTool','Votre outil d’artisan',1,toolOptions(c).filter(t=>t.category==='artisan').map(t=>({id:t.id,nom:t.name})),3);
      add('studentSkill','Étudiant de la guerre · compétence',1,options((base.competences_choisies?.options||[]).filter(n=>!skillNames({...state,classChoices:{...state.classChoices,studentSkill:[]}},c,3).some(x=>key(x)===key(n)))),3);
    }
    if(sub?.id==='guerrier_chevalier_occulte')add('boundWeapons','Armes liées · jusqu’à deux, après le rituel',2,c.weapons.map(w=>({id:key(w.nom),nom:w.nom})),3,{min:0});
  }
  if(state.classId==='barbare'){
    add('weaponMasteries','Vos bottes d’armes',inheritedValue(state,c,'bottes_armes')?.nombre||0,weaponOptions(state,c).filter(o=>c.weapons.some(w=>key(w.nom)===o.id&&w.categorie.includes('corps_a_corps'))));
    add('wildSkill','Connaissance sauvage · compétence supplémentaire',1,options((base.competences_choisies?.options||[]).filter(n=>!skillNames({...state,classChoices:{}},c,3).some(s=>key(s)===key(n)))),3);
    if(sub?.id==='barbare_voie_coeur_sauvage')add('wildAspect','Votre Aspect sauvage · changeable au Repos long',1,options(['Chouette','Panthère','Saumon']),6);
  }
  if(state.classId==='rodeur'){
    add('weaponMasteries','Vos bottes d’armes',2,weaponOptions(state,c));
    add('combatStyle','Votre style de combat',1,[...c.feats.filter(f=>f.id.startsWith('style_')).map(f=>({id:f.id,nom:f.nom,description:f.description})),{id:'natural',nom:'Combattant naturel',description:'Deux sorts mineurs de Druide, par la Sagesse.'}],2);
    add('expertise2','Expertise · niveau 2',1,options(skillNames(state,c,2)),2);
    add('expertise9','Expertises supplémentaires · niveau 9',2,options(skillNames(state,c,9).filter(n=>!picked(state,'expertise2').includes(n))),9);
    languages('rangerLanguages','Langues d’Éclaireur naturel',2,2);
    if(sub?.id==='rodeur_chasseur')for(const [level,id,nom]of [[3,'hunter3','Proie du chasseur'],[7,'hunter7','Tactiques défensives']])add(id,nom,1,(sub.niveaux[level].capacites.find(f=>f.nom===nom)?.options||[]).map(o=>({id:o.nom,nom:o.nom,description:o.description})),level,{description:'Option remplaçable à chaque Repos court ou long.'});
    if(sub?.id==='rodeur_vagabond_feerique')add('feySkill','Compétence de Charme d’outremonde',1,options(['Tromperie','Représentation','Persuasion'].filter(n=>!skillNames({...state,classChoices:{...state.classChoices,feySkill:[]}},c,3).some(k=>key(k)===key(n)))),3);
    if(sub?.id==='rodeur_traqueur_tenebres'&&state.level>=7&&selectedLevelFeats(state,c).some(r=>r.level<=7&&r.feat.id==='resilient'&&r.choice.featAbility==='SAG'))add('ironMind','Esprit de fer · SAG déjà maîtrisée',1,options(['INT','CHA']),7);
    if(sub?.id==='rodeur_belluaire'){
      add('companion','Votre compagnon primordial',1,primalProfiles(state,c).map(f=>({id:f.id,nom:f.nom})),3);
      add('companionDamage','Type de dégâts du compagnon',1,(selectedPrimalProfile(state,c)?.types_degats||[]).map(id=>({id,nom:id})),3);
      add('companionAppearance','Apparence adaptée au profil (facultatif)',1,[],3,{kind:'names',min:0});
    }
  }
  if(state.classId==='barde'){
    add('instruments','Vos trois instruments maîtrisés',3,toolOptions(c).filter(t=>t.category==='instruments_de_musique').map(t=>({id:t.id,nom:t.name})));
    if(state.equipment!=='B')add('equipmentInstrument','Instrument de votre équipement de départ · option A',1,toolOptions(c).filter(t=>picked(state,'instruments').includes(t.id)).map(t=>({id:t.id,nom:t.name})));
    add('expertise2','Expertises · niveau 2',2,options(skillNames(state,c,2)),2);
    add('expertise9','Expertises supplémentaires · niveau 9',2,options(skillNames(state,c,9).filter(n=>!picked(state,'expertise2').includes(n))),9);
    if(sub?.id==='barde_college_savoir'){
      add('loreSkills','Compétences du Collège du Savoir',3,options(c.skills.map(s=>s.nom).filter(n=>![...originSkills(state,c),...(state.classSkills||[])].some(x=>key(x)===key(n)))),3);
      add('loreSpells','Découvertes magiques · toujours préparées',2,c.spells.filter(s=>s.niveau>=0&&s.niveau<=maxRank(cls.niveaux[state.level])&&s.classes?.some(n=>['clerc','druide','magicien'].includes(key(n)))).map(s=>({id:s.id,nom:s.nom,description:s.niveau===0?'Sort mineur':'Niveau '+s.niveau})),6,{description:'Deux sorts au niveau 6, puis un remplacement par niveau gagné. Lors de l’accès à un nouveau rang après le niveau 6, un seul des deux peut déjà être de ce nouveau rang.'});
    }
  }
  if(state.classId==='druide'){
    const vocation=cls.niveaux[1]?.capacites?.find(f=>f.nom==='Vocation naturelle');
    add('vocationnaturelle','Votre vocation naturelle',1,(vocation?.options||[]).map(o=>({id:o.nom,nom:o.nom})));
    add('shapes','Vos formes animales connues',inheritedValue(state,c,'forme_sauvage_formes_connues')||0,shapePool(state,c).map(f=>({id:f.slug,nom:f.nom,description:`NC ${f.fp} · CA ${f.ca} · ${f.pv} PV`})),2);
    if(sub?.id==='druide_cercle_terre')add('terrain','Votre terrain du Cercle de la Terre',1,Object.keys(c.classSupplements?.land2024?.terrains||{}).map(n=>({id:n,nom:n})),3,{description:'Choix à chaque Repos long : quatre environnements 2024. Les sorts de cercle sont toujours préparés, y compris le sort mineur accordé.'});
    if(state.level>=7){const feature=cls.niveaux[7]?.capacites?.find(f=>f.nom==='Élan élémentaire');add('elementalStrike','Votre Élan élémentaire',1,(feature?.options||[]).map(o=>({id:o.nom,nom:o.nom})),7);}
  }
  extraClassChoices(state,c,{add,options,weaponOptions,skillNames,sub,languages,lookupSpell});
  return specs;
}
export function classChoiceErrors(state,c){
  const errors=[];
  for(const spec of classChoiceSpecs(state,c)){
    const selected=state.classChoices?.[spec.key]||[];
    const free=['names','number'].includes(spec.kind);
    if(!Array.isArray(selected)||selected.length<(spec.min??spec.count)||selected.length>spec.count||new Set(selected.map(key)).size!==selected.length||selected.some(v=>typeof v!=='string'||!v.trim()||!free&&!spec.options.some(o=>o.id===v)||spec.kind==='number'&&!/^[+-]?\d{1,4}$/.test(v)))errors.push(`${spec.nom} : choisissez ${spec.count} choix distinct${spec.count>1?'s':''} disponible${spec.count>1?'s':''}.`);
  }
  if(state.subclassId==='barde_college_savoir'&&[7,9,11,13,15,17].includes(state.level)){
    const rank=maxRank(c.classes.find(x=>x.id==='barde')?.niveaux?.[state.level]);
    if(picked(state,'loreSpells').filter(id=>c.spells.find(x=>x.id===id)?.niveau===rank).length>1)errors.push('Découvertes magiques : un seul sort du nouveau rang à ce niveau, car un seul remplacement est possible par niveau gagné.');
  }
  errors.push(...extraClassErrors(state,c));
  return errors;
}
export function buildClassProfile(state,c){
  if(!supportedClasses.includes(state.classId)||state.classId==='clerc'||!Number.isInteger(state.level)||state.level<1||state.level>20)return null;
  const cls=c.classes.find(x=>x.id===state.classId),magic=classMagic(state,c),row=magic.row;if(!cls?.niveaux?.[state.level])return null;
  const sub=subFor(state,c),features=activeFeatures(state,c),castingAbility=magic.ability;
  const always=[],extraSpells=[],missing=[];
  function grant(name,source,ability=castingAbility,utilisation=null,prepared=true){
    const spell=lookupSpell(c,name);
    if(!spell){if(state.classChoices?.rulesToReview?.includes(name)){extraSpells.push({id:'unresolved:'+key(name),nom:name,niveau:null,description:'Fiche non reliée : niveau et effets à préciser avec le MJ. Aucune correspondance n’a été inventée.',source,caracteristique:null,unresolved:true,degats:[]});}else missing.push(name);return;}
    const value={...spell,source,grantSource:source,caracteristique:ability,utilisation,sourceName:spell.nom,...(source==='Savoir rituel · Grimoire'?{ritualOnly:true}:{})};
    (prepared?always:extraSpells).push(value);
  }
  for(const f of features)for(const e of f.effets||[]){if(e.type==='sort_toujours_prepare')grant(e.sort,f.nom);if(e.type==='sorts_toujours_prepares')for(const id of e.sorts||[])grant(id,f.nom);if(e.type==='lancer_sort'&&e.sort)grant(e.sort,f.nom,castingAbility,e.cout?.options?.join(' ou ')||null,false);}
  for(const [n,data]of Object.entries(sub?.niveaux||{}))if(+n<=state.level)for(const name of data.sorts_connus_supplementaires||[])grant(name,sub.nom);
  if(sub?.id==='barbare_voie_coeur_sauvage'){
    for(const id of ['presence_bestiale','communication_avec_les_animaux',...(state.level>=10?['communion_avec_la_nature']:[])]){
      grant(id,'Parole sauvage','SAG','Rituel uniquement, hors Rage',false);
      const ritual=extraSpells.at(-1);if(ritual?.id===id)ritual.rituel=true;
    }
  }
  if(sub?.id==='barde_college_savoir'){
    if(state.level>=6)for(const id of picked(state,'loreSpells'))grant(id,'Découvertes magiques','CHA');
  }
  if(sub?.id==='druide_cercle_terre'){
    const terrain=c.classSupplements?.land2024?.terrains?.[picked(state,'terrain')[0]]?.spells;
    for(const [n,ids]of Object.entries(terrain||{}))if(+n<=state.level)for(const id of ids)grant(id,'Sorts de terrain · '+picked(state,'terrain')[0]);
  }
  if(sub?.id==='druide_cercle_astres'){
    grant('assistance','Carte stellaire · carte tenue','SAG');
    grant('rayon_tracant','Carte stellaire · carte tenue','SAG','SAG (minimum une) fois par Repos long sans emplacement ; emplacements possibles');
  }
  if(state.classId==='paladin'){
    for(const [n,data]of Object.entries(sub?.niveaux||{}))if(+n<=state.level)for(const [rank,names]of Object.entries(data.sorts_serment||{}))if(+rank<=maxRank(row)){
      for(const name of names)grant(name,sub.nom);
    }
  }
  extraClassGrants(state,c,sub,grant);
  if(sub?.id==='occultiste_protecteur_archifee'){const spell=always.find(s=>s.id==='foulee_brumeuse');if(spell)spell.utilisation='CHA utilisations (minimum une) gratuites par Repos long ; effets de Pas féeriques à chaque incantation.';}
  if(state.classId==='occultiste'&&state.level>=9){const spell=always.find(s=>s.id==='contact_avec_les_plans');if(spell)spell.utilisation='Communion avec le protecteur : une utilisation sans emplacement par Repos long pour contacter votre protecteur, JS réussi automatiquement. Les autres incantations suivent les règles normales du sort.';}
  if(sub?.id==='guerrier_soldat_psi'&&state.level>=18)grant('telekinesie','Maître télékinétique','INT','Sans emplacement ni composantes une fois par Repos long ; un dé psionique restaure l’utilisation sans action.');
  if(state.classId==='occultiste')for(const [n,data]of Object.entries(sub?.niveaux||{}))if(+n<=state.level)for(const name of data.sorts_elargis||[])if(!lookupSpell(c,name))grant(name,'Liste élargie BDD',null,null,false);
  const ritual=featGrantSpells(state,c);
  always.push(...ritual);
  const uniqueAlways=always.filter((s,i,a)=>a.findIndex(x=>x.id===s.id)===i);
  const automaticCantrips=sub?.id==='roublard_arnaqueur_arcanique'?c.spells.filter(s=>s.id==='main_du_mage'):[];
  const bonusIds=[...uniqueAlways,...extraSpells.filter(s=>!s.ritualOnly),...automaticCantrips].map(s=>s.id);
  const lists=state.classId==='barde'&&state.level>=10?['barde','clerc','druide','magicien']:[magic.spellClass];
  const expanded=state.classId==='occultiste'?Object.entries(sub?.niveaux||{}).filter(([n])=>+n<=state.level).flatMap(([,r])=>r.sorts_elargis||[]).map(name=>lookupSpell(c,name)).filter(Boolean).map(x=>x.id):[];
  const pool=c.spells.filter(s=>(s.classes?.some(n=>lists.includes(key(n)))||expanded.includes(s.id))&&(state.classId!=='magicien'||wizardSpellbook(state).includes(s.id)));
  const cantripPool=state.classId==='paladin'?c.spells.filter(s=>s.classes?.some(n=>key(n)==='clerc')):state.classId==='rodeur'?c.spells.filter(s=>s.classes?.some(n=>key(n)==='druide')):c.spells.filter(s=>s.classes?.some(n=>key(n)===magic.spellClass));
  const cantripCount=sub?.id==='roublard_arnaqueur_arcanique'?row.sorts_mineurs-1:state.classId==='paladin'?(state.level>=2&&picked(state,'combatStyle')[0]==='divine'?2:0):state.classId==='rodeur'?(state.level>=2&&picked(state,'combatStyle')[0]==='natural'?2:0):(row.sorts_mineurs||0)+(state.classId==='druide'&&picked(state,'vocationnaturelle')[0]==='Mage'?1:0);
  const rage=inheritedValue(state,c,'ragesParJour'),rageDamage=inheritedValue(state,c,'bonusDegatsDeRage');
  const resources=extraClassResources(state,c,sub);
  if(state.classId==='paladin'){
    resources.push({nom:'Toucher guérisseur',valeur:5*state.level,details:'PV du pool par repos long ; coût 5 par état supprimé.'});
    if(state.level>=2)resources.push({nom:'Châtiment divin',valeur:1,details:'Utilisation sans emplacement par repos long.'});
    if(state.level>=3)resources.push({nom:'Canalisation divine',valeur:inheritedValue(state,c,'conduit_divin'),details:'Repos court : +1 utilisation ; repos long : maximum.'});
    if(state.level>=5)resources.push({nom:'Appel de destrier',valeur:1,details:'Utilisation sans emplacement par repos long.'});
    if(state.level>=6)resources.push({nom:'Aura défensive',ability:'CHA',minimum:1,kind:'aura',details:(state.level>=18?'9':'3')+' m · bonus aux sauvegardes tant que non neutralisé.'});
    if(state.level>=9)resources.push({nom:'Abjuration sacrée',ability:'CHA',minimum:1,kind:'targets',details:'Cibles visibles à 18 m ; action Magie, une Canalisation divine. JS SAG contre DD sorts, Effrayé une minute ou jusqu’aux prochains dégâts ; une seule option par tour entre déplacement, action ou Bonus.'});
    if(state.level>=10)resources.push({nom:'Aura de bravoure',valeur:(state.level>=18?'9':'3')+' m',details:'Vous et alliés : immunité à Effrayé dans l’Aura défensive active ; état d’un allié entrant suspendu tant qu’il reste dans l’aura.'});
    const radius=state.level>=18?'9':'3';
    if(sub?.id==='paladin_serment_devotion'){
      resources.push({nom:'Arme sacrée',ability:'CHA',minimum:1,kind:'aura',details:'Bonus aux jets d’attaque avec l’arme imprégnée seulement ; une Canalisation pendant l’action Attaquer, 10 minutes. Aucun bonus permanent.'});
      if(state.level>=7)resources.push({nom:'Aura de dévotion',valeur:radius+' m',details:'Immunité à Charmé dans l’Aura défensive ; l’effet d’un Charme existant est suspendu pour un allié dans l’aura. Tant que non Neutralisé.'});
      if(state.level>=15)resources.push({nom:'Châtiment protecteur',valeur:'Abri partiel',details:'Vous et vos alliés dans l’Aura défensive, après Châtiment divin et jusqu’au début de votre prochain tour ; +2 CA et JS DEX lorsque l’abri s’applique.'});
      if(state.level>=20)resources.push({nom:'Halo sacré',ability:'CHA',kind:'formula',base:2+Math.floor((state.level-1)/4),details:'Dégâts radiants CHA + maîtrise, ennemi débutant son tour dans l’Aura défensive ; actif seulement pendant le pouvoir de 10 minutes.'});
    }
    if(sub?.id==='paladin_serment_anciens'){
      resources.push({nom:'DD de Courroux de la nature',ability:'CHA',kind:'dc',details:'JS FOR des créatures choisies visibles à 4,50 m ; une Canalisation divine, action Magie.'});
      if(state.level>=7)resources.push({nom:'Aura de protection ancienne',valeur:radius+' m',details:'Résistance nécrotique, psychique et radiante, vous et vos alliés dans l’Aura défensive, tant que non Neutralisé.'});
      if(state.level>=15)resources.push({nom:'Sentinelle immortelle',valeur:3*state.level,details:'PV récupérés après être resté à 1 PV au lieu de tomber à 0 sans mort immédiate ; une utilisation par Repos long.'});
    }
    if(sub?.id==='paladin_serment_gloire'){
      resources.push({nom:'Châtiment inspirant',valeur:'2d8 + '+state.level,details:'PV temporaires à répartir entre créatures choisies à 9 m, vous compris ; une Canalisation juste après Châtiment divin, jet explicite.'});
      if(state.level>=7)resources.push({nom:'Aura de célérité',valeur:'+3 m',details:'Votre Vitesse inclut déjà ce bonus. Allié entrant dans l’Aura défensive ('+radius+' m) une première fois par tour ou y débutant son tour : +3 m jusqu’à la fin de son prochain tour.'});
      if(state.level>=15)resources.push({nom:'Défense glorieuse',ability:'CHA',kind:'quota',minimum:1,details:'Utilisations par Repos long ; réaction, bonus de CA égal à CHA (minimum +1) contre une attaque touchant vous ou une créature visible à 3 m. Si elle rate, une attaque d’arme possible contre l’attaquant à portée.'});
    }
    if(sub?.id==='paladin_serment_vengeance'){
      resources.push({nom:'Vœu d’inimitié',valeur:'1 minute',details:'Une Canalisation pendant l’action Attaquer ; cible visible à 9 m, Avantage contre elle, sans Concentration. Transfert sans action à sa chute à 0 PV.'});
      if(state.level>=20)resources.push({nom:'DD d’Ange de la vengeance',ability:'CHA',kind:'dc',details:'JS SAG au début du tour ennemi dans l’Aura défensive ; Effrayé une minute ou jusqu’aux prochains dégâts. Seulement pendant le pouvoir actif.'});
    }
    if(sub&&state.level>=20)resources.push({nom:sub.niveaux[20].capacites[0].nom+' · utilisations',valeur:1,details:'Repos long, ou emplacement de rang 5 pour récupérer l’utilisation sans action. Activation en action Bonus ; durée '+(sub.id==='paladin_serment_anciens'?'une minute.':'10 minutes.')});
  }
  if(state.classId==='guerrier'){
    resources.push({nom:'Souffle vital',valeur:inheritedValue(state,c,'second_souffle_utilisations'),details:'Soin 1d10 + '+state.level+' · repos court : +1, repos long : maximum.'});
    if(state.level>=2)resources.push({nom:'Élan guerrier',valeur:state.level>=17?2:1,details:'Repos court/long · 1 par tour · action supplémentaire hors Magie.'});
    if(state.level>=9)resources.push({nom:'Ténacité',valeur:inheritedValue(state,c,'tenacite_utilisations')||1,details:'Repos long · relance JS raté + '+state.level+', nouveau résultat obligatoire.'});
    if(sub?.id==='guerrier_maitre_guerre'){
      resources.push({nom:'Dés de supériorité',valeur:(state.level>=15?6:state.level>=7?5:4)+'d'+(state.level>=18?12:state.level>=10?10:8),details:'Repos court/long ; maximum une manœuvre par attaque.'});
      if(state.level>=7)resources.push({nom:'Connaître son ennemi',valeur:1,details:'Repos long, ou un dé de supériorité pour restaurer sans action ; action Bonus, cible visible à 9 m, immunités/résistances/vulnérabilités.'});
      if(state.level>=15)resources.push({nom:'Implacable',valeur:'1d8',details:'Une fois par tour, une manœuvre utilise ce dé sans dépenser la réserve de supériorité ; jet explicite.'});
    }
    if(sub?.id==='guerrier_soldat_psi'){
      const psi=sub.niveaux[3].des_psioniques.findLast(r=>r.niveau<=state.level);
      resources.push({nom:'Dés psioniques',valeur:psi.nombre+psi.de,details:'Un dé récupéré au Repos court, tous au Repos long ; réserve propre au Soldat psychique.'},{nom:'Champ protecteur',ability:'INT',kind:'heal',die:psi.de,details:'Réduction des dégâts (minimum 1), réaction et un dé, vous ou créature visible à 9 m.'},{nom:'Frappe psionique',ability:'INT',kind:'heal',die:psi.de,details:'Dégâts de force, un dé ; après dégâts d’arme à 9 m, une fois à votre tour.'},{nom:'Déplacement télékinétique',valeur:1,details:'Repos court/long, ou un dé pour restaurer sans action ; action Magie, cible visible à 9 m, déplacement jusqu’à 9 m.'});
      if(state.level>=7)resources.push({nom:'DD de Poussée télékinétique',ability:'INT',kind:'dc',details:'JS FOR après Frappe psionique ; À terre ou déplacement horizontal de 3 m.'},{nom:'Saut psionique',valeur:1,details:'Repos court/long, ou un dé pour restaurer sans action. Action Bonus : vol double-Vitesse jusqu’à la fin du tour uniquement.'});
      if(state.level>=15)resources.push({nom:'Rempart de force',ability:'INT',minimum:1,kind:'targets',details:'Créatures à 9 m, vous compris ; Abri partiel une minute ou jusqu’à Neutralisé. Une fois par Repos long, ou un dé pour restaurer sans action.'});
    }
    if(sub?.id==='guerrier_champion'){
      resources.push({nom:'Athlète remarquable',valeur:'Avantage',details:'Initiative et tests FOR (Athlétisme) ; après un critique, demi-Vitesse sans attaque d’opportunité.'});
      if(state.level>=10)resources.push({nom:'Guerrier héroïque',valeur:'Début du tour',details:'En combat seulement, vous pouvez recevoir une Inspiration héroïque si vous n’en avez pas.'});
      if(state.level>=18)resources.push({nom:'Survivant',ability:'CON',kind:'formula',base:5,details:'PV au début du tour si En péril et au moins 1 PV. Avantage aux sauvegardes contre la mort ; 18–20 traité comme 20.'});
    }
  }
  if(state.classId==='barbare')resources.push({nom:'Rage',valeur:rage,details:'Repos court : +1 utilisation ; repos long : récupération complète.'},{nom:'Dégâts de Rage',valeur:'+'+rageDamage,details:'Toute attaque FOR avec arme ou mains nues pendant la Rage, sans armure lourde ; inclut les attaques lancées basées sur FOR.'},...(state.level>=9?[{nom:'Frappe dévastatrice',valeur:state.level>=17?'2d10':'1d10',details:state.level>=17?'Deux effets par frappe, selon les conditions de l’aptitude.':'Un effet par frappe, selon les conditions de l’aptitude.'}]:[]));
  if(state.classId==='rodeur')resources.push({nom:'Proie jurée',valeur:inheritedValue(state,c,'proie_juree_utilisations'),details:'Utilisations gratuites de Marque du chasseur par repos long.'});
  if(state.classId==='rodeur'&&state.level>=10)resources.push({nom:'Résistance primitive',ability:'SAG',kind:'heal',die:'1d8',details:'PV temporaires, minimum 1 PV ; action Magie.'},{nom:'Résistance primitive · utilisations',ability:'SAG',kind:'quota',minimum:1,details:'Repos long ; chaque Repos court réduit aussi votre Épuisement de un.'});
  if(state.classId==='rodeur'&&state.level>=14)resources.push({nom:'Manteau naturel',ability:'SAG',kind:'quota',minimum:1,details:'Repos long ; action Bonus, Invisible jusqu’à la fin de votre prochain tour.'});
  if(state.classId==='barbare'&&state.level>=11)resources.push({nom:'Furie indomptable',valeur:2*state.level,details:'PV après JS CON réussi à la chute à 0 PV en Rage sans mort immédiate. DD 10, puis +5 par réemploi ; réinitialisé au Repos court ou long.'});
  if(state.classId==='barde')resources.push({nom:'Élan artistique',ability:'CHA',minimum:1,die:inheritedValue(state,c,'de_inspiration'),details:state.level>=5?'Récupération au repos court ou long.':'Récupération au repos long.'});
  if(state.classId==='druide'&&state.level>=2)resources.push({nom:'Forme animale',valeur:inheritedValue(state,c,'forme_sauvage_utilisations'),details:`${inheritedValue(state,c,'forme_sauvage_formes_connues')} formes connues · durée ${Math.floor(state.level/2)} heures · ${sub?.id==='druide_cercle_lune'?3*state.level:state.level} PV temporaires à l’adoption.`});
  if(state.classId==='druide'&&state.level>=5)resources.push({nom:'Résilience sauvage · emplacement',valeur:1,details:'Une Forme animale non dépensée convertie sans action en emplacement de rang 1, une fois par Repos long. Conversion inverse seulement si aucune Forme ne reste, une fois à chacun de vos tours.'});
  if(state.classId==='druide'&&state.level>=20)resources.push({nom:'Magie de la terre',valeur:1,details:'Repos long ; utilisations non dépensées de Forme animale converties en un seul emplacement, deux rangs par utilisation, sans action. À l’initiative si aucune Forme ne reste, une utilisation récupérée.'});
  if(sub?.id==='roublard_assassin'){
    resources.push({nom:'Assassinat',valeur:'+'+state.level,details:'Dégâts de l’arme ajoutés à l’Attaque sournoise au premier round ; Avantage à l’initiative, et aux attaques contre une créature n’ayant pas encore joué pendant ce round.'});
    if(state.level>=17)resources.push({nom:'DD de Frappe mortelle',ability:'DEX',kind:'dc',details:'JS CON ; Attaque sournoise au premier round, dégâts de l’attaque doublés si échec.'});
  }
  if(sub?.id==='roublard_arnaqueur_arcanique'&&state.level>=17)resources.push({nom:'DD de Voleur de sorts',ability:'INT',kind:'dc',details:'Réaction, JS INT du lanceur ; après un vol réussi, Repos long requis avant réutilisation.'});
  if(sub?.id==='roublard_voleur'&&state.level>=13)resources.push({nom:'Harmonisations du voleur',valeur:4,details:'Objets magiques simultanément harmonisés ; 1d6 explicite sur une dépense de charges, aucune charge dépensée sur 6.'});
  if(sub?.id==='rodeur_vagabond_feerique'){
    if(state.level>=11){const spell=always.find(x=>x.id==='convocation_de_fee');if(spell)spell.utilisation='Sans composante matérielle ; une utilisation gratuite par Repos long ; Concentration facultative avec durée ramenée à une minute.';}
    if(state.level>=15){const spell=always.find(x=>x.id==='foulee_brumeuse');if(spell)spell.utilisation='SAG (minimum une) utilisations gratuites par Repos long ; passager consentant à 1,50 m possible à chaque incantation.';}
    resources.push({nom:'Frappes redoutables',valeur:state.level>=11?'1d6 psychiques':'1d4 psychiques',details:'Sur un toucher d’arme ; chaque cible peut subir ce supplément une fois par tour.'});
    if(state.level>=15)resources.push({nom:'Vagabond brumeux',ability:'SAG',kind:'quota',minimum:1,details:'Foulée brumeuse gratuite par Repos long ; peut emmener une créature consentante visible à 1,50 m de vous.'});
  }
  if(sub?.id==='rodeur_traqueur_tenebres')resources.push({nom:'Frappe redoutable',ability:'SAG',kind:'quota',minimum:1,details:'Repos long ; une fois par tour, toucher avec une arme : '+(state.level>=11?'2d8':'2d6')+' psychiques. Vitesse +3 m au premier tour seulement ; SAG à l’initiative.'});
  if(sub?.id==='rodeur_chasseur'&&state.level>=11)resources.push({nom:'Proie supérieure du chasseur',valeur:state.level>=20?'1d10':'1d6',details:'Dégâts de Marque du chasseur à une autre créature visible à 9 m de la cible marquée, une fois par tour lorsque vous blessez celle-ci.'});
  if(sub?.id==='barde_college_seduction'){
    resources.push({nom:'Manteau d’inspiration',ability:'CHA',kind:'targets',minimum:1,details:'Autres créatures à 18 m ; une Inspiration en action Bonus. PV temporaires : deux fois le dé d’Inspiration lancé, puis déplacement possible par réaction sans attaque d’opportunité.'},{nom:'Magie envoûtante',valeur:1,details:'Repos long, ou une Inspiration dépensée sans action. Après Enchantement/Illusion avec emplacement : cible visible à 18 m, JS SAG contre votre DD des sorts, Charmé ou Effrayé une minute.'});
    if(state.level>=6)resources.push({nom:'Manteau de majesté',valeur:1,details:'Repos long, ou un emplacement 3+ pour récupérer l’utilisation. Action Bonus : Injonction gratuite, puis à chaque tour pendant une minute avec Concentration.'});
    if(state.level>=14)resources.push({nom:'Majesté inébranlable',valeur:1,details:'Repos court ou long ; action Bonus, une minute. Première attaque qui vous touche à chaque tour : JS CHA de l’attaquant contre votre DD des sorts ; échec, elle rate.'});
  }
  if(sub?.id==='barbare_berserker'){
    resources.push({nom:'Frénésie',valeur:rageDamage+'d6',details:'Rage + Attaque téméraire ; première cible touchée à votre tour par une attaque FOR. Même type de dégâts que l’attaque.'});
    if(state.level>=14)resources.push({nom:'DD de Présence intimidante',ability:'FOR',kind:'dc',details:'JS SAG ; action Bonus, émanation 9 m, une minute. Un Repos long, ou une Rage dépensée sans action pour récupérer l’utilisation.'});
  }
  if(sub?.id==='barbare_voie_arbre_monde'){
    resources.push({nom:'Vitalité de l’Arbre',valeur:state.level+' PV temporaires',details:'Pour vous à l’activation de Rage ; au début du tour, une autre créature à 3 m reçoit '+rageDamage+'d6 PV temporaires, expirant à la fin de la Rage.'});
    if(state.level>=6)resources.push({nom:'DD des Branches de l’Arbre',ability:'FOR',kind:'dc',details:'Réaction pendant la Rage, créature visible à 9 m qui commence son tour ; JS FOR, téléportation près de vous, vitesse 0 possible jusqu’à la fin du tour.'});
  }
  if(sub?.id==='barbare_voie_zelateur'){
    resources.push({nom:'Fureur divine',valeur:'1d6 + '+Math.floor(state.level/2),details:'Rage : première créature touchée à votre tour avec arme ou mains nues. Radiant ou nécrotique choisi chaque fois.'},{nom:'Guerrier des dieux',valeur:(4+[6,12,17].filter(n=>n<=state.level).length)+'d12',details:'Réserve de soins personnels, récupérée au Repos long. Action Bonus pour dépenser et lancer des dés explicitement.'});
    if(state.level>=6)resources.push({nom:'Ferveur fanatique',valeur:'+'+rageDamage,details:'Bonus à la relance d’un JS raté une fois par Rage active ; nouveau résultat obligatoire.'});
  }
  if(sub?.id==='druide_cercle_lune'){
    resources.push({nom:'Formes lunaires',ability:'SAG',kind:'formula',base:13,details:'CA sous Forme animale si supérieure à celle de la Bête ; FP maximal '+Math.floor(state.level/3)+'. PV et dés de vie du personnage conservés.'});
    if(state.level>=6)resources.push({nom:'Formes lunaires améliorées',ability:'SAG',kind:'formula',details:'Bonus aux JS CON sous Forme animale uniquement ; dégâts normaux ou radiants au choix sur chaque attaque qui touche.'});
    if(state.level>=10)resources.push({nom:'Pas de lune',ability:'SAG',kind:'quota',minimum:1,details:'Repos long ; action Bonus, téléportation 9 m et Avantage à la prochaine attaque avant la fin du tour. Un emplacement 2+ restaure une utilisation sans action.'});
    if(state.level>=14)resources.push({nom:'Forme lunaire',valeur:'2d10 radiants',details:'Une fois par tour, attaque de Forme animale réussie. Pas de lune : un passager consentant à 3 m, destination à 3 m de la vôtre.'});
  }
  if(sub?.id==='druide_cercle_mers'){
    resources.push({nom:'Colère des mers',ability:'SAG',kind:'diceCount',minimum:1,die:'d6',details:'Dégâts de froid sur JS CON raté contre votre DD des sorts ; repoussement jusqu’à 4,50 m si taille G ou moins. Une Forme animale, action Bonus, dix minutes ; émanation '+(state.level>=6?'3':'1,50')+' m, cible à l’activation puis par action Bonus.'},{nom:'DD de Colère des mers',ability:'SAG',kind:'dc',details:'8 + maîtrise + SAG.'});
    if(state.level>=10)resources.push({nom:'Enfant de la tempête',valeur:'Pendant Colère uniquement',details:'Vol égal à votre vitesse ; résistances froid, foudre et tonnerre.'});
  }
  if(sub?.id==='druide_cercle_astres'){
    resources.push({nom:'Rayon traçant gratuit',ability:'SAG',kind:'quota',minimum:1,details:'Par Repos long, carte tenue ; utilisations sans emplacement.'},{nom:'Archer stellaire',ability:'SAG',kind:'heal',die:state.level>=10?'2d8':'1d8',details:'Dégâts radiants sur attaque de sort SAG à 18 m, à l’activation puis action Bonus ; une Forme animale pour activer Forme stellaire.'},{nom:'Calice stellaire',ability:'SAG',kind:'heal',die:state.level>=10?'2d8':'1d8',details:'PV pour vous ou une créature à 9 m après un sort de soin utilisant un emplacement, pendant Forme stellaire.'});
    if(state.level>=6)resources.push({nom:'Présage cosmique',ability:'SAG',kind:'quota',minimum:1,details:'Repos long ; réaction avant un test d20 d’une créature visible à 9 m, ±1d6 selon la parité du dé explicitement lancé au Repos long.'});
    if(state.level>=10)resources.push({nom:'Dragon stellaire',valeur:'Vol 6 m',details:'Sustentation pendant la constellation Dragon uniquement ; changement de constellation au début du tour possible.'});
    if(state.level>=14)resources.push({nom:'Corps d’étoiles',valeur:'Pendant Forme stellaire',details:'Résistances contondant, perforant et tranchant.'});
  }
  if(sub?.id==='druide_cercle_terre'){
    const dice=state.level>=14?'4d6':state.level>=10?'3d6':'2d6';
    resources.push({nom:'Aval de la terre',valeur:dice,details:'Dégâts nécrotiques et soins, jets explicites. Une utilisation de Forme animale ; action Magie, point à 18 m, rayon 3 m. JS CON : moitié des dégâts si réussite.'},{nom:'DD d’Aval de la terre',ability:'SAG',kind:'dc',details:'8 + maîtrise + modificateur SAG.'});
    if(state.level>=6)resources.push({nom:'Ressourcement',valeur:Math.ceil(state.level/2)+' niveaux',details:'Récupération à la fin d’un Repos court, une fois par Repos long ; chaque emplacement de niveau 5 maximum. En plus : un sort de cercle de niveau 1 ou plus sans emplacement par Repos long.'});
    if(state.level>=14)resources.push({nom:'Sanctuaire de dame Nature',valeur:'1 Forme animale',details:'Action Magie : Cube 4,50 m au sol à 36 m, une minute. Abri partiel pour vous et vos alliés dans la zone ; résistance du terrain pour les alliés dans la zone. Action Bonus : déplacement au sol de 18 m dans la portée. Fin si Neutralisé ou mort.'});
  }
  return {classId:state.classId,subclass:sub,domain:sub,row,castingAbility,hasMagic:magic.enabled,spellcastingNote:[magic.note,...extraSpells.filter(s=>s.unresolved).map(s=>s.nom+' : entrée BDD non identifiée, à préciser avec le MJ.'),...uniqueAlways.filter(s=>s.niveau>maxRank(row)).map(s=>s.nom+' : niveau réel '+s.niveau+', aucun emplacement disponible actuellement (liste BDD conservée).')].filter(Boolean).join(' '),spellcastingSource:magic.source,cantripCount,preparedCount:row.sorts_prepares||0,
    cantrips:cantripPool.filter(s=>s.niveau===0&&!bonusIds.includes(s.id)),prepared:pool.filter(s=>s.niveau>=1&&s.niveau<=maxRank(row)&&!bonusIds.includes(s.id)),
    slots:row.emplacements_de_sort||{},always:uniqueAlways,automaticCantrips,extraSpells,missingSpells:missing,domainFeatures:features.filter(f=>f.source.startsWith(sub?.nom+' ·')),maxSpellLevel:maxRank(row),proficiency:inheritedValue(state,c,'bonusMaitrise'),
    attacks:Math.max(1,...features.flatMap(f=>(f.effets||[]).filter(e=>e.total_attaques).map(e=>e.total_attaques)),state.classId==='barbare'&&state.level>=5||state.classId==='rodeur'&&state.level>=5||sub?.id==='barde_college_vaillance'&&state.level>=6?2:1),rage,rageDamage,resources};
}
export function classChoiceEffects(state,c){
  const specs=classChoiceSpecs(state,c),sub=subFor(state,c),skills=[],expertise=[],tools=[],languages=[],masteries=picked(state,'weaponMasteries');
  if(state.classId==='barbare'&&state.level>=3)skills.push(...picked(state,'wildSkill'));
  if(['rodeur','barde'].includes(state.classId)){if(state.level>=2)expertise.push(...picked(state,'expertise2'));if(state.level>=9)expertise.push(...picked(state,'expertise9'));}
  if(sub?.id==='barde_college_savoir')skills.push(...picked(state,'loreSkills'));
  if(sub?.id==='rodeur_vagabond_feerique')skills.push(...picked(state,'feySkill'));
  if(sub?.id==='guerrier_maitre_guerre')skills.push(...picked(state,'studentSkill'));
  if(sub?.id==='moine_credo_misericorde'){skills.push('Perspicacité','Médecine');tools.push(c.tools.find(t=>/herboriste/.test(key(t.id)))?.nom||'Nécessaire d’herboriste');}
  if(state.classId==='barde')for(const id of picked(state,'instruments')){const tool=toolOptions(c).find(t=>t.id===id);if(tool)tools.push(tool.name);}
  if(sub?.id==='guerrier_maitre_guerre')for(const id of picked(state,'artisanTool')){const tool=toolOptions(c).find(t=>t.id===id);if(tool)tools.push(tool.name);}
  if(state.classId==='roublard'){expertise.push(...picked(state,'expertise1'));if(state.level>=6)expertise.push(...picked(state,'expertise6'));languages.push('Jargon des voleurs');if(sub?.id==='roublard_assassin')for(const tool of c.tools.filter(t=>/deguisement|empoisonneur/.test(key(t.id))))tools.push(tool.nom);}
  if(state.classId==='magicien'&&state.level>=2)expertise.push(...picked(state,'scholar'));
  if(state.classId==='moine')for(const id of picked(state,'monkTool')){const tool=toolOptions(c).find(t=>t.id===id);if(tool)tools.push(tool.name);}
  const cls=c.classes.find(x=>x.id===state.classId);
  if(Array.isArray(cls?.niveaux?.[0]?.maitrises_outils))for(const id of cls.niveaux[0].maitrises_outils)tools.push(c.tools.find(t=>key(t.id)===key(id)||key(id).includes('herboriste')&&key(t.nom).includes('herboriste'))?.nom||id.replaceAll('_',' '));
  for(const spec of specs.filter(s=>s.kind==='names'&&/Languages$/.test(s.key)))languages.push(...picked(state,spec.key));
  if(state.classId==='druide')languages.push('Druidique');
  const forms=state.classId==='druide'?picked(state,'shapes').map(id=>shapePool(state,c).find(f=>f.slug===id)).filter(Boolean):[];
  const companion=selectedPrimalProfile(state,c);
  const equipmentInstrument=state.classId==='barde'?toolOptions(c).find(t=>t.id===picked(state,'equipmentInstrument')[0])?.name:null;
  return {equipmentInstrument,skills:skills.map(n=>canonical(n,c)),expertise,tools,languages,masteries,forms,companion,
    summaries:specs.map(s=>({nom:s.nom,choices:picked(state,s.key).map(id=>s.options.find(o=>o.id===id)?.nom||id)}))};
}
