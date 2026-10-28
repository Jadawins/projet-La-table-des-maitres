import {originFixture,fillOrigins,finishChoices} from './origin-fixtures.mjs';
import {improvementLevels,evaluateProgression,advancementInitial,featAbilityOptions} from '../maquette/progression.mjs';
export function featFixture(c,classId,feat){
  const twenty=originFixture(c,classId,20,{speciesId:'orc'},feat.id==='robuste'?'charlatan':'fermier',{scores:{FOR:13,DEX:13,CON:13,INT:13,SAG:13,CHA:13}});
  const level=improvementLevels(twenty,c).find(n=>n>=(feat.prerequis?.niveau||1));
  if(!level)return null;
  const s=originFixture(c,classId,level,{speciesId:'orc'},twenty.backgroundId,{scores:{FOR:13,DEX:13,CON:13,INT:13,SAG:13,CHA:13}});
  const progression=evaluateProgression(s,c,Object.fromEntries(Object.keys(s.scores).map(k=>[k,13])));
  const eligible=progression.rows.find(r=>r.level===level).available.some(f=>f.id===feat.id);
  s.advancements[level]={...advancementInitial(),mode:'feat',featId:feat.id,featAbility:featAbilityOptions(feat)[0]||'',abilities:feat.id==='amelioration_de_caracteristique'?['FOR','DEX']:[]};
  fillOrigins(s,c);finishChoices(s,c);
  return {state:s,eligible,level};
}
