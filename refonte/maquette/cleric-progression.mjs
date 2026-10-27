const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const ADVANCEMENT_LEVELS=[4,8,12,16,19];
export const ORIGIN_SLOTS=['background','human',...ADVANCEMENT_LEVELS.map(n=>`level${n}`)];
const abilities=['FOR','DEX','CON','INT','SAG','CHA'];
export const advancementInitial=()=>({mode:'',abilities:[],featId:'',featAbility:'',notes:'',choices:{skill:'',expertise:'',damageType:'',rituals:[],resistances:[],spell:''}});
export function improvementLevels(state,c){
  if(state.classId!=='clerc'||state.level>20)return [];
  const cls=c.classes.find(x=>x.id===state.classId);
  return Object.entries(cls?.niveaux||{}).filter(([n,row])=>+n>0&&+n<=state.level&&row.amelioration).map(([n])=>+n);
}
export function featAbilityOptions(feat){
  const effect=feat?.effets?.find(e=>e.type==='caracteristique');if(!effect)return [];
  const explicit=effect.valeur.match(/\b(FOR|DEX|CON|INT|SAG|CHA)\b/g);
  return explicit?[...new Set(explicit)]:/au choix|de votre choix|une ou deux|une caract[eé]ristique/.test(effect.valeur)?abilities:[];
}
export function inheritedCleric(state,c,field,level=state.level){
  const cls=c.classes.find(x=>x.id===state.classId);let value;
  for(let n=1;n<=level;n++)if(cls?.niveaux?.[n]?.[field]!==undefined)value=cls.niveaux[n][field];
  return value;
}
export function domainBenefits(state,c){
  if(state.classId!=='clerc')return {heavy:false,martial:false,rapier:false,skills:[],light:false};
  const domain=c.subclasses.find(s=>s.id===state.subclassId&&s.classe_parente==='clerc'&&state.level>=3);
  const features=Object.entries(domain?.niveaux||{}).filter(([n])=>+n<=state.level).flatMap(([,row])=>row.capacites||[]);
  const text=key(features.map(f=>f.description).join(' '));
  return {
    heavy:state.divineOrder==='Protecteur'||/maitrise.*armureslourdes/.test(text),
    martial:state.divineOrder==='Protecteur'||/maitrise.*armesdeguerre/.test(text),
    rapier:/maitrisedesrapieres/.test(text),
    skills:features.some(f=>key(f.nom)==='maitrisesdelombre')?['Discrétion','Tromperie']:[],
    light:features.some(f=>key(f.nom)==='sortmineurbonus'&&key(f.description).includes('lumiere')),
  };
}
function originFeatIds(state,c){
  const bg=c.backgrounds.find(b=>b.id===state.backgroundId),name=bg?.don?.replace(/\s*\([^)]*\)\s*$/,'');
  const id=c.feats.find(f=>key(f.nom)===key(name))?.id;
  return [id,state.speciesId==='humain'?state.originFeatId:''].filter(Boolean);
}
export function eligibleLevelFeats(state,c,level,scores,taken=[]){
  const training=domainBenefits({...state,level},c);
  return c.feats.filter(f=>{
    const p=f.prerequis||{};if((p.niveau||1)>level||p.classe)return false;
    if(taken.includes(f.id)&&!(f.effets||[]).some(e=>key(e.valeur).includes('repetable')))return false;
    if(f.id==='initie_a_la_magie'&&taken.filter(id=>id===f.id).length>=3)return false;
    const required=p.caracteristique;if(!required)return true;
    if(required==='aptitude Sorts')return state.classId==='clerc';
    const thresholds=[...required.matchAll(/(FOR|DEX|CON|INT|SAG|CHA)\s+(\d+)/g)];
    if(thresholds.length)return thresholds.some(([,a,n])=>Number.isFinite(scores[a])&&scores[a]>=+n);
    if(key(required)==='foroudex')return true;
    if(key(required)==='formationauxarmureslegeres'||key(required)==='formationauxarmuresintermediaires'||key(required)==='formationauxboucliers')return true;
    if(key(required)==='formationauxarmureslourdes')return training.heavy||taken.includes('protection_lourde');
    return false;
  });
}
export function evaluateProgression(state,c,baseScores,through=state.level){
  const scores={...baseScores},rows=[],issues=[],taken=originFeatIds(state,c);
  for(const level of improvementLevels({...state,level:Math.min(through,state.level)},c)){
    const choice={...advancementInitial(),...state.advancements?.[level]};
    const improvement=c.classes.find(x=>x.id==='clerc').niveaux[level].amelioration;
    const available=eligibleLevelFeats(state,c,level,scores,taken),errors=[];
    const feat=choice.mode==='feat'?available.find(f=>f.id===choice.featId):null;
    let increments=[];
    if(choice.mode==='ability'&&improvement.type!=='don'){
      const spec=c.classes.find(x=>x.id==='clerc').niveaux[level].amelioration.choix.caracteristique;
      if(choice.abilities.length!==spec.nombre||new Set(choice.abilities).size!==spec.nombre||choice.abilities.some(a=>!spec.liste.includes(a)))errors.push(`Niveau ${level} : répartissez les ${spec.nombre} augmentations distinctes de caractéristiques prévues par votre BDD.`);
      else increments=choice.abilities;
    }else if(choice.mode==='feat'){
      if(!feat)errors.push(`Niveau ${level} : choisissez un don éligible à ce palier.`);
      else{
        taken.push(feat.id);
        if(feat.id==='amelioration_de_caracteristique'){
          if(choice.abilities.length!==2||choice.abilities.some(a=>!abilities.includes(a)))errors.push(`Niveau ${level} : répartissez les deux points du don.`);
          else increments=choice.abilities;
        }else if(featAbilityOptions(feat).length){
          if(!featAbilityOptions(feat).includes(choice.featAbility))errors.push(`Niveau ${level} : choisissez la caractéristique augmentée par le don.`);
          else increments=[choice.featAbility];
        }
      }
    }else errors.push(`Niveau ${level} : choisissez une amélioration de caractéristiques ou un don.`);
    for(const ability of new Set(increments)){
      const amount=increments.filter(a=>a===ability).length;
      if(scores[ability]===null||scores[ability]===undefined)errors.push(`Niveau ${level} : renseignez d’abord vos caractéristiques.`);
      else {const cap=Number(feat?.effets?.find(e=>e.type==='caracteristique')?.valeur.match(/max\s*(\d+)/i)?.[1])||20;if(scores[ability]+amount>cap)errors.push(`Niveau ${level} : ${ability} dépasserait ${cap}.`);}
    }
    if(!errors.length)for(const a of increments)scores[a]++;
    issues.push(...errors);rows.push({level,choice,feat,available,scores:{...scores},errors});
  }
  return {scores,rows,issues};
}
export function selectedLevelFeats(state,c){
  return improvementLevels(state,c).flatMap(level=>{
    const choice=state.advancements?.[level];const feat=choice?.mode==='feat'?c.feats.find(f=>f.id===choice.featId):null;
    return feat?[{level,feat,choice}]:[];
  });
}
export function sacredChoices(state,c){
  if(state.classId!=='clerc'||state.level<7||state.level>20)return [];
  const cls=c.classes.find(x=>x.id==='clerc'),options=structuredClone(cls?.niveaux?.[7]?.capacites?.find(f=>key(f.nom)==='frappeconsacree')?.options||[]);
  if(state.level>=14){const improvements=cls?.niveaux?.[14]?.capacites?.find(f=>key(f.nom)==='frappeconsacreeamelioree')?.effets||[];
    for(const option of options)for(const improvement of improvements.filter(e=>key(e.cible)===key(option.nom))){
      if(improvement.nouveau_des)for(const effect of option.effets||[])if(effect.des){option.description=option.description.replace(effect.des,improvement.nouveau_des);effect.des=improvement.nouveau_des;}
      if(improvement.effet_supplementaire){option.effets.push(structuredClone(improvement.effet_supplementaire));option.description+=' Après les dégâts, accorde aussi des PV temporaires égaux au double du modificateur de SAG à soi ou une créature à 18 m.';}
    }
  }
  return options;
}
