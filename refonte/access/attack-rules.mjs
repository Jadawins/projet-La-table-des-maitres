import {randomInt} from 'node:crypto';
const fault=message=>Object.assign(new Error(message),{status:400});
export const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export function parseDamage(expression){
  if(typeof expression!=='string'||expression.length>160)throw fault('Formule de dégâts invalide.');
  const formula=expression.replace(/\s/g,'').toLowerCase();
  const terms=formula.match(/[+-]?[^+-]+/g)||[];
  if(!terms.length||terms.length>12||terms.join('')!==formula)throw fault('Formule de dégâts non prise en charge.');
  const dice=[];let flat=0;
  for(const term of terms){
    const match=term.match(/^\+?(\d*)d(\d+)$/);
    if(match){const count=Number(match[1]||1),sides=Number(match[2]);if(!integer(count,1,100)||!integer(sides,2,100))throw fault('Dés de dégâts hors limites.');dice.push({count,sides});}
    else if(/^[+-]?\d+$/.test(term))flat+=Number(term);
    else throw fault('Cette formule doit être résolue manuellement.');
  }
  if(dice.reduce((n,die)=>n+die.count,0)>100||!integer(flat,-10000,10000))throw fault('Formule de dégâts trop importante.');
  return {formula,dice,flat};
}
export function damagePlan(expression,critical=false){
  const parsed=parseDamage(expression);
  return {...parsed,dice:parsed.dice.map(d=>({...d,count:d.count*(critical?2:1)}))};
}
export function throwDice(sides,mode,physical,randomFace=s=>randomInt(1,s+1)){
  if(!['physical','app'].includes(mode))throw fault('Choisissez les dés physiques ou les dés de l’application.');
  if(mode==='physical'&&(!Array.isArray(physical)||physical.length!==sides.length))throw fault('Renseignez le résultat de chaque dé.');
  if(mode==='app'&&physical!==undefined)throw fault('Les dés de l’application sont lancés sur le serveur.');
  const values=sides.map((side,index)=>mode==='app'?randomFace(side):physical[index]);
  if(values.some((value,index)=>!integer(value,1,sides[index])))throw fault('Un résultat ne correspond pas aux faces de son dé.');
  return values.map((value,index)=>({sides:sides[index],value}));
}
export function attackRoll({mode,advantage='normal',dice,bonus,adjustment=0,penalty=0,criticalFrom=20,ac},randomFace){
  if(!['normal','advantage','disadvantage'].includes(advantage)||!integer(bonus,-100,100)||!integer(adjustment,-100,100)||!integer(penalty,0,100)||!integer(ac,0,100)||![18,19,20].includes(criticalFrom))throw fault('Paramètres du jet d’attaque invalides.');
  const rolls=throwDice(advantage==='normal'?[20]:[20,20],mode,dice,randomFace);
  const kept=advantage==='normal'?0:advantage==='advantage'?(rolls[0].value>=rolls[1].value?0:1):(rolls[0].value<=rolls[1].value?0:1);
  const natural=rolls[kept].value,total=natural+bonus+adjustment-penalty;
  const outcome=natural===1?'miss':natural>=criticalFrom?'critical':total>=ac?'hit':'miss';
  return {mode,advantage,dice:rolls.map((die,index)=>({...die,kept:index===kept})),natural,bonus,adjustment,penalty,total,outcome};
}
export function damageRoll({expression,critical=false,mode,dice,adjustment=0},randomFace){
  if(!integer(adjustment,-10000,10000))throw fault('Ajustement de dégâts invalide.');
  const plan=damagePlan(expression,critical),sides=plan.dice.flatMap(d=>Array(d.count).fill(d.sides));
  const rolled=throwDice(sides,mode,dice,randomFace),diceTotal=rolled.reduce((sum,d)=>sum+d.value,0);
  return {mode,plan,dice:rolled,diceTotal,flat:plan.flat,adjustment,total:Math.max(0,diceTotal+plan.flat+adjustment)};
}
export function adjustedDamage(total,treatment='normal',correction=0){
  if(!integer(total,0,100000)||!integer(correction,-100000,100000)||!['normal','resistance','vulnerability','immunity'].includes(treatment))throw fault('Décision de dégâts invalide.');
  const treated=treatment==='immunity'?0:treatment==='resistance'?Math.floor(total/2):treatment==='vulnerability'?total*2:total;
  const damage=Math.max(0,treated+correction);if(damage>100000)throw fault('Les dégâts dépassent la limite du suivi.');
  return damage;
}
function definition(id,name,bonus,formula,damageType,criticalFrom=20,notes=[]){
  let usable=integer(bonus,-100,100);try{parseDamage(formula);}catch{usable=false;}
  return {id,name,bonus,formula,damageType:damageType||'',criticalFrom,notes:notes.filter(v=>typeof v==='string').slice(0,30),usable};
}
export function participantAttacks(participant,model){
  if(participant.kind==='npc')return (participant.bestiary?.attacks||[]).map((a,index)=>definition('npc:'+index,a.name,a.attackBonus,a.damage,a.damageType,20,a.description?[a.description]:[]));
  const attacks=(model.attacks||[]).flatMap((a,index)=>{
    const variants=[['normal',a.nom,a.degats?.de]];
    if(a.degats?.polyvalente)variants.push(['versatile',a.nom+' · deux mains',a.degats.polyvalente]);
    return variants.map(([key,name,raw])=>{
      let bonus=a.damageBonus??0;
      try{if(!parseDamage(raw).dice.length&&!String(a.nom).startsWith('Mains nues'))bonus=0;}catch{}
      const formula=typeof raw==='string'?raw+(bonus>0?'+'+bonus:bonus<0?String(bonus):''):'';
      return definition('weapon:'+index+':'+key,name,a.attack,formula,a.degats?.type,a.criticalFrom||20,a.featRules||[]);
    });
  });
  if(!attacks.some(a=>/mains nues/i.test(a.name))&&integer(model.mods?.FOR,-100,100)&&integer(model.proficiency,0,20)){
    const mod=model.mods.FOR;attacks.push(definition('unarmed','Mains nues',mod+model.proficiency,'1'+(mod>=0?'+'+mod:mod),'contondants',20,['Dégâts uniquement. Lutte et Bousculade restent décidées à la table.']));
  }
  return attacks;
}
