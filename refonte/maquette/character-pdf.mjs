import {sheetModel} from './sheet-model.mjs';
const signed=v=>v===null||v===undefined?'':`${v>=0?'+':''}${v}`;
const normalize=v=>String(v??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const words=v=>String(v??'').replaceAll('_',' ');
const list=values=>[...new Set(values.filter(Boolean))].map(words).join(', ');
function weaponProperties(properties=[]){
  const labels={deux_mains:'Deux mains',legere:'Légère',lourde:'Lourde',lancer:'Lancer',finesse:'Finesse',allonge:'Allonge',polyvalente:'Polyvalente',munitions:'Munitions',chargement:'Chargement',portee:'Portée',lancer_portee:'Portée de lancer',type:'Munitions'};
  return properties.flatMap(property=>typeof property==='string'?[labels[property]||words(property)]:property&&typeof property==='object'?Object.entries(property).filter(([,value])=>typeof value==='string'||typeof value==='number').map(([key,value])=>`${labels[key]||words(key)} : ${value}${['portee','lancer_portee'].includes(key)?' m':''}`):[]);
}
const skillNames=['Athlétisme','Acrobaties','Discrétion','Escamotage','Arcanes','Histoire','Investigation','Nature','Religion','Dressage','Perspicacité','Médecine','Perception','Survie','Intimidation','Persuasion','Représentation','Tromperie'];
export function pdfValues(state,c){
  const m=sheetModel(state,c),details=state.details||{},text={},checks={};
  Object.assign(text,{charactername:state.name||'Personnage sans nom',background:m.background?.nom,species:list([m.species?.nom,m.variant?.nom]),class:m.cls?.nom,subclass:m.subclass?.nom,level:state.level,ac:m.ac,pb:signed(m.proficiency),init:signed(m.initiative),speed:m.speed===null?'':`${m.speed} m`,size:words(state.speciesSize||m.species?.taille?.categorie),passive:m.passive,'hp-max':m.hp,'hd-max':`${state.level}${String(m.base.de_vie?.type||'').replace(/^1/,'')}`,weapons:list(m.weaponTraining),tools:list(m.tools),appearance:details.appearance,backstory:[details.story,details.traits,details.ideals,details.bonds,details.flaws].filter(Boolean).join('\n'),alignment:details.alignment,languages:list([...(m.species?.langues||[]),...(m.background?.langues||[]),...m.classEffects.languages,details.languages]),equipment:m.inventory.map(i=>`${i.quantity} × ${i.nom}`).join('\n'),'spell-ability':m.magic.ability,'spell-mod':signed(m.mods[m.magic.ability]),'spell-dc':m.magic.dc,'spell-bonus':signed(m.magic.attack)});
  const abilities={FOR:'str',DEX:'dex',CON:'con',INT:'int',SAG:'wis',CHA:'cha'};
  for(const [index,[ability,key]]of Object.entries(abilities).entries()){text[key]=m.scores[ability];text['mod'+key]=signed(m.mods[ability]);const save=m.saves.find(s=>s.ability===ability);text['save'+(index+1)]=signed(save?.value);checks['s'+(index+1)]=Boolean(save?.trained);}
  skillNames.forEach((name,index)=>{const skill=m.skills.find(s=>normalize(s.nom)===normalize(name)||name==='Perspicacité'&&normalize(s.nom)==='intuition');text['skill'+(index+1)]=signed(skill?.value);checks['sk'+(index+1)]=Boolean(skill?.trained||skill?.expertise);});
  ['armures_legeres','armures_intermediaires','armures_lourdes','boucliers'].forEach((training,index)=>checks['armor'+(index+1)]=m.armorTraining.includes(training));
  checks.shield=m.inventory.some(item=>c.armors?.some(a=>a.nom===item.nom&&a.categorie==='bouclier'));
  const traits=[...(m.species?.traits||[]),...(m.variant?.traits||[]),...(m.variant?.traits_speciaux||[])].filter(t=>(t.niveau_min||1)<=state.level);
  text.traits=[...traits.map(t=>t.nom),...m.speciesResources.map(r=>`${r.nom} : ${r.valeur}`),m.darkvision?`Vision dans le noir : ${m.darkvision} m`:'',m.resistances.length?`Résistances : ${list(m.resistances)}`:'',m.immunities.length?`Immunités : ${list(m.immunities)}`:''].filter(Boolean).join('\n');
  text.feats=list([...m.feats.map(g=>g.feat?.nom||g.name),...m.progression.rows.map(row=>row.feat?.nom)]);
  const features=[...m.classFeatures,...m.subclassFeatures].map(f=>f.nom).filter(Boolean);
  features.push(...m.classResources.map(r=>`${r.nom} : ${r.valeur}`),...m.classEffects.summaries.map(s=>`${s.nom} : ${s.choices.join(', ')}`));
  if(m.classEffects.companion)features.push(`Compagnon : ${m.classEffects.companion.nom||m.classEffects.companion.nom_forme||'voir fiche en ligne'}`);
  if(m.classEffects.forms.length)features.push('Formes connues : '+list(m.classEffects.forms.map(f=>f.nom)));
  const middle=Math.ceil(features.length/2);text.features1=features.slice(0,middle).join('\n');text.features2=features.slice(middle).join('\n');
  for(const [coin,key]of Object.entries({pc:'cp',pa:'sp',pe:'ep',po:'gp',pp:'pp'}))text[key]=m.money[coin]??0;
  for(let level=1;level<=9;level++)text['slot'+level]=m.slots[level]||'';
  const attacks=[...m.attacks.map(a=>({name:a.nom,bonus:signed(a.attack),damage:`${a.degats?.de||''} ${signed(a.damageBonus)} ${a.degats?.type||''}`,notes:list([a.botteActive?`Botte : ${a.botte}`:'',...weaponProperties(a.proprietes)])})),...m.spells.filter(s=>s.niveau===0).map(s=>({name:s.nom,bonus:s.sauvegarde?`DD ${s.dc??'—'}`:s.attaque?signed(s.attackBonus):'—',damage:s.damageAtLevel||'',notes:list([s.sauvegarde?`JS ${s.sauvegarde.caracteristique}`:'',s.portee])}))];
  return {text,checks,attacks,spells:m.spells};
}
// Keep the supplied AcroForm interactive. Extra spell/weapon rows use a copy of
// its original page, with new field names registered in the canonical field tree.
export async function createCharacterPDF(state,c,templateBytes){
  const lib=await import('./assets/pdf-lib-1.17.1.mjs');
  const {PDFDocument,StandardFonts,PDFName,PDFArray,PDFHexString}=lib;
  const doc=await PDFDocument.load(templateBytes),form=doc.getForm(),font=await doc.embedFont(StandardFonts.Helvetica),warnings=[];
  const values=pdfValues(state,c),text={...values.text},checks={...values.checks};
  const clean=value=>Array.from(String(value??'').replace(/\r\n?/g,'\n').replace(/\t/g,' ').replace(/[\u0000-\u0008\u000b-\u001f]/g,'')).map(ch=>{if(ch==='\n'||ch==='\r')return ch;try{font.encodeText(ch);return ch;}catch{return ch.normalize('NFKD').replace(/\p{Diacritic}/gu,'').replace(/[^\x20-\x7e]/g,'?');}}).join('');
  async function extraPage(index,suffix){
    const [page]=await doc.copyPages(doc,[index]);doc.addPage(page);
    const fields=form.acroForm.dict.lookup(PDFName.of('Fields'),PDFArray);
    for(const ref of page.node.Annots()?.asArray()||[]){const field=doc.context.lookup(ref);const name=field.get(PDFName.of('T'));if(!name)continue;field.set(PDFName.of('T'),PDFHexString.fromText(name.decodeText()+suffix));fields.push(ref);}
  }
  // Copy blank pages before filling any widget so unused rows remain blank.
  for(let offset=6;offset<values.attacks.length;offset+=6)await extraPage(0,`__armes${offset/6}`);
  for(let offset=30;offset<values.spells.length;offset+=30)await extraPage(1,`__sorts${offset/30}`);
  for(let offset=0;offset<values.attacks.length;offset+=6){const suffix=offset?`__armes${offset/6}`:'';if(suffix)for(const key of ['charactername','class','subclass','level','species','background'])text[key+suffix]=text[key];values.attacks.slice(offset,offset+6).forEach((a,index)=>[a.name,a.bonus,a.damage,a.notes].forEach((value,col)=>text[`weapons${index+1}${col+1}${suffix}`]=value));}
  for(let offset=0;offset<values.spells.length;offset+=30){const suffix=offset?`__sorts${offset/30}`:'';if(suffix)for(const key of ['spell-ability','spell-mod','spell-dc','spell-bonus'])text[key+suffix]=text[key];values.spells.slice(offset,offset+30).forEach((s,index)=>{const n=index+1;text[`spell${n}${suffix}`]=s.nom;text[`spell${n}l${suffix}`]=s.niveau===0?'0':s.niveau;text[`spell${n}r${suffix}`]=s.temps_incantation;text[`spell${n}c${suffix}`]=list([s.always?'Toujours préparé':'',s.ability&&s.ability!==values.text['spell-ability']?`${s.ability} DD ${s.dc} Att ${signed(s.attackBonus)}`:'',s.damageAtLevel||'']);text[`spell${n}p${suffix}`]=s.portee;checks[`c${n}${suffix}`]=Boolean(s.concentration);checks[`r${n}${suffix}`]=Boolean(s.rituel);checks[`m${n}${suffix}`]=Boolean(s.composantes?.M);});}
  // The source has one widget across the casting-time and range columns.
  // Split it into two actual fields so values stay within the printed columns.
  for(const field of form.getFields().filter(f=>/^spell\d+r(?:__sorts\d+)?$/.test(f.getName()))){
    const widget=field.acroField.getWidgets()[0],rect=widget.getRectangle();widget.setRectangle({...rect,width:30});
    const page=doc.getPages().find(p=>p.node.Annots()?.asArray().some(ref=>ref.toString()===field.ref.toString()));
    const range=form.createTextField(field.getName().replace(/r(?=__|$)/,'p'));
    range.addToPage(page,{x:rect.x+32,y:rect.y,width:rect.width-32,height:rect.height,borderWidth:0,font,fontSize:8});
  }
  function fits(value,width,height,size,multiline){const lines=multiline?value.split('\n').flatMap(line=>{const words=line.split(' '),rows=[''];for(const word of words){const last=rows.length-1;if(rows[last]&&font.widthOfTextAtSize(rows[last]+' '+word,size)>width)rows.push(word);else rows[last]+=(rows[last]?' ':'')+word;}return rows;}):[value.replace(/\n/g,' · ')];return lines.length*size*1.2<=height&&lines.every(line=>font.widthOfTextAtSize(line,size)<=width);}
  for(const field of form.getFields()){
    const name=field.getName();field.acroField.dict.delete(PDFName.of('AA'));
    if(field instanceof lib.PDFCheckBox){for(const widget of field.acroField.getWidgets()){widget.getOrCreateBorderStyle().setWidth(.6);const appearance=widget.getOrCreateAppearanceCharacteristics();appearance.setBorderColor([0,0,0]);appearance.setBackgroundColor([1,1,1]);}checks[name]?field.check():field.uncheck();field.updateAppearances();continue;}
    if(!(field instanceof lib.PDFTextField))continue;
    const weaponCell=/^weapons\d[1-4](?:__armes\d+)?$/.test(name);
    if(weaponCell)field.disableMultiline();
    else if(/^spell\d+(?:[crp])?(?:__\w+)?$/.test(name))field.enableMultiline();
    let value=clean(text[name]);const rect=field.acroField.getWidgets()[0].getRectangle(),width=Math.max(1,rect.width-4),height=Math.max(1,rect.height-2),multiline=field.isMultiline();
    field.removeMaxLength();
    const minSize=/^(?:spell|weapons)/.test(name)?6:7;
    let size=Math.min(weaponCell?8:11,height/1.2);while(size>minSize&&!fits(value,width,height,size,multiline))size-=.5;
    if(!fits(value,width,height,size,multiline)){warnings.push(name);while(value.length&&!fits(value+'…',width,height,size,multiline))value=value.slice(0,-1);value+='…';}
    field.setText(multiline?value:value.replace(/\n/g,' · '));field.setFontSize(size);
  }
  doc.catalog.delete(PDFName.of('OpenAction'));form.acroForm.dict.delete(PDFName.of('CO'));
  form.updateFieldAppearances(font);
  doc.setTitle(`${state.name||'Personnage'} · Fiche D&D 2024`);
  return {bytes:await doc.save(),warnings,pages:doc.getPageCount()};
}
export async function downloadCharacterPDF(state,c){
  const response=await fetch('./assets/fiche-personnage-2024.pdf');if(!response.ok)throw Error('Le modèle de fiche est indisponible. Réessayez.');
  const result=await createCharacterPDF(state,c,await response.arrayBuffer()),url=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));
  const link=document.createElement('a');link.href=url;link.download=`${(state.name||'personnage').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,100)}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);return result;
}
