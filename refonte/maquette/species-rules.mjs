const signed=n=>n>=0?'+'+n:String(n);

export function speciesResources(state,c,mods,pb,speed){
  const resources=[];
  const dc=ability=>Number.isFinite(mods[ability])?8+pb+mods[ability]:'à compléter';
  if(state.speciesId==='aasimar'){
    resources.push({nom:'Mains guérisseuses',valeur:pb+'d4 PV',details:'Action Magie au contact ; une utilisation par Repos long. Jet explicite, jamais automatique.'});
    if(state.level>=3)resources.push({nom:'Révélation céleste',valeur:1,details:`Par Repos long, action Bonus, une minute. Dégâts supplémentaires ${pb} une fois à votre tour ; Linceul : DD CHA ${dc('CHA')}. Ailes : vol ${speed} m pendant la transformation.`});
  }
  if(state.speciesId==='drakeide'){
    const variant=c.species.find(s=>s.id==='drakeide')?.variantes?.find(v=>v.id===state.variantId);
    const dice=1+[5,11,17].filter(n=>n<=state.level).length;
    resources.push({nom:'Souffle',valeur:`${dice}d10 ${variant?.type_degats||'type à choisir'}`,details:`${pb} utilisations par Repos long. Remplace une attaque ; JS DEX, DD ${dc('CON')}, moitié si réussite. Choix à chaque usage : cône 4,50 m ou ligne 9 m sur 1,50 m.`});
    if(state.level>=5)resources.push({nom:'Vol draconique',valeur:speed+' m',details:'Action Bonus, dix minutes ; une utilisation par Repos long. Fin si Neutralisé ou rétraction sans action.'});
  }
  if(state.speciesId==='goliath'){
    const ancestry=c.originCorrections?.goliathAncestries.find(a=>a.id===state.speciesAncestry);
    if(ancestry)resources.push({nom:ancestry.nom,valeur:pb+' utilisations',details:'Par Repos long. '+ancestry.description.replace('1d12 + CON',Number.isFinite(mods.CON)?'1d12 '+signed(mods.CON):'1d12 + CON à compléter')});
    if(state.level>=5)resources.push({nom:'Forme de géant',valeur:1,details:`Par Repos long, action Bonus si l’espace le permet ; taille G dix minutes, vitesse ${speed+3} m et Avantage aux tests de Force pendant la transformation uniquement.`});
  }
  if(state.speciesId==='nain')resources.push({nom:'Connaissance de la pierre',valeur:pb+' utilisations',details:'Par Repos long, action Bonus : vibrations à 18 m dix minutes, sur pierre ou à son contact.'});
  if(state.speciesId==='orc')resources.push({nom:'Poussée d’adrénaline',valeur:pb+' utilisations',details:`Repos court ou long. Action Bonus : Foncer et gagner ${pb} PV temporaires.`});
  return resources;
}
