import {classMagic} from './class-magic.mjs';
import {inheritedValue} from './progression.mjs';
import {toolOptions,grantedOriginSpells} from './origin-rules.mjs';
import {invocationOptions,selectedInvocations,invocationErrors,invocationGrants,warlockOtherPreparedIds} from './warlock-options.mjs';
const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const picked=(s,k)=>s.classChoices?.[k]||[];
const wizardSchools={magicien_abjurateur:'Abjuration',magicien_devin:'Divination',magicien_evocateur:'Évocation',magicien_illusionniste:'Illusion'};
export function wizardSavantLevels(s){return s.classId==='magicien'&&wizardSchools[s.subclassId]?[3,5,7,9,11,13,15,17].filter(n=>n<=s.level):[];}
export function wizardSpellbook(s){return [...picked(s,'spellbook'),...wizardSavantLevels(s).flatMap(n=>picked(s,'savant'+n))];}
export function soulknifeDice(s,sub){
  if(s.classId!=='roublard'||sub?.id!=='roublard_ame_aceree'||s.level<3)return null;
  return (sub.niveaux?.[3]?.des_psioniques||[]).findLast(row=>row.niveau<=s.level)||null;
}
export function extraClassChoices(s,c,{add,options,weaponOptions,skillNames,sub,languages,lookupSpell}){
  if(['ensorceleur','occultiste'].includes(s.classId)){
    const names=Object.entries(sub?.niveaux||{}).filter(([n])=>+n<=s.level).flatMap(([,r])=>[...(r.sorts_connus_supplementaires||[]),...(r.sorts_elargis||[])]);
    const missing=[...new Set(names.filter(n=>!lookupSpell(c,n)))];
    if(missing.length)add('rulesToReview','Entrées BDD à préciser avec le MJ',missing.length,missing.map(n=>({id:n,nom:n,description:'Je conserve ce libellé comme non identifié. Aucun niveau ni effet de sort n’est inventé.'})),1,{description:'Ces entrées n’ont aucune correspondance certaine. Elles restent visibles comme données à préciser, conformément à votre choix de conserver la BDD.'});
  }
  if(s.classId==='ensorceleur'){
    add('metamagic','Vos options d’Altération magique',inheritedValue(s,c,'options_alteration_magique')||0,c.remainingSupplements.metamagic.map(x=>({...x,description:x.cout+' PS · '+x.description})),2);
    if(sub?.id==='ensorceleur_sorcellerie_draconique'){
      add('dragonDamage','Votre affinité élémentaire',1,options(['acide','froid','feu','foudre','poison']),6);
    }
  }
  if(s.classId==='occultiste'){
    if(sub?.id==='occultiste_protecteur_fielon')add('fiendResistance','Résilience fiélonne · type choisi au Repos',1,options(['acide','contondants','feu','foudre','froid','nécrotique','perforants','poison','psychique','radiant','tonnerre','tranchants']),10);
    add('invocations','Vos manifestations occultes',inheritedValue(s,c,'manifestations_occultes_nombre'),invocationOptions(s,c));
    if(selectedInvocations(s).includes('blade'))add('pactWeapon','Votre arme de pacte',1,c.weapons.filter(w=>w.categorie.includes('corps_a_corps')).map(w=>({id:key(w.nom),nom:w.nom})),1,{min:0});
    if(selectedInvocations(s).includes('chain'))add('familiar','Forme du familier',1,[...c.shapeForms.filter(f=>f.reference2024?.verified&&f.type==='Beast'&&f.sous_type!=='Swarm'&&(f.fp_numerique===0||f.slug==='poisonous-snake')),...c.familiars.filter(f=>f.reference2024?.verified)].map(f=>({id:f.slug,nom:f.nom})),1,{min:0,description:'Une Bête de FP 0 ou une forme spéciale du Pacte de la Chaîne. Le serpent venimeux et le sphinx merveilleux sont disponibles. Aucun choix automatique.'});
    if(selectedInvocations(s).includes('chain')&&c.shapeForms.some(f=>f.slug===s.classChoices?.familiar?.[0]&&f.type==='Beast'))add('familiarNature','Nature de l’esprit familier',1,[{id:'Celestial',nom:'Céleste'},{id:'Fey',nom:'Fée'},{id:'Fiend',nom:'Fiélon'}],1,{description:'Appel de familier : le type choisi remplace Bête, les autres paramètres du profil sont conservés.'});
    if(selectedInvocations(s).includes('tome')){
      const other=new Set(warlockOtherPreparedIds(s,c));
      add('tomeCantrips','Livre des ombres · trois sorts mineurs',3,c.spells.filter(x=>x.niveau===0&&!other.has(x.id)).map(x=>({id:x.id,nom:x.nom})),1,{description:'Toute liste, sorts non déjà préparés ; deviennent des sorts d’Occultiste par CHA lorsque le Codex est porté.'});
      add('tomeRituals','Livre des ombres · deux rituels de niveau 1',2,c.spells.filter(x=>x.niveau===1&&x.rituel&&!other.has(x.id)).map(x=>({id:x.id,nom:x.nom})),1,{description:'Toujours préparés avec le Codex porté ; peuvent aussi être lancés avec un emplacement, selon les règles normales.'});
    }
    for(const [n,rank]of [[11,6],[13,7],[15,8],[17,9]])add('arcanum'+rank,'Secret arcanique · niveau '+rank,1,c.spells.filter(x=>x.niveau===rank&&x.classes?.some(n=>key(n)==='occultiste')).map(x=>({id:x.id,nom:x.nom})),n,{description:'Sort de la liste d’Occultiste ; une incantation sans emplacement par Repos long, distincte des emplacements de Pacte.'});
  }
  if(s.classId==='roublard'){
    add('weaponMasteries','Vos bottes d’armes',2,weaponOptions(s,c));
    add('expertise1','Expertises · niveau 1',2,options(skillNames(s,c,1)));
    add('expertise6','Expertises supplémentaires · niveau 6',2,options(skillNames(s,c,6).filter(n=>!picked(s,'expertise1').includes(n))),6);
    languages('rogueLanguages','Votre langue supplémentaire',1,1);
  }
  if(s.classId==='moine'){
    add('monkTool','Votre maîtrise d’outil ou d’instrument',1,toolOptions(c).filter(t=>['artisan','instruments_de_musique'].includes(t.category)).map(t=>({id:t.id,nom:t.name})));
  }
  if(s.classId==='magicien'){
    const rank=Math.max(0,...Object.keys(classMagic(s,c).row.emplacements_de_sort||{}).map(Number));
    const pool=c.spells.filter(x=>x.niveau>=1&&x.niveau<=rank&&x.classes?.includes('Magicien'));
    add('spellbook','Les sorts de votre grimoire',6+2*(s.level-1),pool.filter(x=>!wizardSavantLevels(s).some(n=>picked(s,'savant'+n).includes(x.id))).map(x=>({id:x.id,nom:x.nom,description:'Niveau '+x.niveau})),1,{description:'Six sorts de niveau 1 au départ, puis deux par niveau gagné. Les rangs accessibles à chaque palier sont contrôlés.'});
    for(const n of wizardSavantLevels(s))add('savant'+n,'Spécialisation · sorts gratuits du niveau '+n,n===3?2:1,pool.filter(x=>key(x.ecole)===key(wizardSchools[s.subclassId])&&x.niveau<=(n===3?2:(n+1)/2)&&!picked(s,'spellbook').includes(x.id)&&!wizardSavantLevels(s).filter(other=>other!==n).some(other=>picked(s,'savant'+other).includes(x.id))).map(x=>({id:x.id,nom:x.nom,description:'Rang '+x.niveau})),n,{description:'Ajouts au grimoire distincts des sorts habituels, gratuits ; rang accessible au palier d’acquisition.'});
    if(sub?.id==='magicien_illusionniste')add('illusionCantrip','Illusions améliorées · sort mineur supplémentaire',1,c.spells.filter(x=>x.niveau===0&&x.classes?.includes('Magicien')&&(x.id==='illusion_mineure'||[...(s.cantrips||[]),...grantedOriginSpells(s,c).map(x=>x.id)].includes('illusion_mineure'))).map(x=>({id:x.id,nom:x.nom})),3,{description:'Choisissez Illusion mineure, sauf si vous la connaissez déjà : un autre sort mineur de Magicien est alors permis.'});
    add('scholar','Érudition · expertise',1,options(skillNames(s,c,2).filter(n=>c.classes.find(x=>x.id==='magicien').niveaux[2].capacites[0].effets[0].options.some(x=>key(x)===key(n)||key(x)==='intuition'&&key(n)==='perspicacite'))),2);
    for(const [n,k,count,level]of [[1,'mastery1',1,18],[2,'mastery2',1,18],[3,'signature',2,20]])add(k,level===20?'Vos sorts signatures':'Maîtrise arcanique · niveau '+n,count,pool.filter(x=>wizardSpellbook(s).includes(x.id)&&x.niveau===n&&(level===20||['action','action ou rituel'].includes(x.temps_incantation))).map(x=>({id:x.id,nom:x.nom})),level);
  }
}
export function extraClassResources(s,c,sub){
  const resources=[];
  if(s.classId==='ensorceleur'){
    resources.push({nom:'Magie innée',valeur:2,details:'Repos long ; activation bonus, 1 minute : DD+1 et avantage aux attaques de sort, uniquement pendant l’effet.'});
    if(s.level>=2)resources.push({nom:'Points de sorcellerie',valeur:inheritedValue(s,c,'points_de_sorcellerie'),details:'Récupération au repos long ; conversions selon le Réservoir arcanique.'});
    if(s.level>=5)resources.push({nom:'Récupération arcanique',valeur:Math.floor(s.level/2),details:'PS récupérables au repos court, une fois par repos long.'});
    if(sub?.id==='ensorceleur_sorcellerie_aberrante'){
      resources.push({nom:'Parole télépathique',ability:'CHA',kind:'distance',minimum:1,details:'Portée en miles (environ 1,6 km chacun) ; connexion créée en action Bonus avec cible visible à 9 m, durée '+s.level+' minutes.'});
      if(s.level>=18)resources.push({nom:'Implosion distordante',valeur:1,details:'Repos long, ou cinq PS pour restaurer sans action. Action Magie ; téléportation 36 m, zone initiale 9 m, JS FOR contre DD des sorts, 3d10 force et attraction si échec ; moitié seulement si réussite.'});
    }
    if(sub?.id==='ensorceleur_sorcellerie_mecanique'){
      resources.push({nom:'Rétablissement de l’équilibre',ability:'CHA',kind:'quota',minimum:1,details:'Repos long ; réaction avant d20 d’une créature visible à 18 m, supprime Avantage et Désavantage.'});
      if(s.level>=6)resources.push({nom:'Bastion de la loi',valeur:'1 à 5d8',details:'Un à cinq PS, action Magie, vous ou cible visible à 9 m. Dés dépensables pour réduire les dégâts ; fin au Repos long ou réutilisation.'});
      if(s.level>=14)resources.push({nom:'Transe de l’ordre',valeur:1,details:'Repos long, ou cinq PS pour restaurer sans action ; Bonus, une minute, d20 inférieur à 10 peut valoir 10, attaques contre vous sans Avantage.'});
      if(s.level>=18)resources.push({nom:'Cavalcade mécanique',valeur:'100 PV',details:'À répartir dans un Cube de 9 m, avec réparation des objets et fin des sorts de rang 6 maximum choisis. Action Magie, une fois par Repos long, ou sept PS pour restaurer sans action.'});
    }
    if(sub?.id==='ensorceleur_sorcellerie_draconique'){
      if(s.level>=6)resources.push({nom:'Affinité élémentaire',ability:'CHA',kind:'formula',base:0,details:'Bonus à un seul jet de dégâts d’un sort infligeant le type choisi : '+(picked(s,'dragonDamage')[0]||'à choisir')+'. Résistance à ce type dès le niveau 6.'});
      if(s.level>=14)resources.push({nom:'Ailes draconiques',valeur:1,details:'Repos long, ou trois PS pour restaurer sans action. Bonus : vol 18 m pendant une heure, fin volontaire sans action. Pas de vol permanent.'});
    }
    if(sub?.id==='ensorceleur_sorcellerie_sauvage'){
      resources.push({nom:'Débordement magique',valeur:'Sur 20 au d20',details:'Option une fois par tour après sort d’Ensorceleur avec emplacement ; table PHB 2024. Tous les jets demandent une action explicite du joueur.'},{nom:'Marées du chaos',valeur:1,details:'Avantage avant un test d20 ; récupéré au Repos long ou par prochaine incantation avec emplacement, qui impose alors un tirage de Débordement. Aucun jet automatique.'});
      if(s.level>=6)resources.push({nom:'Distorsion de chance',valeur:'±1d4',details:'Réaction, un PS, juste après le d20 d’un test d’une autre créature visible ; jet explicite.'});
      if(s.level>=18)resources.push({nom:'Débordement maîtrisé',valeur:1,details:'Repos long ; après un sort avec emplacement, choix d’un effet de table sauf dernière ligne. Les jets inclus dans l’effet restent obligatoires et explicites.'});
    }
  }
  if(s.classId==='occultiste'){
    const row=classMagic(s,c).row;
    const invocations=selectedInvocations(s);
    if(invocations.includes('protectors'))resources.push({nom:'Don des protecteurs · capacité du livre',ability:'CHA',kind:'targets',minimum:1,details:'Noms inscrits avec permission ; une seule chute à 0 PV sans mort immédiate transformée en 1 PV par Repos long pour tout le livre.'});
    if(invocations.includes('smite'))resources.push({nom:'Châtiment occulte',valeur:(1+row.emplacements_pacte.niveau)+'d8 force',details:'Une fois par tour, touche avec arme de pacte ; dépense un emplacement de Pacte. À terre possible si cible TG ou plus petite.'});
    if(invocations.includes('lifedrinker'))resources.push({nom:'Buveuse de vie',valeur:'1d6',details:'Nécrotique/psychique/radiant au choix, touche d’arme de pacte une fois par tour. Un dé de vie peut aussi être dépensé pour soigner dé + CON, minimum 1 PV.'});
    if(invocations.includes('gaze'))resources.push({nom:'Regard des deux esprits',valeur:'Action Bonus',details:'Toucher consentant ; perception et sens spéciaux jusqu’à fin du tour suivant, maintien par Bonus sur même plan. À 18 m maximum, incantation depuis votre espace ou le sien.'});
    resources.push({nom:'Emplacements de pacte',valeur:row.emplacements_pacte.nombre+' de niveau '+row.emplacements_pacte.niveau,details:'Récupérés au repos court ou long. Les Secrets arcaniques sont des utilisations séparées.'});
    if(s.level>=2)resources.push({nom:'Astuce mystique',valeur:s.level>=20?row.emplacements_pacte.nombre:Math.ceil(row.emplacements_pacte.nombre/2),details:'Emplacements récupérables après le rite d’une minute, 1/repos long.'});
    if(sub?.id==='occultiste_protecteur_archifee'){
      resources.push({nom:'Pas féeriques',ability:'CHA',kind:'quota',minimum:1,details:'Foulée brumeuse sans emplacement par Repos long ; effets additionnels au choix à chaque incantation.'});
      if(s.level>=10)resources.push({nom:'Défenses envoûtantes',valeur:1,details:'Repos long, ou emplacement de Pacte pour restaurer sans action. Réaction après touche visible : dégâts divisés par deux, puis JS SAG ennemi ou autant de psychiques que vous en subissez.'});
    }
    if(sub?.id==='occultiste_protecteur_celeste'){
      resources.push({nom:'Lumière guérisseuse',valeur:(s.level+1)+'d6',details:'Réserve par Repos long ; Bonus, vous ou une créature visible à 18 m.'},{nom:'Lumière guérisseuse · dés par soin',ability:'CHA',kind:'diceCount',minimum:1,die:'d6',details:'Maximum dépensable de la réserve à chaque soin ; pas un jet automatique.'});
      if(s.level>=10)resources.push({nom:'Résilience céleste · vous',ability:'CHA',kind:'formula',base:s.level,details:'PV temporaires après Astuce mystique ou Repos court/long.'},{nom:'Résilience céleste · autres',ability:'CHA',kind:'formula',base:Math.floor(s.level/2),details:'PV temporaires pour jusqu’à cinq autres créatures visibles, aux mêmes déclencheurs.'});
      if(s.level>=14)resources.push({nom:'Vengeance brûlante',valeur:1,details:'Repos long ; avant JS contre la mort de vous ou allié à 18 m : moitié des PV max, fin de À terre possible. Cibles choisies à 9 m du bénéficiaire : 2d8 + CHA radiants et Aveuglé jusqu’à fin du tour.'});
    }
    if(sub?.id==='occultiste_protecteur_fielon'){
      resources.push({nom:'Bénédiction du ténébreux',ability:'CHA',kind:'formula',base:s.level,minimum:1,details:'PV temporaires si vous réduisez un ennemi à 0 PV ou si autrui le fait à 3 m de vous.'});
      if(s.level>=6)resources.push({nom:'Chance du ténébreux',ability:'CHA',kind:'quota',minimum:1,details:'Repos long ; ajoute 1d10 à un test de caractéristique ou une sauvegarde après le jet, avant ses effets ; une fois par jet.'});
      if(s.level>=14)resources.push({nom:'Projection infernale',valeur:1,details:'Repos long, ou emplacement de Pacte pour restaurer sans action ; une fois par tour après touche, JS CHA contre DD sorts, 8d10 psychiques si non-Fiélon, absence et Neutralisé jusqu’à fin de votre prochain tour.'});
    }
    if(sub?.id==='occultiste_protecteur_grand_ancien'){
      resources.push({nom:'Esprit éveillé',ability:'CHA',kind:'distance',minimum:1,details:'Miles (environ 1,6 km chacun) ; Bonus avec créature visible à 9 m, une connexion pendant '+s.level+' minutes, langue comprise des deux.'});
      if(s.level>=6)resources.push({nom:'Combattant clairvoyant',valeur:1,details:'Repos court/long, ou emplacement de Pacte pour restaurer sans action ; à la connexion, JS SAG contre DD sorts, Avantage contre elle/Désavantage contre vous si échec.'});
      if(s.level>=14)resources.push({nom:'Création d’un serviteur',ability:'CHA',kind:'formula',base:s.level,details:'PV temporaires de l’aberration convoquée si option sans Concentration (durée une minute). Une touche par tour contre votre cible de Maléfice ajoute ses dégâts bonus en psychiques.'});
    }
  }
  if(s.classId==='roublard'){
    resources.push({nom:'Attaque sournoise',valeur:inheritedValue(s,c,'attaque_sournoise'),details:'Une fois par tour, finesse/distance ; conditions d’avantage ou d’allié adjacent, jamais avec désavantage.'});
    if(s.level>=5)resources.push({nom:'DD de Frappe opportuniste',kind:'dc',ability:'DEX',details:s.level>=11?'Jusqu’à deux effets par attaque ; dés retirés avant lancer.':'Un effet par attaque ; dés retirés avant lancer.'});
    const psi=soulknifeDice(s,sub);
    if(psi)resources.push({nom:'Puissance psionique',valeur:psi.nombre+psi.de,details:'Un dé récupéré au Repos court, tous au Repos long. Aucun jet automatique.'});
    if(psi&&s.level>=17)resources.push({nom:'DD de Déchirement mental',kind:'dc',ability:'DEX',details:'Sauvegarde de Sagesse.'});
    if(s.level>=20)resources.push({nom:'Coup de chance',valeur:1,details:'Par repos court ou long ; transforme un échec de test d20 en 20.'});
  }
  if(s.classId==='moine'){
    resources.push({nom:'Arts martiaux',valeur:inheritedValue(s,c,'arts_martiaux_de'),details:'Sans armure ni bouclier : DEX et dé d’arts martiaux, attaque à mains nues en action bonus.'});
    if(s.level>=2)resources.push({nom:'Énergie martiale',valeur:s.level,details:'Points récupérés au repos court ou long.'},{nom:'DD des aptitudes de moine',kind:'dc',ability:'SAG',details:'8 + SAG + maîtrise.'},{nom:'Récupération martiale',valeur:1,details:'Par repos long à l’initiative : toute l’énergie et soin '+inheritedValue(s,c,'arts_martiaux_de')+' + '+s.level});
    if(s.level>=4)resources.push({nom:'Chute ralentie',valeur:5*s.level,details:'Dégâts de chute réduits, en réaction.'});
    if(s.level>=3)resources.push({nom:'Parade réflexe',ability:'DEX',kind:'heal',die:'1d10 + '+s.level,details:'Réduction des dégâts totaux d’une attaque touchante '+(s.level>=13?'de tout type.':'incluant contondant, perforant ou tranchant.')},{nom:'Impact redirigé',ability:'DEX',kind:'heal',die:String(inheritedValue(s,c,'arts_martiaux_de')).replace(/^1d/,'2d'),details:'Dégâts si Parade réflexe réduit à zéro et un point d’énergie est dépensé ; JS DEX contre DD du moine, aucune moitié si réussite. Portée selon attaque initiale : mêlée 1,50 m ; distance 18 m sans Abri total.'});
    if(s.level>=2)resources.push({nom:'Rafale de coups',valeur:s.level>=10?3:2,details:'Frappes à mains nues en action Bonus, un point d’énergie ; aucun jet automatique.'});
    if(sub?.id==='moine_credo_elements'){
      resources.push({nom:'Harmonisation élémentaire',valeur:'1 point d’énergie',details:'Début de tour, 10 minutes ou jusqu’à Neutralisé. Mains nues : allonge +3 m ; cinq types élémentaires au choix.'});
      if(s.level>=6)resources.push({nom:'Explosion élémentaire',valeur:String(inheritedValue(s,c,'arts_martiaux_de')).replace(/^1d/,'3d'),details:'Action Magie, 2 points d’énergie ; portée 36 m, rayon 6 m ; JS DEX contre le DD de moine, moitié si réussite.'});
    }
    if(sub?.id==='moine_credo_misericorde'){
      const die=inheritedValue(s,c,'arts_martiaux_de');
      resources.push({nom:'Mains de guérison',ability:'SAG',kind:'heal',die,details:'PV rendus ; action Magie, un point d’énergie, ou remplacement d’une frappe de Déluge de coups sans coût supplémentaire.'},{nom:'Mains de blessure',ability:'SAG',kind:'heal',die,details:'Dégâts nécrotiques ; un point d’énergie après dégâts à mains nues, une fois par tour.'});
      if(s.level>=11)resources.push({nom:'Déluge de guérison et de blessure',ability:'SAG',kind:'quota',minimum:1,details:'Repos long ; pendant Déluge de coups, plusieurs soins et une Mains de blessure sans coût supplémentaire.'});
      if(s.level>=17)resources.push({nom:'Miséricorde suprême',ability:'SAG',kind:'heal',die:'4d10',details:'PV au retour à la vie ; action Magie, cinq points d’énergie, corps mort depuis au plus 24 h. Une utilisation par Repos long.'});
    }
    if(sub?.id==='moine_credo_paume'){
      if(s.level>=6)resources.push({nom:'Plénitude physique',ability:'SAG',kind:'heal',die:inheritedValue(s,c,'arts_martiaux_de'),details:'Soin personnel (minimum 1 PV), action Bonus ; SAG utilisations (minimum une) par Repos long.'});
      if(s.level>=17)resources.push({nom:'Paume vibratoire',valeur:'10d12 force',details:'Quatre points d’énergie à la touche ; une cible, '+s.level+' jours maximum, même plan. JS CON contre le DD du moine, moitié si réussite ; déclenchement explicite par action ou remplacement d’une attaque.'});
    }
    if(sub?.id==='moine_credo_ombre')resources.push({nom:'Arts de l’ombre',valeur:'1 point d’énergie',details:'Ténèbres sans composantes ; vous voyez dans cette zone et pouvez la déplacer à 18 m au début de votre tour. Illusion mineure connue, SAG.'});
  }
  if(s.classId==='magicien'){
    resources.push({nom:'Récupération magique',valeur:Math.ceil(s.level/2),details:'Somme des niveaux récupérables au repos court, 1/repos long ; aucun emplacement supérieur au niveau 5.'});
    if(sub?.id==='magicien_abjurateur')resources.push({nom:'Bouclier arcanique',kind:'formula',ability:'INT',base:2*s.level,details:'PV maximum, création lors d’une Abjuration avec emplacement une fois par Repos long. Recharge : deux fois le rang d’un emplacement dépensé avec Abjuration ou en action Bonus. Résistances/vulnérabilités appliquées avant absorption.'});
    if(sub?.id==='magicien_devin')resources.push({nom:'Présage',valeur:s.level>=14?'3d20':'2d20',details:'À lancer au repos long avec vos dés ou sur demande explicite ; aucun lancer automatique.'});
    if(sub?.id==='magicien_devin'&&s.level>=10)resources.push({nom:'Troisième œil',valeur:1,details:'Repos court/long ; Bonus, choisissez vision dans le noir 36 m, lecture de toute langue ou Voir l’invisible sans emplacement. Effet jusqu’au début du prochain Repos court/long.'});
    if(sub?.id==='magicien_illusionniste'&&s.level>=10)resources.push({nom:'Double illusoire',valeur:1,details:'Repos court/long, ou emplacement de rang 2+ pour restaurer sans action. Réaction : une attaque vous touchant rate automatiquement.'});
    if(sub?.id==='magicien_evocateur'&&s.level>=10)resources.push({nom:'Évocation renforcée',ability:'INT',kind:'formula',base:0,details:'Bonus à un seul jet de dégâts de chaque sort de Magicien d’Évocation ; pas de bonus permanent à tous les jets.'});
  }
  return resources;
}
export function extraClassGrants(s,c,sub,grant){
  invocationGrants(s,c,grant);
  if(sub?.id==='magicien_abjurateur'&&s.level>=10)for(const id of ['contresort','dissipation_de_la_magie'])grant(id,'Briseur de sorts','INT','Si échec à arrêter un sort, l’emplacement n’est pas dépensé. Dissipation : action Bonus possible, maîtrise au test.');
  if(sub?.id==='magicien_illusionniste'){
    for(const id of picked(s,'illusionCantrip'))grant(id,'Illusions améliorées','INT',null,false);
    if(s.level>=6)for(const id of ['convocation_de_bete','convocation_de_fee'])grant(id,'Créatures fantasmatiques','INT','Version Illusion possible ; une incantation sans emplacement de chaque sort par Repos long, créature à moitié de ses PV.');
  }
  if(sub?.id==='moine_credo_elements')grant('elementalisme','Manipulation des éléments','SAG','a_volonte',false);
  if(sub?.id==='occultiste_protecteur_grand_ancien'&&s.level>=10)grant('malefice','Maléfice occulte','CHA');
  if(sub?.id==='moine_credo_ombre'){
    grant('tenebres','Arts de l’ombre','SAG','Un point d’énergie, sans composantes ; vision dans cette zone et déplacement possible au début du tour.',false);
    grant('illusion_mineure','Arts de l’ombre','SAG','À volonté',false);
  }
  if(s.classId==='magicien'){
    if(s.level>=18)for(const id of [...picked(s,'mastery1'),...picked(s,'mastery2')])grant(id,'Maîtrise arcanique','INT','À volonté au rang minimal sans emplacement ; un rang supérieur nécessite un emplacement.',true);
    if(s.level>=20)for(const id of picked(s,'signature'))grant(id,'Sort signature','INT','Une utilisation sans emplacement au rang 3 par Repos court ou long ; un rang supérieur nécessite un emplacement.',true);
    const prepared=new Set([...(s.prepared||[]),...(s.level>=18?[...picked(s,'mastery1'),...picked(s,'mastery2')]:[]),...(s.level>=20?picked(s,'signature'):[])]);
    for(const id of wizardSpellbook(s)){const spell=c.spells.find(x=>x.id===id);if(spell?.rituel&&!prepared.has(id))grant(id,'Savoir rituel · Grimoire','INT','Rituel uniquement sans préparation, en lisant le grimoire.',false);}
  }
}
export function extraClassErrors(s,c){
  const errors=[];
  errors.push(...invocationErrors(s,c));
  if(s.classId==='barde'&&s.level>=10){
    const cls=c.classes.find(x=>x.id==='barde');
    const foreign=(s.prepared||[]).map(id=>c.spells.find(x=>x.id===id)).filter(x=>x&&!x.classes?.some(n=>key(n)==='barde'));
    for(const from of [10,11,13,15,17].filter(n=>n<=s.level)){
      const rank=(from+1)/2,maximum=cls.niveaux[s.level].sorts_prepares-cls.niveaux[from-1].sorts_prepares+s.level-from+1;
      if(foreign.filter(x=>from===10||x.niveau>=rank).length>maximum)errors.push('Secrets magiques : trop de sorts extérieurs '+(from===10?'au total':'de rang '+rank+' ou plus')+' pour les gains et remplacements possibles depuis le niveau '+from+' (maximum '+maximum+').');
    }
  }
  if(s.classId==='magicien'){
    const ids=wizardSpellbook(s);if(new Set(ids).size!==ids.length)errors.push('Grimoire : les sorts de spécialisation doivent être distincts entre eux et des sorts habituels.');
    const bonus=picked(s,'illusionCantrip')[0];
    if(s.subclassId==='magicien_illusionniste'&&s.level>=3&&bonus&&bonus!=='illusion_mineure'&&![...(s.cantrips||[]),...grantedOriginSpells(s,c).map(x=>x.id)].includes('illusion_mineure'))errors.push('Illusions améliorées : un autre sort mineur est permis si Illusion mineure est déjà connue.');
  }
  if(s.classId==='magicien')for(let n=1;n<=s.level;n++){
    const max=Math.max(...Object.keys(classMagic(s,c,n).row.emplacements_de_sort).map(Number));
    if(picked(s,'spellbook').filter(id=>{const spell=c.spells.find(x=>x.id===id);return spell&&spell.niveau<=max;}).length<6+2*(n-1)){errors.push('Grimoire : trop peu de sorts accessibles aux paliers antérieurs (niveau '+n+').');break;}
  }
  return errors;
}
