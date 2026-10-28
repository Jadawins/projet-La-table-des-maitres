import {classMagic} from './class-magic.mjs';
import {inheritedValue} from './progression.mjs';
import {toolOptions} from './origin-rules.mjs';
import {invocationOptions,selectedInvocations,invocationErrors,invocationGrants} from './warlock-options.mjs';
const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const picked=(s,k)=>s.classChoices?.[k]||[];
export function extraClassChoices(s,c,{add,options,weaponOptions,skillNames,sub,languages,lookupSpell}){
  if(['ensorceleur','occultiste'].includes(s.classId)){
    const names=Object.entries(sub?.niveaux||{}).filter(([n])=>+n<=s.level).flatMap(([,r])=>[...(r.sorts_connus_supplementaires||[]),...(r.sorts_elargis||[])]);
    if(sub?.id==='occultiste_protecteur_archifee'&&s.level>=14)names.push('planète végétale');
    const missing=[...new Set(names.filter(n=>!lookupSpell(c,n)))];
    if(missing.length)add('rulesToReview','Entrées BDD à préciser avec le MJ',missing.length,missing.map(n=>({id:n,nom:n,description:'Je conserve ce libellé comme non identifié. Aucun niveau ni effet de sort n’est inventé.'})),1,{description:'Ces entrées n’ont aucune correspondance certaine. Elles restent visibles comme données à préciser, conformément à votre choix de conserver la BDD.'});
  }
  if(s.classId==='ensorceleur'){
    add('metamagic','Vos options d’Altération magique',inheritedValue(s,c,'options_alteration_magique')||0,c.remainingSupplements.metamagic.map(x=>({...x,description:x.cout+' PS · '+x.description})),2);
    if(sub?.id==='ensorceleur_sorcellerie_draconique'){
      add('dragonName','Votre ancêtre draconique',1,c.dragonForms.map(f=>({id:f.slug,nom:f.nom.replace(/^Jeune /,'')})),3);
      const ancestor=c.dragonForms.find(f=>f.slug===picked(s,'dragonName')[0]);
      add('dragonDamage','Résistance de votre ancêtre',1,options(ancestor?.immunites_degats||[]),3);
      add('dragonCantrip','Sort mineur correspondant à votre ancêtre',1,c.spells.filter(x=>x.niveau===0&&x.classes.includes('Ensorceleur')&&x.degats?.some(d=>key(d.type)===key(picked(s,'dragonDamage')[0]))).map(x=>({id:x.id,nom:x.nom})),3);
    }
  }
  if(s.classId==='occultiste'){
    add('invocations','Vos manifestations occultes',inheritedValue(s,c,'manifestations_occultes_nombre'),invocationOptions(s,c));
    if(selectedInvocations(s).includes('blade'))add('pactWeapon','Votre arme de pacte',1,c.weapons.filter(w=>w.categorie.includes('corps_a_corps')).map(w=>({id:key(w.nom),nom:w.nom})),1,{min:0});
    if(selectedInvocations(s).includes('chain'))add('familiar','Forme du familier',1,[...c.shapeForms.filter(f=>f.type==='Beast'&&f.fp_numerique===0),...c.familiars].map(f=>({id:f.slug,nom:f.nom})),1,{min:0,description:'Les profils disponibles sont ceux de la BDD. Les formes spéciales absentes ne sont pas inventées.'});
    if(selectedInvocations(s).includes('tome')){
      add('tomeCantrips','Livre des ombres · trois sorts mineurs',3,c.spells.filter(x=>x.niveau===0).map(x=>({id:x.id,nom:x.nom})));
      add('tomeRituals','Livre des ombres · deux rituels de niveau 1',2,c.spells.filter(x=>x.niveau===1&&x.rituel).map(x=>({id:x.id,nom:x.nom})));
    }
    for(const [n,rank]of [[11,6],[13,7],[15,8],[17,9]])add('arcanum'+rank,'Secret arcanique · niveau '+rank,1,c.spells.filter(x=>x.niveau===rank).map(x=>({id:x.id,nom:x.nom})),n);
  }
  if(s.classId==='roublard'){
    add('weaponMasteries','Vos bottes d’armes',2,weaponOptions(s,c));
    add('expertise1','Expertises · niveau 1',2,options(skillNames(s,c,1)));
    add('expertise6','Expertises supplémentaires · niveau 6',2,options(skillNames(s,c,6).filter(n=>!picked(s,'expertise1').includes(n))),6);
    languages('rogueLanguages','Votre langue supplémentaire',1,1);
    if(sub?.id==='roublard_ame_aceree')add('psiDc','DD des pouvoirs psioniques à préciser avec le MJ',1,[],3,{kind:'number',description:'La BDD ne fournit pas de formule de DD pour ces pouvoirs. Renseignez la valeur convenue avec votre MJ.'});
  }
  if(s.classId==='moine'){
    add('monkTool','Votre maîtrise d’outil ou d’instrument',1,toolOptions(c).filter(t=>['artisan','instruments_de_musique'].includes(t.category)).map(t=>({id:t.id,nom:t.name})));
    if(sub?.id==='moine_credo_elements')languages('disciplines','Disciplines élémentaires · nom, coût et effet validés avec le MJ',2+2*[6,11,17].filter(n=>s.level>=n).length,3);
  }
  if(s.classId==='magicien'){
    const rank=Math.max(0,...Object.keys(classMagic(s,c).row.emplacements_de_sort||{}).map(Number));
    const pool=c.spells.filter(x=>x.niveau>=1&&x.niveau<=rank&&x.classes?.includes('Magicien'));
    add('spellbook','Les sorts de votre grimoire',6+2*(s.level-1),pool.map(x=>({id:x.id,nom:x.nom,description:'Niveau '+x.niveau})),1,{description:'Six sorts de niveau 1 au départ, puis deux par niveau gagné. Les rangs accessibles à chaque palier sont contrôlés.'});
    add('scholar','Érudition · expertise',1,options(skillNames(s,c,2).filter(n=>c.classes.find(x=>x.id==='magicien').niveaux[2].capacites[0].effets[0].options.some(x=>key(x)===key(n)||key(x)==='intuition'&&key(n)==='perspicacite'))),2);
    for(const [n,k,count,level]of [[1,'mastery1',1,18],[2,'mastery2',1,18],[3,'signature',2,20]])add(k,level===20?'Vos sorts signatures':'Maîtrise arcanique · niveau '+n,count,pool.filter(x=>picked(s,'spellbook').includes(x.id)&&x.niveau===n&&(level===20||x.temps_incantation==='action')).map(x=>({id:x.id,nom:x.nom})),level);
  }
}
export function extraClassResources(s,c,sub){
  const resources=[];
  if(s.classId==='ensorceleur'){
    resources.push({nom:'Magie innée',valeur:2,details:'Repos long ; activation bonus, 1 minute : DD+1 et avantage aux attaques de sort, uniquement pendant l’effet.'});
    if(s.level>=2)resources.push({nom:'Points de sorcellerie',valeur:inheritedValue(s,c,'points_de_sorcellerie'),details:'Récupération au repos long ; conversions selon le Réservoir arcanique.'});
    if(s.level>=5)resources.push({nom:'Récupération arcanique',valeur:Math.floor(s.level/2),details:'PS récupérables au repos court, une fois par repos long.'});
  }
  if(s.classId==='occultiste'){
    const row=classMagic(s,c).row;
    resources.push({nom:'Emplacements de pacte',valeur:row.emplacements_pacte.nombre+' de niveau '+row.emplacements_pacte.niveau,details:'Récupérés au repos court ou long. Les Secrets arcaniques sont des utilisations séparées.'});
    if(s.level>=2)resources.push({nom:'Astuce mystique',valeur:s.level>=20?row.emplacements_pacte.nombre:Math.ceil(row.emplacements_pacte.nombre/2),details:'Emplacements récupérables après le rite d’une minute, 1/repos long.'});
  }
  if(s.classId==='roublard'){
    resources.push({nom:'Attaque sournoise',valeur:inheritedValue(s,c,'attaque_sournoise'),details:'Une fois par tour, finesse/distance ; conditions d’avantage ou d’allié adjacent, jamais avec désavantage.'});
    if(s.level>=5)resources.push({nom:'DD de Frappe opportuniste',kind:'dc',ability:'DEX',details:s.level>=11?'Jusqu’à deux effets par attaque ; dés retirés avant lancer.':'Un effet par attaque ; dés retirés avant lancer.'});
    if(sub?.id==='roublard_ame_aceree')resources.push({nom:'Puissance psionique',valeur:(2+Math.floor((s.level-1)/4))+'d6',details:'Repos long ; DD renseigné avec le MJ : '+(picked(s,'psiDc')[0]||'—')});
    if(s.level>=20)resources.push({nom:'Coup de chance',valeur:1,details:'Par repos court ou long ; transforme un échec de test d20 en 20.'});
  }
  if(s.classId==='moine'){
    resources.push({nom:'Arts martiaux',valeur:inheritedValue(s,c,'arts_martiaux_de'),details:'Sans armure ni bouclier : DEX et dé d’arts martiaux, attaque à mains nues en action bonus.'});
    if(s.level>=2)resources.push({nom:'Énergie martiale',valeur:s.level,details:'Points récupérés au repos court ou long.'},{nom:'DD des aptitudes de moine',kind:'dc',ability:'SAG',details:'8 + SAG + maîtrise.'},{nom:'Récupération martiale',valeur:1,details:'Par repos long à l’initiative : toute l’énergie et soin '+inheritedValue(s,c,'arts_martiaux_de')+' + '+s.level});
    if(s.level>=4)resources.push({nom:'Chute ralentie',valeur:5*s.level,details:'Dégâts de chute réduits, en réaction.'});
    if(sub?.id==='moine_credo_elements')resources.push({nom:'Disciplines élémentaires',valeur:'À préciser avec le MJ',details:'La BDD fournit leur nombre mais aucune liste ni détail. Les choix saisis sont conservés sur la fiche.'});
    if(sub?.id==='moine_credo_misericorde')resources.push({nom:'Mains de guérison',ability:'SAG',kind:'heal',die:'1d10',details:'Coût : 1 énergie, selon les conditions de l’aptitude BDD.'});
  }
  if(s.classId==='magicien'){
    resources.push({nom:'Récupération magique',valeur:Math.ceil(s.level/2),details:'Somme des niveaux récupérables au repos court, 1/repos long ; aucun emplacement supérieur au niveau 5.'});
    if(sub?.id==='magicien_abjurateur')resources.push({nom:'Bouclier arcanique',kind:'formula',ability:'INT',base:2*s.level,details:'PV du bouclier lorsqu’un sort d’Abjuration de niveau 1+ est lancé.'});
    if(sub?.id==='magicien_devin')resources.push({nom:'Présage',valeur:s.level>=14?'3d20':'2d20',details:'À lancer au repos long avec vos dés ou sur demande explicite ; aucun lancer automatique.'});
  }
  return resources;
}
export function extraClassGrants(s,c,sub,grant){
  invocationGrants(s,c,grant);
  if(sub?.id==='ensorceleur_sorcellerie_draconique')for(const id of picked(s,'dragonCantrip'))grant(id,'Ancêtre draconique','CHA',null,false);
  if(sub?.id==='occultiste_protecteur_archifee'){
    if(s.level>=10)grant('porte_dimensionnelle','Manteau de la fée','CHA','1_repos_court_ou_long',false);
    if(s.level>=14)grant('planète végétale','Bosquet obscur','CHA','1_repos_long',false);
  }
  if(sub?.id==='occultiste_protecteur_fielon'&&s.level>=10)for(const id of ['contact_glacial','couronne_de_folie'])grant(id,'Âme des ténèbres','CHA','1_repos_long',false);
  if(sub?.id==='occultiste_protecteur_grand_ancien'&&s.level>=10)for(const id of ['telekinesie','detection_des_pensees'])grant(id,'Vue des profondeurs','CHA','1_repos_long',false);
  if(sub?.id==='roublard_arnaqueur_arcanique'&&s.level>=13)grant('deguisement','Tromperie versatile','INT','1_repos_long',false);
  if(sub?.id==='roublard_ame_aceree'&&s.level>=17)grant('suggestion','Domination psychique',null,'Coût : 3 dés psioniques ; caractéristique à préciser avec le MJ',false);
  if(sub?.id==='moine_credo_ombre')for(const id of ['tenebres','silence','immobilisation_de_personne'])grant(id,'Arts de l’ombre','SAG','2 points d’énergie',false);
  if(sub?.id==='moine_credo_misericorde'&&s.level>=11)grant('rappel_a_la_vie','Visiteur de la miséricorde','SAG','5 points d’énergie ; mort depuis moins de 24 h',false);
  if(s.classId==='magicien')for(const id of [...(s.level>=18?[...picked(s,'mastery1'),...picked(s,'mastery2')]:[]),...(s.level>=20?picked(s,'signature'):[])])grant(id,s.level>=20&&picked(s,'signature').includes(id)?'Sort signature':'Maîtrise arcanique','INT','1_repos_court',true);
}
export function extraClassErrors(s,c){
  const errors=[];
  errors.push(...invocationErrors(s,c));
  if(s.classId==='magicien')for(let n=1;n<=s.level;n++){
    const max=Math.max(...Object.keys(classMagic(s,c,n).row.emplacements_de_sort).map(Number));
    if(picked(s,'spellbook').filter(id=>{const spell=c.spells.find(x=>x.id===id);return spell&&spell.niveau<=max;}).length<6+2*(n-1)){errors.push('Grimoire : trop peu de sorts accessibles aux paliers antérieurs (niveau '+n+').');break;}
  }
  return errors;
}
