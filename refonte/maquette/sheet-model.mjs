import {ABILITIES,normalize,skillKey,mainAbility,modifier,finalScores,classData,classProfile,clericProfile,hitPoints,spellErrors,aptitudeErrors,backgroundBonuses} from './character-rules.mjs';
import {originSkills,originTools,originFeats,originBonuses,selectedVariant,grantedOriginSpells,originErrors,backgroundEquipmentErrors,backgroundKitOptions,backgroundItemName} from './origin-rules.mjs';
import {domainBenefits,selectedLevelFeats,evaluateProgression,sacredChoices} from './cleric-progression.mjs';

import {featEffects,weaponWithFeats,damageKey,epicGrantSpells} from './feat-effects.mjs';

import {classChoiceEffects} from './class-profiles.mjs';
import {classTraining,inheritedValue} from './progression.mjs';
import {primalCompanionSheet} from './beast-companion.mjs';
import {speciesResources} from './species-rules.mjs';
import {wildShapeProfiles} from './wild-shape.mjs';

export function scaledCantripDamage(effect,text,level,explicit=null){
  if(explicit)return explicit;
  const base=String(effect.valeur).match(/^(\d+)d(\d+)$/),thresholdText=String(text||'').match(/aux niveaux ([\d, et]+)/)?.[1];
  if(!base||!thresholdText)return effect.valeur;
  const increment=[...String(text).matchAll(/\+(\d+)d(\d+)/g)].find(([,count,sides])=>sides===base[2]);
  if(!increment)return effect.valeur;
  const count=(thresholdText.match(/\d+/g)||[]).filter(n=>+n<=level).length;
  return `${+base[1]+count*+increment[1]}d${base[2]}`;
}
export const detailFields = {player:'Joueur ou joueuse',pronouns:'Pronoms',age:'Âge',height:'Taille et poids',appearance:'Apparence',alignment:'Alignement',faith:'Divinité / convictions',languages:'Langues supplémentaires',traits:'Traits de personnalité',ideals:'Idéaux',bonds:'Liens',flaws:'Défauts',story:'Histoire et notes'};
export function sheetModel(state,c) {
  const cls=classData(state,c), base=cls?.niveaux?.['0']||{};
  const species=c.species.find(s=>s.id===state.speciesId), background=c.backgrounds.find(b=>b.id===state.backgroundId);
  const scores=finalScores(state,background,c), mods=Object.fromEntries(ABILITIES.map(k=>[k,modifier(scores[k])]));
  const bonuses=originBonuses(state,c), proficiency=bonuses.proficiency, profile=classProfile(state,c);
  const subclass=c.subclasses.find(s=>s.id===state.subclassId&&normalize(s.classe_parente)===normalize(cls?.nom)&&state.level>=3);
  const classFeatures=Object.entries(cls?.niveaux||{}).filter(([n])=>Number(n)>0&&Number(n)<=state.level).flatMap(([n,row])=>(row.capacites||[]).map(f=>({...structuredClone(f),source:`${cls.nom} · niveau ${n}`})));
  for(const feature of classFeatures){
    if(feature.nom==='Canal divin'&&profile){
      feature.utilisations.initial=profile.channel;
      for(const effect of feature.effets_disponibles||[])if(effect.jet?.des&&profile.sparkDice){effect.description=effect.description?.replace(effect.jet.des,profile.sparkDice);effect.jet.des=profile.sparkDice;}
    }
    if(feature.nom==='Frappe consacrée améliorée'){feature.effets=(feature.effets||[]).filter(e=>normalize(e.cible)===normalize(state.sacredStrike));feature.description=state.sacredStrike==='Frappe sacrée'?'Frappe sacrée : dégâts supplémentaires de 2d8, une fois à chacun de vos tours.':state.sacredStrike==='Magie puissante'?`Magie puissante : après les dégâts, ${mods.SAG===null?'—':2*mods.SAG} PV temporaires pour soi ou une créature à 18 m.`:'Choisissez votre option au niveau 7.';}
    if(feature.nom==='Frappe consacrée'&&state.sacredStrike){const selected=sacredChoices(state,c).find(o=>o.nom===state.sacredStrike);if(selected){feature.options=[selected];feature.description=selected.description;}}
  }
  const subclassFeatures=Object.entries(subclass?.niveaux||{}).filter(([n])=>Number(n)<=state.level).flatMap(([n,row])=>(row.capacites||[]).map(f=>({...f,source:`${subclass.nom} · niveau ${n}`})));
  const benefits=domainBenefits(state,c),levelFeats=selectedLevelFeats(state,c),progression=evaluateProgression(state,c,finalScores(state,background));
  const effects=featEffects(state,c,mods,proficiency),classEffects=classChoiceEffects(state,c);
  for(const feature of classFeatures)if(feature.nom==='Rage'&&feature.utilisations)feature.utilisations.initial=profile?.rage;
  if(['guerrier','paladin'].includes(state.classId))for(const feature of classFeatures)if(feature.utilisations){const resource=profile.resources.find(r=>r.nom===feature.nom);if(resource)feature.utilisations.initial=resource.valeur;}
  for(const feature of classFeatures)if(feature.nom==='Forme animale'&&feature.utilisations)feature.utilisations.initial=profile?.resources?.find(r=>r.nom==='Forme animale')?.valeur;
  if(state.classId==='druide'&&state.level>=7)for(const feature of classFeatures)if(feature.nom==='Élan élémentaire'){
    feature.options=(feature.options||[]).filter(o=>o.nom===state.classChoices?.elementalStrike?.[0]);
    if(state.level>=15&&state.classChoices?.elementalStrike?.[0]==='Frappe élémentaire')for(const option of feature.options){option.description='Frappe élémentaire : +2d8 élémentaux, une fois à chacun de vos tours, lors d’une attaque réussie avec une arme ou sous forme de bête.';for(const e of option.effets||[])if(e.des)e.des='2d8';}
  }
  const owned=new Set([...originSkills(state,c),...(state.classSkills||[]),...benefits.skills,...effects.mastered,...classEffects.skills].map(skillKey));
  const skillList=[...c.skills];
  for(const name of [...originSkills(state,c),...(state.classSkills||[])]) if(!skillList.some(s=>skillKey(s.nom)===skillKey(name))) skillList.push({nom:name});
  const choice=classFeatures.flatMap(f=>f.options||[]).find(o=>o.nom===state.divineOrder||o.nom===state.classChoices?.vocationnaturelle?.[0]);
  const skillBonuses=choice?.effets?.filter(e=>e.type==='bonus_test_competence')||[];
  const skills=skillList.map(s=>{
    const ability=mainAbility(s.caracteristique), mod=mods[ability], trained=owned.has(skillKey(s.nom));
    const expertise=trained&&[...effects.expertise,...classEffects.expertise].some(n=>skillKey(n)===skillKey(s.nom));
    let value=mod===null||mod===undefined?null:mod+(trained?proficiency*(expertise?2:1):(state.classId==='barde'&&state.level>=2)?Math.floor(proficiency/2):0);
    for(const effect of skillBonuses) if(effect.competences.some(n=>skillKey(n)===skillKey(s.nom))) {
      const bonus=mods[mainAbility(effect.valeur.replace('modificateur_',''))];
      value=value===null||bonus===null?null:value+Math.max(effect.minimum||0,bonus);
    }
    if(subclass?.id==='rodeur_vagabond_feerique'&&ability==='CHA')value=value===null||mods.SAG===null?null:value+Math.max(1,mods.SAG);
    return {...s,ability,trained,expertise,value};
  }).sort((a,b)=>a.nom.localeCompare(b.nom,'fr'));
  const extraSaves=classFeatures.some(f=>(f.effets||[]).some(e=>e.type==='maitrise_tous_jets_sauvegarde'))?ABILITIES:classFeatures.flatMap(f=>(f.effets||[]).filter(e=>e.type==='maitrise_jets_sauvegarde').flatMap(e=>e.caracteristiques));
  const savingThrows=[...extraSaves,...(base.sauvegardes_maitrise||[]).map(mainAbility),...levelFeats.filter(g=>g.feat.id==='resilient').map(g=>g.choice.featAbility)];
  if(subclass?.id==='rodeur_traqueur_tenebres'&&state.level>=7){
    const already=levelFeats.some(r=>r.level<=7&&r.feat.id==='resilient'&&r.choice.featAbility==='SAG');
    const granted=already?state.classChoices?.ironMind?.[0]:'SAG';if(granted)savingThrows.push(granted);
  }
  const saves=ABILITIES.map(ability=>({ability,trained:savingThrows.includes(ability),value:mods[ability]===null?null:mods[ability]+(savingThrows.includes(ability)?proficiency:0)}));
  const inventory=[], money={pc:0,pa:0,pe:0,po:0,pp:0};
  function addItem(name,quantity,source) {
    const coin=String(name).match(/^(\d+)\s*(pc|pa|pe|po|pp)$/i);
    if(coin){money[coin[2].toLowerCase()]+=Number(coin[1])*quantity;return;}
    if(normalize(name)==='piecesdor'){money.po+=quantity;return;}
    const quantityPrefix=String(name).match(/^(\d+)\s+(.+)$/);if(quantityPrefix){quantity*=+quantityPrefix[1];name=quantityPrefix[2];}
    const weapon=(c.weapons||[]).find(w=>normalize(w.nom)===normalize(name)||normalize(w.nom)===normalize(name).replace(/s$/,''));if(weapon)name=weapon.nom;
    const existing=inventory.find(i=>normalize(i.nom)===normalize(name));
    if(existing){existing.quantity+=quantity;existing.source+=` / ${source}`;}
    else inventory.push({nom:name,quantity,source});
  }
  const styles=(['rodeur','paladin'].includes(state.classId)&&state.level>=2||state.classId==='guerrier')?[...(state.classChoices?.combatStyle||[]),...(subclass?.id==='guerrier_champion'&&state.level>=7?state.classChoices?.combatStyle10||[]:[])]:[];
  const style=styles[0];
  for(const id of styles){const styleFeat=c.feats.find(f=>f.id===id);if(styleFeat)classFeatures.push({...styleFeat,source:'Style de combat'});}
  if(subclass?.id==='guerrier_maitre_guerre')for(const id of state.classChoices?.maneuvers||[]){const m=c.fighterSupplements.maneuvers.find(x=>x.id===id);if(m)classFeatures.push({...m,source:'Manœuvre · complément ciblé'});}
  for(const mastery of classEffects.masteries){const weapon=c.weapons.find(w=>normalize(w.nom)===mastery),rule=c.masteries?.find(b=>normalize(b.nom)===normalize(weapon?.botte));if(weapon&&rule)classFeatures.push({...rule,nom:`Botte · ${weapon.nom} · ${weapon.botte}`,source:'Propriétés martiales'});}
  const equipment=cls?.equipment?.find(e=>e.choix===state.equipment);
  (equipment?.contenu||[]).forEach(name=>addItem(name==='Instrument de musique au choix'?(classEffects.equipmentInstrument||name):name==="Outils d'artisan ou instrument de musique (maîtrise choisie)"?(classEffects.tools.at(-1)||name):name==='Focaliseur druidique (bâton de combat)'||name==='Focaliseur arcanique (bâton de combat)'?'Bâton de combat':name,1,'Classe'));
  if(background&&state.backgroundEquipment==='A')(background.equipement||[]).forEach(item=>addItem(backgroundItemName(state,c,item.nom),item.quantite??1,'Historique'));
  if(background&&state.backgroundEquipment==='B')money.po+=50;
  if(subclass?.id==='roublard_assassin')for(const id of ['accessoires_de_deguisement','materiel_d_empoisonneur']){const tool=c.tools.find(t=>t.id===id);if(tool)addItem(tool.nom,1,'Outils d’assassin');}
  const armor=inventory.map(i=>c.armors.find(a=>normalize(a.nom)===normalize(i.nom))).filter(Boolean);
  const suits=armor.filter(a=>a.classe_armure?.base), shields=armor.filter(a=>a.categorie==='bouclier');
  const armorTraining=[...classTraining(state,c).armors,...(benefits.heavy?['armures_lourdes']:[]),...effects.armors];
  const shieldBonus=armorTraining.includes('boucliers')?(shields[0]?.classe_armure.bonus||0):0;
  const equipmentNotices=[];
  if(shields.length&&!shieldBonus)equipmentNotices.push('Bouclier sans formation : aucun bonus à la CA.');
  for(const suit of suits){const training={armure_legere:'armures_legeres',armure_intermediaire:'armures_intermediaires',armure_lourde:'armures_lourdes'}[suit.categorie];if(!armorTraining.includes(training))equipmentNotices.push(suit.nom+' sans formation : Désavantage aux Tests d20 de FOR/DEX et impossibilité de lancer des sorts.');if(suit.discretion==='desavantage'&&!(effects.mediumStealth&&suit.categorie==='armure_intermediaire'))equipmentNotices.push(suit.nom+' : Désavantage aux tests de Discrétion.');}
  let ac=null,acNote='Équipement à choisir';
  if(equipment) {
    acNote='Sans armure';
    if(!suits.length&&mods.DEX!==null) ac=10+mods.DEX;
    if(suits.length===1){const a=suits[0].classe_armure;ac=a.modificateur_dex&&mods.DEX===null?null:a.base+(a.modificateur_dex?Math.min(mods.DEX,effects.mediumDexCap&&suits[0].categorie==='armure_intermediaire'?effects.mediumDexCap:a.modificateur_dex_max??Infinity):0);acNote=suits[0].nom;}
    if(suits.length>1) acNote='Plusieurs armures : équipement porté à préciser';
    if(shieldBonus&&ac!==null){ac+=shieldBonus;acNote+=` + ${shields[0].nom}`;}
    acNote+=' · équipement de départ porté';
    const natural=classFeatures.flatMap(f=>f.effets||[]).find(e=>e.type==='calcul_ca_personnalise')?.formule;
    if(!suits.length&&natural){const values=natural.modificateurs.map(a=>mods[a]);ac=values.some(v=>v===null)?null:natural.base+values.reduce((a,b)=>a+b,0)+(natural.bouclier_autorise?shieldBonus:0);acNote='Défense sans armure · '+natural.modificateurs.join(' + ')+(shieldBonus&&natural.bouclier_autorise?' + bouclier':'');}
    // Les autres défenses spéciales ne sont pas encore interprétées : ne pas afficher une CA trompeuse.
    if(!natural&&!suits.length&&[...classFeatures,...(species?.traits||[])].some(f=>/defense.*sans.*armure|armure.*naturelle/.test(normalize(f.nom)))){ac=null;acNote='Défense spéciale : voir les aptitudes';}
  }
  if(equipment&&!suits.length&&!shields.length&&subclass?.id==='barde_college_danse'&&mods.CHA!==null&&mods.DEX!==null){ac=10+mods.CHA+mods.DEX;acNote='Défense sans armure · DEX + CHA (Jeu de jambes éblouissant)';}
  if(styles.includes('style_defense')&&suits.length===1&&ac!==null){ac++;acNote+=' · style Défense +1';}
  if(state.classId==='moine'&&equipment&&!suits.length&&!shields.length){ac=mods.DEX===null||mods.SAG===null?null:10+mods.DEX+mods.SAG;acNote='Défense sans armure · DEX + SAG';}
  if(subclass?.id==='ensorceleur_sorcellerie_draconique'&&equipment&&!suits.length&&mods.DEX!==null&&mods.CHA!==null){ac=10+mods.DEX+mods.CHA+shieldBonus;acNote='Vigueur draconique · 10 + DEX + CHA';}
  const weaponTraining=[...classTraining(state,c).weapons,...(benefits.martial?['armes_de_guerre']:[]),...(benefits.rapier?['Rapière']:[]),...effects.weapons];
  const attacks=inventory.flatMap(item=>{
    const source=(c.weapons||[]).find(w=>normalize(w.nom)===normalize(item.nom));if(!source)return [];
    const weapon=weaponWithFeats(source,effects);
    const finesse=weapon.proprietes?.includes('finesse'), ranged=weapon.categorie?.includes('distance');
    const ability=finesse?(mods.DEX!==null&&mods.FOR!==null?(mods.DEX>mods.FOR?'DEX':'FOR'):null):ranged?'DEX':'FOR';
    const mod=mods[ability],trained=weaponTraining.some(t=>{
      if(normalize(t)===normalize(weapon.nom))return true;
      if(t==='armes_lourdes')return weapon.proprietes?.includes('lourde');
      if(t==='armes_courantes')return weapon.categorie.includes('courante');
      if(t==='armes_de_guerre')return weapon.categorie.includes('guerre');
      if(t==='armes_courantes_corps_a_corps')return weapon.categorie==='arme_courante_corps_a_corps';
      if(t==='armes_de_guerre_propriete_legere')return weapon.categorie.includes('guerre')&&weapon.proprietes?.includes('legere');
      if(t==='armes_de_guerre_finesse_ou_legeres')return weapon.categorie.includes('guerre')&&weapon.proprietes?.some(p=>['finesse','legere'].includes(p));
      return false;
    });
    return [{...weapon,ability,trained,criticalFrom:subclass?.id==='guerrier_champion'?(state.level>=15?18:19):20,botteActive:[...classEffects.masteries,...effects.masteries].includes(normalize(weapon.nom)),attack:mod===null||mod===undefined?null:mod+(trained?proficiency:0)+(styles.includes('style_archerie')&&ranged?2:0),damageBonus:mod??null}];
  });
  // Inventory does not identify which hands hold which items. Keep bonuses
  // conditional rather than applying them to every weapon in the backpack.
  for(const attack of attacks){
    const melee=attack.categorie.includes('corps_a_corps');
    if(styles.includes('style_duel')&&melee)attack.featRules.push('Duel : +2 aux dégâts si cette arme est tenue à une main et sans autre arme ; bouclier compatible.');
    if(styles.includes('style_armes_de_lancer')&&attack.proprietes.includes('lancer'))attack.featRules.push('Armes de lancer : +2 aux dégâts lorsque cette arme est lancée avec un jet d’attaque à distance.');
    if(styles.includes('style_armes_a_deux_mains')&&melee&&attack.proprietes.some(p=>['deux_mains','deux mains','polyvalente'].includes(p)))attack.featRules.push('Armes à deux mains : tenue à deux mains, les 1 et 2 aux dés de dégâts de l’attaque peuvent compter comme des 3.');
    if(styles.includes('style_combat_a_deux_armes')&&attack.proprietes.includes('legere'))attack.featRules.push('Combat à deux armes : modificateur de caractéristique ajouté aux dégâts de l’attaque supplémentaire de Légère, sans le compter deux fois.');
    if(effects.has('sauvagerie_martiale'))attack.featRules.push('Sauvagerie martiale : une fois par tour, deux lancers des dés de dégâts de cette arme, résultat au choix.');
  }
  if(state.classId==='guerrier')for(const attack of attacks){if(state.level>=9&&attack.botteActive)attack.featRules.push('Botte tactique : peut remplacer la botte par Poussée, Ralentissement ou Sape pour cette attaque.');if(state.level>=13)attack.featRules.push('Analyse martiale : après un échec, Avantage à la prochaine attaque contre cette créature avant la fin de votre prochain tour.');}
  if(state.classId==='paladin'&&state.level>=11)for(const attack of attacks)if(!attack.categorie.includes('distance'))attack.featRules.push('Attaque sacrée : +1d8 radiant sur une touche de corps à corps.');
  if(state.classId==='moine'&&equipment&&!suits.length&&!shields.length){const die=inheritedValue(state,c,'arts_martiaux_de');for(const attack of attacks){if(attack.trained&&(attack.categorie==='arme_courante_corps_a_corps'||attack.categorie.includes('guerre')&&attack.categorie.includes('corps_a_corps')&&attack.proprietes.includes('legere'))){attack.ability=mods.DEX>mods.FOR?'DEX':'FOR';attack.attack=mods[attack.ability]+proficiency;attack.damageBonus=mods[attack.ability];const normal=String(attack.degats?.de).match(/^(\d+)d(\d+)$/),martial=String(die).match(/^1d(\d+)$/);if(normal&&martial&&(+martial[1]+1)>+normal[1]*(+normal[2]+1))attack.degats={...attack.degats,de:die};attack.featRules.push('Arts martiaux : '+die+' peut remplacer le dé normal de l’arme ; les dégâts affichés conservent le dé le plus favorable en moyenne. Aucun lancer automatique.');}}const ability=mods.DEX>mods.FOR?'DEX':'FOR';attacks.push({nom:'Mains nues',ability,trained:true,attack:mods[ability]===null?null:mods[ability]+proficiency,damageBonus:mods[ability],degats:{de:die,type:'contondants'},proprietes:[],criticalFrom:20,featRules:state.level>=6?['Dégâts de Force possibles, au choix sur chaque attaque.']:[]});}
  if(styles.includes('style_combat_a_mains_nues')||effects.has('bagarreur_de_tavernes')){
    let unarmed=attacks.find(a=>a.nom==='Mains nues');
    const die=styles.includes('style_combat_a_mains_nues')?'1d6':'1d4';
    if(!unarmed){unarmed={nom:'Mains nues',ability:'FOR',trained:true,attack:mods.FOR===null?null:mods.FOR+proficiency,damageBonus:mods.FOR,degats:{de:die,type:'contondants'},proprietes:[],criticalFrom:20,featRules:[]};attacks.push(unarmed);}
    else if(+unarmed.degats.de.slice(2)<+die.slice(2))unarmed.degats={...unarmed.degats,de:die};
    if(styles.includes('style_combat_a_mains_nues'))unarmed.featRules.push('Combat à mains nues : 1d8 au lieu de 1d6 si aucune arme ni bouclier tenu au jet d’attaque ; 1d4 contondants à une créature maintenue Agrippée au début de votre tour.');
    if(effects.has('bagarreur_de_tavernes'))unarmed.featRules.push('Bagarreur de tavernes : relance facultative des 1 aux dés de dégâts, nouveau résultat obligatoire ; une fois à votre tour dans l’action Attaque, une touche peut repousser de 1,50 m.');
  }
  if(state.classId==='roublard'&&subclass?.id==='roublard_ame_aceree'&&state.level>=3){
    const ability=mods.DEX===null||mods.FOR===null?null:mods.DEX>mods.FOR?'DEX':'FOR';
    const value=ability?mods[ability]:null;
    for(const [nom,de]of [['Lame psychique','1d6'],['Seconde lame psychique · action Bonus','1d4']])attacks.push({nom,ability,trained:true,categorie:'arme_courante_corps_a_corps',attack:value===null?null:value+proficiency,damageBonus:value,degats:{de,type:'psychique'},proprietes:['finesse','lancer'],botte:'Ouverture (Vex)',botteActive:true,criticalFrom:20,featRules:['Lancer : 18/36 m ; main libre requise.','Ouverture : avantage à votre prochaine attaque sur cette cible avant la fin de votre prochain tour.']});
  }
  if(state.classId==='moine'&&subclass?.id==='moine_credo_elements'&&state.level>=3){
    for(const attack of attacks.filter(a=>a.nom==='Mains nues'))attack.featRules.push('Pendant l’Harmonisation uniquement : allonge +3 m ; dégâts élémentaires au choix et déplacement sur JS FOR raté.');
  }
  if(subclass?.id==='barde_college_danse'&&equipment&&!suits.length&&!shields.length){
    const ability=mods.DEX>mods.FOR?'DEX':'FOR';
    attacks.push({nom:'Mains nues · Danse',ability,trained:true,attack:mods[ability]===null?null:mods[ability]+proficiency,damageBonus:mods.DEX,degats:{de:inheritedValue(state,c,'de_inspiration'),type:'contondants'},proprietes:[],criticalFrom:20,featRules:['Sans armure ni bouclier ; ce dé de dégâts ne consomme pas d’Inspiration.','Frappe agile possible dans l’action, action Bonus ou réaction dépensant une Inspiration.']});
  }
  if(subclass?.id==='barbare_voie_arbre_monde'&&state.level>=10)for(const attack of attacks)if(attack.proprietes?.some(p=>['lourde','polyvalente'].includes(p)))attack.featRules.push('À votre tour : allonge +3 m ; Poussée ou Renversement en plus d’une autre botte utilisée avec cette arme.');
  const invocations=state.classId==='occultiste'?state.classChoices?.invocations||[]:[];
  const pactWeapon=invocations.includes('blade')?state.classChoices?.pactWeapon?.[0]:null;
  if(pactWeapon){const w=c.weapons.find(w=>normalize(w.nom)===pactWeapon);if(w){let attack=attacks.find(a=>a.nom===w.nom);if(!attack){attack={...structuredClone(w),featRules:[]};attacks.push(attack);}attack.ability=['FOR','DEX','CHA'].filter(a=>a!=='DEX'||w.proprietes.includes('finesse')).sort((a,b)=>(mods[b]??-99)-(mods[a]??-99))[0];attack.trained=true;attack.attack=mods[attack.ability]===null?null:mods[attack.ability]+proficiency;attack.damageBonus=mods[attack.ability];attack.featRules.push('Arme de pacte : focaliseur, dégâts nécrotiques/psychiques/radiants possibles. '+(invocations.includes('devouring')?'Trois':invocations.includes('thirsting')?'Deux':'Une')+' attaque(s) avec cette arme par action Attaquer.');}}
  if(pactWeapon)for(const attack of attacks.filter(a=>normalize(a.nom)===pactWeapon)){if(invocations.includes('smite'))attack.featRules.push('Châtiment occulte : une fois par tour, un emplacement de Pacte pour '+(1+Math.max(...Object.keys(profile?.slots||{}).map(Number)))+'d8 force supplémentaires ; À terre possible si taille TG maximum.');if(invocations.includes('lifedrinker'))attack.featRules.push('Buveuse de vie : +1d6 nécrotique/psychique/radiant, une fois par tour ; dépense facultative d’un dé de vie pour dé + CON PV (minimum 1).');}
  const castingAbility=mainAbility(profile?.castingAbility||base.caracteristique_incantation), castMod=mods[castingAbility];
  const magic=castMod===null||castMod===undefined?{ability:castingAbility,dc:null,attack:null}:{ability:castingAbility,dc:8+proficiency+castMod,attack:proficiency+castMod};
  const spellChoices=[...(state.cantrips||[]),...(state.prepared||[])].map(id=>c.spells.find(s=>s.id===id)).filter(Boolean).map(s=>({...s,source:cls?.nom||'Classe',caracteristique:castingAbility}));
  const spells=[...spellChoices,...(profile?.automaticCantrips||[]).map(s=>({...s,source:subclass?.nom||'Domaine',caracteristique:castingAbility,always:true})),...(profile?.always||[]).map(s=>({...s,source:s.grantSource||subclass?.nom||'Domaine',caracteristique:s.caracteristique||castingAbility,always:true})),...(profile?.extraSpells||[]),...grantedOriginSpells(state,c),...epicGrantSpells(state,c).map(s=>({...s,caracteristique:castingAbility}))].map(s=>{
    const druidSpell=state.classId==='druide'&&(s.source===cls?.nom||['Sorts de terrain','Sorts du Cercle','Carte stellaire'].some(prefix=>s.grantSource?.startsWith(prefix)));
    const full=c.spells.find(x=>x.id===s.id||normalize(x.nom)===normalize(s.nom));
    const ability=mainAbility(s.caracteristique),mod=mods[ability];
    if(state.classId==='rodeur'&&state.level>=20&&s.id==='marque_du_chasseur')s={...s,degats:(s.degats||[]).map(d=>({...d,valeur:'1d10'}))};
    const scaling=s.niveau===0?[...String(s.niveau_superieur||'').matchAll(/(\d+d\d+)\s+au niveau\s+(\d+)/g)].filter(([,dice,level])=>+level<=state.level).at(-1)?.[1]:null;
    let damage=(s.degats||[]).map(d=>`${s.niveau===0?scaledCantripDamage(d,s.niveau_superieur,state.level,scaling):d.valeur} ${d.type}${d.note||d.condition?` (${[d.note,d.condition].filter(Boolean).join(' ; ')})`:''}`).join(' · ');
    const schoolBonus=effects.schools.includes(normalize(s.ecole))?1:0;
    const featRules=effects.elements.filter(e=>(s.degats||[]).some(d=>damageKey(d.type)===damageKey(e.type))).map(e=>`${e.source} : résistance aux dégâts ${e.type} ignorée${e.rerollOnes?' ; les 1 aux dégâts comptent comme des 2':''}.`);
    if(s.id==='coup_au_but'){
      const dice=state.level>=17?3:state.level>=11?2:state.level>=5?1:0;
      damage='Dégâts de l’arme avec votre modificateur d’incantation ('+(mod??'à compléter')+'), type normal ou radiant'+(dice?' + '+dice+'d6 radiants':'');
      featRules.push('Attaque avec l’arme de la composante : caractéristique d’incantation ; bonus de maîtrise seulement si vous maîtrisez cette arme.');
    }
    if(s.id==='crosse_des_druides')featRules.push('Dé du gourdin ou du bâton enchanté à ce niveau : '+(state.level>=17?'2d6':state.level>=11?'1d12':state.level>=5?'1d10':'1d8')+' ; caractéristique d’incantation et type Force au choix pour ses attaques de corps à corps.');
    if(s.id==='decharge_occulte')featRules.push('À ce niveau : '+(state.level>=17?4:state.level>=11?3:state.level>=5?2:1)+' rayon(s), chacun avec son propre jet d’attaque et 1d10 de force.');
    if(s.id==='stabilisation'&&state.level>=5)s={...s,portee:(state.level>=17?36:state.level>=11?18:9)+' m'};
    if(effects.has('incantateur_d_elite')&&s.attaque){
      const range=String(s.portee).match(/^(\d+(?:[.,]\d+)?)\s*m/);
      if(range&&Number(range[1].replace(',','.'))>=3){s={...s,portee:String(s.portee).replace(range[0],(Number(range[1].replace(',','.'))+18)+' m')};featRules.push('Incantateur d’élite : portée augmentée de 18 m, déjà incluse ci-dessus.');}
      featRules.push('Incantateur d’élite : ignore les Abris partiels et importants ; pas de Désavantage dû à un ennemi à 1,50 m.');
    }
    if(effects.has('empoisonneur')&&(s.degats||[]).some(d=>damageKey(d.type)==='poison'))featRules.push('Empoisonneur : vos jets de dégâts de poison ignorent la Résistance au poison.');
    if(s.niveau===0&&state.level>=14&&state.sacredStrike==='Magie puissante'&&s.source===cls?.nom)featRules.push(`Frappe consacrée améliorée : après les dégâts, ${mods.SAG===null?'—':2*mods.SAG} PV temporaires pour soi ou une créature à 18 m.`);
    if(druidSpell&&s.niveau===0&&state.level>=15&&state.classChoices?.elementalStrike?.[0]==='Magie puissante'){const range=String(s.portee).match(/^(\d+(?:[.,]\d+)?)\s*m/);if(range&&Number(range[1].replace(',','.'))>=3){s={...s,portee:String(s.portee).replace(range[0],(Number(range[1].replace(',','.'))+90)+' m')};featRules.push('Élan élémentaire amélioré : portée augmentée de 90 m, déjà incluse ci-dessus.');}}
    if(state.classId==='rodeur'&&s.id==='marque_du_chasseur'){if(state.level>=13)featRules.push('Concentration de chasseur : les dégâts subis ne peuvent pas briser la Concentration sur ce sort ; les autres causes de fin restent applicables.');if(state.level>=17)featRules.push('Frappe précise : Avantage aux attaques contre la cible actuellement marquée.');}
  if(state.classId==='druide'&&s.id==='appel_de_familier'&&s.grantSource==='Familier naturel'){s={...s,composantes:{...s.composantes,M:false}};featRules.push('Familier naturel : action Magie, emplacement ou une Forme animale ; sans composante matérielle, Fée, disparaît à votre prochain Repos long.');}
  if(state.classId==='rodeur'&&state.level>=20&&s.id==='marque_du_chasseur')featRules.push('Prédateur suprême : les dégâts bonus de ce sort passent de 1d6 à 1d10.');
    if(state.classId==='occultiste')for(const id of invocations.filter(i=>i.endsWith(':'+s.id))){if(id.startsWith('agonizing:'))featRules.push('Décharge agonisante : CHA ajouté aux dégâts, soit '+mods.CHA+'.');if(id.startsWith('spear:'))featRules.push('Lance occulte : portée augmentée de '+9*state.level+' m.');if(id.startsWith('repelling:'))featRules.push('Décharge répulsive : cible de taille G ou inférieure repoussée de 3 m maximum.');}
    if(subclass?.id==='ensorceleur_sorcellerie_aberrante'&&state.level>=6&&s.grantSource===subclass.nom&&s.niveau>=1)featRules.push('Sorcellerie psionique : '+s.niveau+' PS au lieu d’un emplacement ; sans composantes V/S, ni M sauf coût chiffré ou consommation.');
    if(subclass?.id==='ensorceleur_sorcellerie_draconique'&&state.level>=6&&(s.degats||[]).some(d=>damageKey(d.type)===damageKey(state.classChoices?.dragonDamage?.[0])))featRules.push('Affinité élémentaire : CHA ('+mods.CHA+') ajouté à un seul jet de dégâts de ce sort.');
    if(subclass?.id==='ensorceleur_sorcellerie_draconique'&&state.level>=18&&s.id==='convocation_de_dragon')featRules.push('Compagnon draconique : sans composante matérielle, une utilisation sans emplacement par Repos long ; option sans Concentration avec durée ramenée à une minute.');
    if(subclass?.id==='clerc_domaine_guerre'&&state.level>=6&&['bouclier_de_la_foi','arme_spirituelle'].includes(s.id))featRules.push('Bénédiction du dieu de la guerre : option avec un Canal divin, sans emplacement ni Concentration, durée une minute ; fin si relancé, Neutralisé ou mort.');
    if(subclass?.id==='roublard_arnaqueur_arcanique'&&s.id==='main_du_mage')featRules.push('Lancer et contrôler en action Bonus ; main Invisible au choix et tests DEX (Escamotage) par son intermédiaire.');
    if(subclass?.id==='magicien_evocateur'){
      if(s.niveau===0&&(s.degats||[]).length)featRules.push('Sort mineur puissant : moitié des dégâts si attaque ratée ou JS réussi, aucun effet supplémentaire.');
      if(normalize(s.ecole)==='evocation'&&state.level>=6)featRules.push('Sculpture : jusqu’à '+(1+s.niveau)+' autres créatures visibles réussissent leur JS et ne subissent aucun dégât si la réussite les réduirait de moitié.');
      if(normalize(s.ecole)==='evocation'&&state.level>=10&&(s.source===cls?.nom||s.grantSource==='Maîtrise arcanique'||s.grantSource==='Sort signature'))featRules.push('Évocation renforcée : INT ('+mods.INT+') ajouté à un seul jet de dégâts de ce sort.');
    }
    if(subclass?.id==='magicien_illusionniste'&&normalize(s.ecole)==='illusion'){
      const range=String(s.portee).match(/^(\d+(?:[.,]\d+)?)\s*m/);
      s={...s,composantes:{...s.composantes,V:false},...(range&&Number(range[1].replace(',','.'))>=3?{portee:String(s.portee).replace(range[0],(Number(range[1].replace(',','.'))+18)+' m')}:{}),...(s.id==='illusion_mineure'?{temps_incantation:'action ou action Bonus'}:{})};
      featRules.push('Illusions améliorées : composante verbale retirée ; portée augmentée de 18 m si portée initiale d’au moins 3 m. Illusion mineure peut produire son et image.');
    }
    if(subclass?.id==='occultiste_protecteur_celeste'&&state.level>=6&&(s.degats||[]).some(d=>['feu','radiant'].includes(damageKey(d.type))))featRules.push('Âme radiante : une fois par tour, CHA ('+mods.CHA+') ajouté aux dégâts de ce sort contre une seule cible.');
    if(subclass?.id==='occultiste_protecteur_grand_ancien'){
      const warlockSpell=s.source===cls?.nom||s.grantSource===subclass.nom||s.grantSource==='Maléfice occulte'||s.grantSource==='Pacte du Grimoire'||s.grantSource?.startsWith('Secret arcanique ')||c.invocations.options.some(i=>i.nom===s.grantSource);
      if(warlockSpell&&(s.degats||[]).length)featRules.push('Sorts psychiques : vous pouvez remplacer le type de dégâts par psychique à l’incantation.');
      if(warlockSpell&&['enchantement','illusion'].includes(normalize(s.ecole))){s={...s,composantes:{...s.composantes,V:false,S:false}};featRules.push('Sorts psychiques : composantes verbales et somatiques facultatives pour ce sort d’Occultiste.');}
      if(state.level>=10&&s.id==='malefice')featRules.push('Maléfice occulte : Désavantage aussi aux sauvegardes de la caractéristique choisie.');
      if(state.level>=14&&s.id==='convocation_d_aberration')featRules.push('Création d’un serviteur : option sans Concentration, durée une minute, PV temporaires = niveau + CHA ; supplément psychique de Maléfice à la première touche par tour contre votre cible maudite.');
    }
    if(state.classId==='occultiste'&&s.grantSource==='Pacte de la Chaîne'&&s.id==='appel_de_familier'){s={...s,temps_incantation:'action Magie'};featRules.push('Pacte de la Chaîne : action Magie sans emplacement ; composantes du sort requises.');}
    if(state.classId==='occultiste'&&s.grantSource==='Vigueur fiélonne')featRules.push('Vigueur fiélonne : les dés de PV temporaires donnent leur maximum sans jet.');
    if(schoolBonus)featRules.push('Affinité ombreuse : +1 au DD et aux attaques de ce sort.');
    return {...full,...s,ability,featRules,dc:Number.isFinite(s.sauvegarde?.dd_fixe)?s.sauvegarde.dd_fixe:mod===null||mod===undefined?null:8+proficiency+mod+schoolBonus,attackBonus:s.attaque==='arme'||mod===null||mod===undefined?null:proficiency+mod+schoolBonus,damageAtLevel:damage,cantripBonus:s.niveau===0&&state.level>=7&&(s.source===cls?.nom||druidSpell)&&(state.classId==='clerc'&&state.sacredStrike==='Magie puissante'||state.classId==='druide'&&state.classChoices?.elementalStrike?.[0]==='Magie puissante')?mods.SAG:null};
  }).sort((a,b)=>(a.niveau??99)-(b.niveau??99)||a.nom.localeCompare(b.nom,'fr'));
  const errors=[...originErrors(state,c),...aptitudeErrors(state,c),...spellErrors(state,c)];
  if(!state.name?.trim())errors.unshift('Donnez un nom au personnage.');
  if(ABILITIES.some(k=>scores[k]===null))errors.push('Caractéristiques à compléter.');
  if(background&&Object.values(backgroundBonuses(state,background)).reduce((a,b)=>a+b,0)!==3)errors.push('Bonus d’historique à répartir.');
  if(!equipment) errors.push('Équipement de classe à choisir.');
  errors.push(...backgroundEquipmentErrors(state,c));
  if(!profile)errors.push('Les choix de classe de ce parcours restent à compléter (parcours détaillés : clerc, barbare, rôdeur, barde, druide et guerrier niveaux 1 à 20).');
  const perception=skills.find(s=>skillKey(s.nom)==='perception');
  const armorSpeedPenalty=suits.some(a=>a.force_min&&scores.FOR!==null&&scores.FOR<a.force_min)?3:0;
  if(armorSpeedPenalty)equipmentNotices.push('Force insuffisante pour l’armure portée : vitesse réduite de 3 m, déjà incluse.');
  const variant=selectedVariant(state,c),speed=species?.vitesse===undefined?null:Math.max(0,species.vitesse+effects.speedBonus+(variant?.vitesse_bonus||0)+(state.classId==='moine'&&!suits.length&&!shields.length?parseFloat(String(inheritedValue(state,c,'deplacement_sans_armure_bonus')||'0').replace(',','.')):0)+(subclass?.id==='paladin_serment_gloire'&&state.level>=7?3:0)+((['barbare','rodeur'].includes(state.classId)&&state.level>=(state.classId==='barbare'?5:6))&&!suits.some(a=>a.categorie==='armure_lourde')?3:0)-armorSpeedPenalty);
  const resistances=[...new Set([...(species?.resistances||[]),...(variant?.resistances||[]),...effects.resistances])];
  if(subclass?.id==='clerc_domaine_guerre'&&state.level>=17)resistances.push('contondant','perforant','tranchant');
  let darkvision=Math.max(effects.darkvision,species?.vision_dans_le_noir||0,variant?.vision_dans_le_noir||0,...(species?.traits||[]).filter(t=>['visiondanslenoir','visiondanslanuit'].includes(normalize(t.nom))).map(t=>Number(t.description.match(/sur (\d+) m/)?.[1])||0));
  if(subclass?.id==='rodeur_traqueur_tenebres')darkvision=darkvision?darkvision+18:18;
  if(subclass?.id==='moine_credo_ombre')darkvision=darkvision?darkvision+18:18;
  if(subclass?.id==='barbare_voie_coeur_sauvage'&&state.level>=6&&state.classChoices?.wildAspect?.[0]==='Chouette')darkvision=darkvision?darkvision+18:18;
  let swim=subclass?.id==='barbare_voie_coeur_sauvage'&&state.level>=6&&state.classChoices?.wildAspect?.[0]==='Saumon'?speed:subclass?.id==='druide_cercle_mers'&&state.level>=6?speed:state.classId==='rodeur'&&state.level>=6?speed:null;
  const immunities=subclass?.id==='druide_cercle_terre'&&state.level>=10?['Empoisonné']:[];

  if(invocations.includes('depths')&&speed!==null)swim=Math.max(swim||0,speed);
  if(invocations.includes('devil'))darkvision=Math.max(darkvision,36);
  if(invocations.includes('witch'))effects.trueSight=Math.max(effects.trueSight||0,9);
  if(subclass?.id==='occultiste_protecteur_celeste'&&state.level>=6)resistances.push('radiant');
  if(subclass?.id==='occultiste_protecteur_fielon'&&state.level>=10)resistances.push(...(state.classChoices?.fiendResistance||[]));
  if(subclass?.id==='occultiste_protecteur_grand_ancien'&&state.level>=10)resistances.push('psychique');
  if(subclass?.id==='occultiste_protecteur_archifee'&&state.level>=10)immunities.push('Charmé');
  if(subclass?.id==='ensorceleur_sorcellerie_draconique'&&state.level>=6)resistances.push(...(state.classChoices?.dragonDamage||[]));
  if(subclass?.id==='ensorceleur_sorcellerie_aberrante'&&state.level>=6)resistances.push('psychique');
  if(subclass?.id==='druide_cercle_terre'&&state.level>=10){const resistance=c.classSupplements?.land2024?.terrains?.[state.classChoices?.terrain?.[0]]?.resistance;if(resistance)resistances.push(resistance);}
  const blindvision=Math.max(effects.blindsight||0,styles.includes('style_combat_en_aveugle')?3:0,state.classId==='rodeur'&&state.level>=18?9:0);
  if(classEffects.companion)classEffects.companion=primalCompanionSheet(state,c,mods,proficiency);
  if(subclass?.id==='guerrier_soldat_psi'&&state.level>=10)resistances.push('psychique');
  if(subclass?.id==='guerrier_maitre_guerre'){const ability=state.classChoices?.maneuverAbility?.[0],mod=mods[ability];profile.resources.push({nom:'DD des manœuvres',valeur:mod===null||mod===undefined?'—':8+proficiency+mod,details:ability||'Caractéristique à choisir'});}
  for(const id of invocations){const rule=c.invocations.options.find(i=>i.id===id.split(':')[0]);if(rule)classFeatures.push({...rule,nom:c.invocations.options.find(i=>i.id===id.split(':')[0]).nom,source:'Manifestation occulte · complément ciblé'});}
  if(state.classId==='ensorceleur')for(const id of state.classChoices?.metamagic||[]){const rule=c.remainingSupplements.metamagic.find(i=>i.id===id);if(rule)classFeatures.push({...rule,source:'Altération magique · complément ciblé'});}
  if(state.classId==='roublard'&&state.level>=5)for(const option of c.remainingSupplements.rogueStrikes.filter(o=>state.level>=o.level))classFeatures.push({...option,source:'Frappe opportuniste · complément ciblé'});
  classEffects.familiar=invocations.includes('chain')?[...c.shapeForms,...c.familiars].find(f=>f.slug===state.classChoices?.familiar?.[0]):null;
  if(classEffects.familiar){
    const familiar=classEffects.familiar;
    classEffects.familiar={...structuredClone(familiar),...(familiar.type==='Beast'?{type:['Celestial','Fey','Fiend'].includes(state.classChoices?.familiarNature?.[0])?state.classChoices.familiarNature[0]:'Nature à choisir'}:{}),regles_familier:'Appel de familier : agit indépendamment et obéit, normalement sans attaquer. Pacte de la Chaîne : peut attaquer par sa Réaction lorsque vous renoncez à une attaque de votre action Attaque. À 0 PV, disparaît. Télépathie et transmission d’un sort de contact à 30 m, selon le sort.'};
  }
  classEffects.forms=wildShapeProfiles(state,classEffects.forms,{scores,mods,hp:hitPoints(state,c),skills,saves,effects,immunities,languages:[...(species?.langues||[]),...(background?.langues||[]),...classEffects.languages,state.details?.languages],landResistance:subclass?.id==='druide_cercle_terre'&&state.level>=10?c.classSupplements?.land2024?.terrains?.[state.classChoices?.terrain?.[0]]?.resistance:null,initiativeBonus:bonuses.initiative});
  const classResources=(profile?.resources||[]).map(r=>({...r,valeur:r.ability?r.kind==='dc'?(Number.isFinite(mods[r.ability])?8+proficiency+mods[r.ability]:'À compléter'):r.kind==='formula'?Math.max(r.minimum??-Infinity,(r.base||0)+(mods[r.ability]??0)):r.kind==='distance'?Math.max(r.minimum||0,mods[r.ability]??0)+' mile(s)':r.kind==='targets'?Math.max(r.minimum||0,mods[r.ability]??0)+' créatures':r.kind==='quota'?Math.max(r.minimum||0,mods[r.ability]??0)+' utilisations':r.kind==='diceCount'?Math.max(r.minimum||0,mods[r.ability]??0)+r.die:r.kind==='heal'?r.die+' + '+(mods[r.ability]??0):r.kind==='aura'?'+'+Math.max(r.minimum||0,mods[r.ability]??0):`${Math.max(r.minimum||0,mods[r.ability]??0)} utilisations · ${r.die}`:r.valeur}));
  if(effects.has('chanceux'))classResources.push({nom:'Points de chance',valeur:proficiency,details:'Tous récupérés au Repos long ; dépenses explicites, aucun jet automatique.'});
  if(effects.has('faveur_de_recuperation'))classResources.push({nom:'Faveur de récupération',valeur:'10d10 + Dernier recours',details:'Réserve de soins en action Bonus ; retour à 1 PV puis moitié du maximum une fois. Récupération au Repos long.'});
  if(effects.has('magie_rituelle'))classResources.push({nom:'Rituel rapide',valeur:'1 utilisation',details:'Par Repos long ; temps normal et sans emplacement pour un sort Rituel préparé.'});
  if(effects.has('tueur_de_mages'))classResources.push({nom:'Esprit protégé',valeur:'1 utilisation',details:'Transforme un échec de JS INT/SAG/CHA en réussite ; récupérée au Repos court ou long.'});
  if(subclass?.id==='rodeur_vagabond_feerique')classResources.push({nom:'Charme d’outremonde',valeur:mods.SAG===null?'À compléter':'+'+Math.max(1,mods.SAG),details:'Bonus à tous les tests de Charisme ; déjà inclus dans les compétences de Charisme de la fiche.'});
  if(state.classId==='moine'&&subclass?.id==='moine_credo_elements'&&state.level>=11)classResources.push({nom:'Foulée des éléments',valeur:speed+' m',details:'Vol et nage pendant l’Harmonisation uniquement ; aucune vitesse permanente supplémentaire.'});
  return {speciesResources:speciesResources(state,c,mods,proficiency,speed),ruleNotices:[...equipmentNotices,profile?.spellcastingNote,...grantedOriginSpells(state,c).filter(s=>s.unresolved).map(s=>`Espèce : fiche de sort à relier — ${s.nom}.`)].filter(Boolean).join(' '),swim,blindvision,immunities,classEffects,classResources,attacksPerAction:profile?.attacks||1,effects,speed,darkvision,climb:effects.climb||subclass?.id==='roublard_voleur'||subclass?.id==='barbare_voie_coeur_sauvage'&&state.level>=6&&state.classChoices?.wildAspect?.[0]==='Panthère'||state.classId==='rodeur'&&state.level>=6?speed:null,resistances:[...new Set(resistances.filter(r=>!r.startsWith('variable_')).map(r=>({necrotique:'nécrotique',radiance:'radiant'}[damageKey(r)]||damageKey(r))))],cls,species,background,subclass,variant:selectedVariant(state,c),scores,mods,proficiency,skills,saves,inventory,money,attacks,ac,acNote,magic,spells,slots:profile?.slots||{},hp:hitPoints(state,c),initiative:mods.DEX===null||subclass?.id==='rodeur_traqueur_tenebres'&&mods.SAG===null?null:mods.DEX+bonuses.initiative+(subclass?.id==='rodeur_traqueur_tenebres'?mods.SAG:0),passive:perception?.value===null||perception?.value===undefined?null:10+perception.value,classFeatures,subclassFeatures,feats:originFeats(state,c),tools:[...new Set([...originTools(state,c),...effects.tools,...classEffects.tools])],errors:[...new Set(errors)],base,weaponTraining,armorTraining,progression,levelFeats,channel:profile?.channel,sparkDice:profile?.sparkDice,sacredStrike:state.classId==='clerc'&&state.level>=7?state.sacredStrike:''};
}
