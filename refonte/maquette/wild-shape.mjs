import {modifier,skillKey} from './character-rules.mjs';

const unique=values=>[...new Set(values.filter(Boolean))];

// A known form is a reference, not an active transformation. These profiles
// describe the conditional result without changing the character or rolling dice.
export function wildShapeProfiles(state,forms,{scores,mods,hp,skills,saves,effects,immunities,languages,landResistance,initiativeBonus}){
  if(state.classId!=='druide'||state.level<2)return [];
  const moon=state.level>=3&&state.subclassId==='druide_cercle_lune';
  return forms.map(beast=>{
    const physical=Object.fromEntries(['FOR','DEX','CON'].map(a=>[a,beast.caracteristiques[a]]));
    const abilities={...physical,...Object.fromEntries(['INT','SAG','CHA'].map(a=>[a,scores[a]]))};
    const formMods=Object.fromEntries(Object.entries(abilities).map(([a,value])=>[a,modifier(value)]));
    const checks={};
    for(const skill of skills){
      const own=skill.value===null||formMods[skill.ability]===null||mods[skill.ability]===null?null:skill.value+formMods[skill.ability]-mods[skill.ability];
      const base=Object.entries(beast.competences||{}).find(([name])=>skillKey(name)===skillKey(skill.nom))?.[1];
      checks[skill.nom]=own===null?null:Math.max(own,base??-Infinity);
    }
    const savingThrows={};
    for(const save of saves){
      const own=save.value===null||formMods[save.ability]===null||mods[save.ability]===null?null:save.value+formMods[save.ability]-mods[save.ability];
      const base=beast.jets_sauvegarde?.[save.ability];
      savingThrows[save.ability]=own===null?null:Math.max(own,base??-Infinity)+(moon&&state.level>=6&&save.ability==='CON'?(mods.SAG??0):0);
    }
    const speed=structuredClone(beast.vitesse);
    if(speed.marche!==null)speed.marche+=effects.speedBonus||0;
    const senses=structuredClone(beast.sens);
    senses.vision_dans_le_noir=Math.max(senses.vision_dans_le_noir||0,effects.darkvision||0)||null;
    const perception=skills.find(s=>skillKey(s.nom)==='perception');
    senses.perception_passive=perception&&checks[perception.nom]!==null?10+checks[perception.nom]:null;
    const notes=[
      'Profil utilisable pendant la transformation uniquement ; les valeurs de votre fiche principale restent inchangées.',
      'Vos PV, dés de vie, type, INT/SAG/CHA, aptitudes de classe, langues et dons sont conservés. Parole et concentration maintenues.',
      'Au moment de vous transformer, choisissez équipement au sol, fusionné sans effet ou porté si adapté avec le MJ. La CA indiquée n’ajoute pas d’armure ou de bouclier porté.',
      state.level>=18?'Incantation animale : sorts possibles sauf composante matérielle payante ou consommée.':moon?'Seuls les sorts accordés par Sorts du Cercle de la Lune peuvent être lancés sous cette forme.':'Pas d’incantation sous cette forme ; vos sorts déjà actifs sont maintenus.'
    ];
    if(state.level>=7&&state.classChoices?.elementalStrike?.[0]==='Frappe élémentaire')notes.push('Élan élémentaire : +'+(state.level>=15?'2d8':'1d8')+' feu, foudre, froid ou tonnerre, une fois à votre tour sur attaque de Bête réussie.');
    if(moon&&state.level>=6)notes.push('Chaque attaque peut infliger ses dégâts normaux ou radiants au choix quand elle touche ; SAG ajouté aux JS CON ci-dessus.');
    if(moon&&state.level>=14)notes.push('Forme lunaire : +2d10 radiants une fois par tour sur attaque de Bête réussie.');
    return {
      slug:beast.slug,nom:beast.nom,fp:beast.fp,initiative:beast.reference2024.initiative+(initiativeBonus||0),taille:beast.taille,type:'Humanoïde',ca:moon&&mods.SAG!==null?Math.max(beast.ca,13+mods.SAG):moon?null:beast.ca,
      pv:hp,pv_temporaires:state.level*(moon?3:1),des_de_vie:state.level+'d8',vitesse:speed,caracteristiques:abilities,
      jets_sauvegarde:savingThrows,competences:checks,sens:senses,
      resistances:unique([...(beast.resistances||[]),...(effects.resistances||[]),landResistance]),
      immunites_degats:beast.immunites_degats||[],immunites_etats:unique([...(beast.immunites_etats||[]),...immunities]),
      vulnerabilites:beast.vulnerabilites||[],langues:unique(languages),
      traits:structuredClone(beast.traits||[]),actions:structuredClone(beast.actions||[]),actions_bonus:structuredClone(beast.actions_bonus||[]),reactions:structuredClone(beast.reactions||[]),
      notes,reference:beast.reference2024.url
    };
  });
}
