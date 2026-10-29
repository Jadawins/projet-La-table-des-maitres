export const ADVANCEMENT_LEVELS=[4,8,12,16,19]; // Legacy cleric-only list; new callers read improvementLevels.
// Compatibility exports for existing cleric saves and callers. Shared mechanics live in progression.mjs.
export {ORIGIN_SLOTS,advancementInitial,improvementLevels,featAbilityOptions,eligibleLevelFeats,evaluateProgression,selectedLevelFeats,inheritedValue as inheritedCleric} from './progression.mjs';
const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function domainBenefits(state,c){
  if(state.classId!=='clerc')return {heavy:false,martial:false,rapier:false,skills:[],light:false};
  return {heavy:state.divineOrder==='Protecteur',martial:state.divineOrder==='Protecteur',rapier:false,skills:[],light:false};
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
