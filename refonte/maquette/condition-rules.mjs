// Technical summaries of the frozen FR SRD 5.2.1, pp. 187–197.
export const CONDITIONS=[
  {id:'prone',name:'À terre',page:187,text:'Déplacement en rampant, ou relever le personnage en dépensant la moitié de sa Vitesse. Désavantage aux attaques ; les attaques contre lui ont l’Avantage à 1,50 m au plus, le Désavantage au-delà.'},
  {id:'grappled',name:'Agrippé',page:187,zeroSpeed:true,text:'Vitesse nulle. Désavantage aux attaques visant quelqu’un d’autre que l’agrippeur. L’agrippeur peut déplacer sa prise selon les règles de Lutte.'},
  {id:'deafened',name:'Assourdi',page:188,text:'Aucun son perçu ; les tests nécessitant l’ouïe échouent automatiquement.'},
  {id:'blinded',name:'Aveuglé',page:189,text:'Aucune vision ; les tests nécessitant la vue échouent automatiquement. Vos attaques ont le Désavantage et les attaques contre vous ont l’Avantage.'},
  {id:'charmed',name:'Charmé',page:190,text:'Vous ne pouvez pas attaquer le charmeur ni le viser avec un effet nuisible infligeant des dégâts. Il a l’Avantage pour ses interactions sociales avec vous.'},
  {id:'frightened',name:'Effrayé',page:191,text:'Désavantage aux attaques et tests de caractéristique lorsque la source de peur est visible. Vous ne pouvez pas vous rapprocher volontairement de cette source.'},
  {id:'poisoned',name:'Empoisonné',page:192,text:'Désavantage aux jets d’attaque et aux tests de caractéristique.'},
  {id:'restrained',name:'Entravé',page:192,zeroSpeed:true,text:'Vitesse nulle. Vos attaques et sauvegardes de Dextérité ont le Désavantage ; les attaques contre vous ont l’Avantage.'},
  {id:'stunned',name:'Étourdi',page:192,implies:['incapacitated'],text:'Neutralisé. Échec automatique aux sauvegardes de Force et Dextérité ; les attaques contre vous ont l’Avantage. Cet état ne fixe pas, à lui seul, votre Vitesse à zéro.'},
  {id:'unconscious',name:'Inconscient',page:194,zeroSpeed:true,implies:['incapacitated','prone'],text:'Neutralisé et À terre, Vitesse nulle, objets tenus lâchés et perte de perception de l’environnement. Échec aux sauvegardes FOR/DEX ; attaques reçues avantagées et touches critiques à 1,50 m au plus. À terre reste après le réveil.'},
  {id:'invisible',name:'Invisible',page:195,text:'Avantage à l’Initiative. Les effets exigeant de vous voir ne vous ciblent normalement pas ; vos attaques ont l’Avantage et celles contre vous le Désavantage, sauf contre une créature qui vous voit.'},
  {id:'incapacitated',name:'Neutralisé',page:196,text:'Ni action, action Bonus ni Réaction. Concentration interrompue, parole impossible et Désavantage à l’Initiative.'},
  {id:'paralyzed',name:'Paralysé',page:196,zeroSpeed:true,implies:['incapacitated'],text:'Neutralisé et Vitesse nulle. Échec aux sauvegardes FOR/DEX ; attaques reçues avantagées et touches critiques si l’assaillant est à 1,50 m au plus.'},
  {id:'petrified',name:'Pétrifié',page:197,zeroSpeed:true,implies:['incapacitated'],text:'Corps et objets non magiques portés transformés en matière inerte ; poids multiplié par dix et vieillissement suspendu. Neutralisé, Vitesse nulle, échec aux sauvegardes FOR/DEX, attaques reçues avantagées. Résistance à tous les dégâts et immunité à l’état Empoisonné.'},
];
const ids=new Set(CONDITIONS.map(c=>c.id));
const fault=message=>{const e=new Error(message);e.status=400;return e;};
const count=n=>Number.isInteger(n)&&n>=0&&n<=3;
export const freshDeathSaves=()=>({successes:0,failures:0,stable:false,dead:false});
export function validateConditionFields(raw){
  const result={};
  if(raw.conditions!==undefined){
    if(!Array.isArray(raw.conditions)||raw.conditions.length>CONDITIONS.length||new Set(raw.conditions).size!==raw.conditions.length||raw.conditions.some(id=>!ids.has(id)))throw fault('La liste des états est invalide.');
    result.conditions=CONDITIONS.filter(c=>raw.conditions.includes(c.id)).map(c=>c.id);
  }
  if(raw.exhaustion!==undefined){if(!Number.isInteger(raw.exhaustion)||raw.exhaustion<0||raw.exhaustion>6)throw fault('L’Épuisement doit être compris entre 0 et 6.');result.exhaustion=raw.exhaustion;}
  if(raw.zeroHpConscious!==undefined){if(typeof raw.zeroHpConscious!=='boolean')throw fault('L’exception à zéro PV est invalide.');result.zeroHpConscious=raw.zeroHpConscious;}
  if(raw.deathSaves!==undefined){
    const d=raw.deathSaves;
    if(!d||Array.isArray(d)||!count(d.successes)||!count(d.failures)||typeof d.stable!=='boolean'||typeof d.dead!=='boolean'||d.stable&&d.dead||d.stable&&(d.successes!==0||d.failures!==0)||d.successes===3||!d.dead&&d.failures===3)throw fault('Le suivi des sauvegardes contre la mort est invalide.');
    result.deathSaves={successes:d.successes,failures:d.failures,stable:d.stable,dead:d.dead};
  }
  return result;
}
export function conditionView(play,currentHp,baseSpeed){
  const death={...freshDeathSaves(),...play?.deathSaves},exhaustion=play?.exhaustion||0;
  death.dead=death.dead||exhaustion===6;
  const life=death.dead?'dead':currentHp===null?'unknown':currentHp>0?'alive':death.stable?'stable':'dying';
  const explicit=play?.conditions||[],effective=new Set(explicit);
  const zeroUnconscious=currentHp===0&&!death.dead&&!play?.zeroHpConscious;
  if(zeroUnconscious)effective.add('unconscious');
  for(const condition of CONDITIONS)if(effective.has(condition.id))for(const implied of condition.implies||[])effective.add(implied);
  const active=CONDITIONS.filter(c=>effective.has(c.id)).map(c=>({...c,implicit:!explicit.includes(c.id)}));
  const speed=Number.isFinite(baseSpeed)?death.dead||active.some(c=>c.zeroSpeed)?0:Math.max(0,baseSpeed-1.5*exhaustion):null;
  return {explicit,active,exhaustion,d20Penalty:2*exhaustion,speed,death,life,zeroUnconscious};
}
export function addDeathFailures(death,amount){
  const next={...death,stable:false};next.failures=Math.min(3,next.failures+amount);if(next.failures===3)next.dead=true;return next;
}
export function resolveDeathRoll(death,die,modifier,exhaustion){
  if(!Number.isInteger(die)||die<1||die>20||!Number.isInteger(modifier)||modifier< -100||modifier>100)throw fault('Saisissez le d20 naturel et un modificateur entier valide.');
  if(die===20)return {death:freshDeathSaves(),revived:true};
  if(die===1)return {death:addDeathFailures(death,2),revived:false};
  if(die+modifier-2*exhaustion<10)return {death:addDeathFailures(death,1),revived:false};
  const next={...death,successes:death.successes+1};
  return {death:next.successes>=3?{...freshDeathSaves(),stable:true}:next,revived:false};
}
export function clearOnPositiveHp(play,maxHp){
  if(Number.isFinite(maxHp)&&maxHp-play.hpLost>0&&!play.deathSaves?.dead&&play.exhaustion!==6){
    if(play.deathSaves)play.deathSaves=freshDeathSaves();
    if(play.zeroHpConscious!==undefined)play.zeroHpConscious=false;
  }
  return play;
}
