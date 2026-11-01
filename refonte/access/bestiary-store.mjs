import {createHash} from 'node:crypto';
const fault=(status,message)=>Object.assign(new Error(message),{status});
const fold=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const str=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const number=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max?value:null;
const integer=(value,min,max)=>Number.isInteger(value)?number(value,min,max):null;
const list=value=>Array.isArray(value)?value.filter(v=>typeof v==='string').slice(0,50).map(v=>str(v,200)):[];
const typeNames={aberration:'Aberration',beast:'Bête',celestial:'Céleste',construct:'Artificiel',dragon:'Dragon',elemental:'Élémentaire',fey:'Fée',fiend:'Fiélon',giant:'Géant',humanoid:'Humanoïde',monstrosity:'Monstruosité',ooze:'Vase',plant:'Plante',undead:'Mort-vivant'};
export function bestiaryCR(value){
  if(typeof value==='number')return number(value,0,100);
  if(typeof value!=='string')return null;
  const text=value.trim();
  if(/^\d+(?:\.\d+)?$/.test(text))return number(Number(text),0,100);
  const match=text.match(/^(1)\/(2|4|8)$/);return match?1/Number(match[2]):null;
}
function actions(value){
  if(!Array.isArray(value))return [];
  return value.filter(row=>row&&typeof row==='object').slice(0,40).map(row=>({
    name:str(row.nom||row.name,120),description:str(row.desc||row.description,8000),
    attackBonus:integer(row.bonus??row.bonus_attaque??(row.type_action==='attaque'?row.bonus_atk:null),-100,100),
    damage:str(row.degats||row.degats_de,100),damageType:str(row.type_degats||row.type,100),range:str(row.portee,100)
  })).filter(row=>row.name);
}
export function normalizeBestiaryMonster(raw){
  if(!raw||typeof raw!=='object')return null;
  let id=str(raw.slug||raw._source,120);
  if(!/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(id)){
    id=raw._id?.toHexString?.()||'';if(!/^[a-f0-9]{24}$/i.test(id))return null;
  }
  const name=str(raw.nom||raw.name,100);if(!name)return null;
  const maxHp=integer(raw.pv,1,100000),ac=integer(raw.ca,0,100),type=str(raw.type,100);
  const abilities=Object.fromEntries(['FOR','DEX','CON','INT','SAG','CHA'].map(key=>[key,{
    score:integer(raw.caracteristiques?.[key],1,100),modifier:integer(raw.caracteristiques?.[key+'_mod'],-100,100)
  }]));
  const speeds=Object.fromEntries(['marche','nage','vol','fouissement','escalade'].map(key=>[key,number(raw.vitesse?.[key],0,10000)]).filter(([,v])=>v!==null));
  const stats=value=>Object.fromEntries(Object.entries(value&&typeof value==='object'&&!Array.isArray(value)?value:{}).slice(0,50).map(([key,v])=>[str(key,80),number(v,-100,100)]).filter(([key,v])=>key&&v!==null));
  const profile={id,name,originalName:str(raw.nom_original,100),type,typeLabel:typeNames[fold(type)]||type,size:str(raw.taille,30),
    cr:str(typeof raw.fp==='number'?String(raw.fp):raw.fp,30),crValue:bestiaryCR(raw.fp_numerique)??bestiaryCR(raw.fp),
    maxHp,ac,hpFormula:str(raw.pv_formule,100),initiativeBonus:integer(raw.initiative_bonus,-100,100),
    abilities,speeds,saves:stats(raw.jets_sauvegarde),skills:stats(raw.competences),
    resistances:list(raw.resistances),damageImmunities:list(raw.immunites_degats),conditionImmunities:list(raw.immunites_etats),vulnerabilities:list(raw.vulnerabilites),
    languages:list(raw.langues),senses:Object.fromEntries(Object.entries(raw.sens||{}).filter(([,v])=>Number.isFinite(v)).map(([k,v])=>[str(k,80),v])),
    xp:integer(raw.xp??raw.experience,0,10000000),sourceLabel:str(raw.source,200),
    attacks:actions(raw.attaques),actions:actions(raw.actions),bonusActions:actions(raw.actions_bonus),reactions:actions(raw.reactions),legendaryActions:actions(raw.actions_legendaires),traits:actions(raw.traits),
    usable:maxHp!==null&&ac!==null};
  // Keep large inherited descriptions from exceeding MongoDB's per-document limit when adding a troop.
  if(Buffer.byteLength(JSON.stringify(profile))>100000){for(const key of ['attacks','actions','bonusActions','reactions','legendaryActions','traits'])profile[key]=profile[key].map(row=>({...row,description:row.description.slice(0,300)}));profile.descriptionsAbbreviated=true;}
  if(Buffer.byteLength(JSON.stringify(profile))>100000){for(const key of ['attacks','actions','bonusActions','reactions','legendaryActions','traits'])profile[key]=profile[key].slice(0,10).map(row=>({...row,description:''}));profile.descriptionsAbbreviated=true;}
  if(Buffer.byteLength(JSON.stringify(profile))>100000)throw fault(503,'Un profil du bestiaire dépasse la taille autorisée.');
  profile.fingerprint=createHash('sha256').update(JSON.stringify(profile)).digest('hex');
  return profile;
}
const projection={_id:1,slug:1,_source:1,nom:1,name:1,nom_original:1,type:1,taille:1,fp:1,fp_numerique:1,pv:1,ca:1,pv_formule:1,initiative_bonus:1,
  caracteristiques:1,vitesse:1,jets_sauvegarde:1,competences:1,resistances:1,immunites_degats:1,immunites_etats:1,vulnerabilites:1,langues:1,sens:1,xp:1,experience:1,source:1,
  attaques:1,actions:1,actions_bonus:1,reactions:1,actions_legendaires:1,traits:1};
export function createBestiaryStore({collection,now=Date.now}){
  let cached,pending,until=0;
  async function load(fresh=false){
    if(!fresh&&cached&&until>now())return cached;
    if(!fresh&&pending)return pending;
    const work=(async()=>{
      const raw=await collection.find({},{projection}).limit(10001).toArray();
      if(raw.length>10000)throw fault(503,'Le bestiaire est trop volumineux pour être chargé.');
      const rows=raw.map(normalizeBestiaryMonster).filter(Boolean),ids=new Set();
      for(const row of rows){if(ids.has(row.id))throw fault(503,'Le bestiaire contient des identifiants en double.');ids.add(row.id);}
      rows.sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'})||a.id.localeCompare(b.id));
      cached=rows;until=now()+60000;return rows;
    })();
    if(!fresh){pending=work;try{return await work;}finally{pending=undefined;}}
    return work;
  }
  return {
    async search({q='',type='',size='',min='',max='',offset=0}={}){
      if(typeof q!=='string'||q.length>100||typeof type!=='string'||type.length>100||typeof size!=='string'||size.length>30)
        throw fault(400,'Renseignez une recherche valide (100 caractères maximum).');
      const low=min===''?null:bestiaryCR(min),high=max===''?null:bestiaryCR(max);
      if(min!==''&&low===null||max!==''&&high===null||low!==null&&high!==null&&low>high||!Number.isInteger(offset)||offset<0||offset>10000)
        throw fault(400,'Choisissez des filtres et une page valides.');
      const rows=await load(),terms=fold(q).trim().split(/\s+/).filter(Boolean);
      const found=rows.filter(row=>terms.every(term=>fold(row.name+' '+row.originalName+' '+row.typeLabel).includes(term))&&(!type||fold(row.type)===fold(type))&&(!size||row.size===size)&&
        (low===null||row.crValue!==null&&row.crValue>=low)&&(high===null||row.crValue!==null&&row.crValue<=high));
      return {total:found.length,available:rows.length,offset,limit:40,hasMore:offset+40<found.length,
        filters:{types:[...new Map(rows.map(row=>[row.type,row.typeLabel])).entries()].map(([id,label])=>({id,label})).sort((a,b)=>a.label.localeCompare(b.label,'fr')),sizes:[...new Set(rows.map(row=>row.size).filter(Boolean))].sort()},
        monsters:found.slice(offset,offset+40).map(({id,name,originalName,type,typeLabel,size,cr,maxHp,ac,usable})=>({id,name,originalName,type,typeLabel,size,cr,maxHp,ac,usable}))};
    },
    async get(id,{fresh=false}={}){
      if(typeof id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(id))throw fault(404,'Profil de monstre introuvable.');
      const profile=(await load(fresh)).find(row=>row.id===id);if(!profile)throw fault(404,'Profil de monstre introuvable.');
      return structuredClone(profile);
    }
  };
}
