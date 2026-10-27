const fs=require('fs');const root='refonte/';const edit=(p,a,b)=>{let s=fs.readFileSync(root+p,'utf8');if(!s.includes(a))throw Error(p+' missing '+a.slice(0,70));fs.writeFileSync(root+p,s.replace(a,b));};
edit('maquette/cleric-progression.mjs',"return c.classes.find(x=>x.id==='clerc')?.niveaux?.[7]?.capacites?.find(f=>key(f.nom)==='frappeconsacree')?.options||[];",`const cls=c.classes.find(x=>x.id==='clerc'),options=structuredClone(cls?.niveaux?.[7]?.capacites?.find(f=>key(f.nom)==='frappeconsacree')?.options||[]);
  if(state.level>=14){const improvements=cls?.niveaux?.[14]?.capacites?.find(f=>key(f.nom)==='frappeconsacreeamelioree')?.effets||[];
    for(const option of options)for(const improvement of improvements.filter(e=>key(e.cible)===key(option.nom))){
      if(improvement.nouveau_des)for(const effect of option.effets||[])if(effect.des){option.description=option.description.replace(effect.des,improvement.nouveau_des);effect.des=improvement.nouveau_des;}
      if(improvement.effet_supplementaire){option.effets.push(structuredClone(improvement.effet_supplementaire));option.description+=' Après les dégâts, accorde aussi des PV temporaires égaux au double du modificateur de SAG à soi ou une créature à 18 m.';}
    }
  }
  return options;`);
edit('maquette/sheet-model.mjs',"domainBenefits,selectedLevelFeats,evaluateProgression", "domainBenefits,selectedLevelFeats,evaluateProgression,sacredChoices");
edit('maquette/sheet-model.mjs',"featEffects,weaponWithFeats,damageKey", "featEffects,weaponWithFeats,damageKey,epicGrantSpells");
edit('maquette/sheet-model.mjs',"const selected=feature.options?.find(o=>o.nom===state.sacredStrike)", "const selected=sacredChoices(state,c).find(o=>o.nom===state.sacredStrike)");
edit('maquette/sheet-model.mjs',"if(feature.nom==='Frappe consacrée'", "if(feature.nom==='Frappe consacrée améliorée'){feature.effets=(feature.effets||[]).filter(e=>normalize(e.cible)===normalize(state.sacredStrike));feature.description=state.sacredStrike==='Frappe sacrée'?'Frappe sacrée : dégâts supplémentaires de 2d8, une fois par tour.':state.sacredStrike==='Magie puissante'?`Magie puissante : après les dégâts, ${mods.SAG===null?'—':2*mods.SAG} PV temporaires pour soi ou une créature à 18 m.`:'Choisissez votre option au niveau 7.';}\n    if(feature.nom==='Frappe consacrée'");
edit('maquette/sheet-model.mjs',"...grantedOriginSpells(state,c)].map", "...grantedOriginSpells(state,c),...epicGrantSpells(state,c).map(s=>({...s,caracteristique:castingAbility}))].map");
edit('maquette/sheet-model.mjs',"const damage=(s.degats||[]).map(d=>`${scaling||d.valeur} ${d.type}`).join(' · ');", "const damage=(s.degats||[]).map(d=>`${s.niveau===0?scaledCantripDamage(d,s.niveau_superieur,state.level,scaling):d.valeur} ${d.type}${d.note?` (${d.note})`:''}`).join(' · ');");
edit('maquette/sheet-model.mjs',"if(schoolBonus)featRules.push", "if(s.niveau===0&&state.level>=14&&state.sacredStrike==='Magie puissante'&&s.source===cls?.nom)featRules.push(`Frappe consacrée améliorée : après les dégâts, ${mods.SAG===null?'—':2*mods.SAG} PV temporaires pour soi ou une créature à 18 m.`);\n    if(schoolBonus)featRules.push");
edit('maquette/sheet-model.mjs',"export const detailFields", `export function scaledCantripDamage(effect,text,level,explicit=null){
  if(explicit)return explicit;
  const base=String(effect.valeur).match(/^(\\d+)d(\\d+)$/),thresholdText=String(text||'').match(/aux niveaux ([\\d, et]+)/)?.[1];
  if(!base||!thresholdText)return effect.valeur;
  const increment=[...String(text).matchAll(/\\+(\\d+)d(\\d+)/g)].find(([,count,sides])=>sides===base[2]);
  if(!increment)return effect.valeur;
  const count=(thresholdText.match(/\\d+/g)||[]).filter(n=>+n<=level).length;
  return \`\${+base[1]+count*+increment[1]}d\${base[2]}\`;
}
export const detailFields`);
edit('maquette/sheet-view.mjs',"${f.choices.skill,f.choices.expertise", "${f.choices.skill,f.choices.expertise");
