export function primalProfiles(state,c){
  if(state.classId!=='rodeur'||state.level<3||state.subclassId!=='rodeur_belluaire')return [];
  return c.subclasses.find(s=>s.id==='rodeur_belluaire')?.niveaux?.[3]?.profils_compagnon||[];
}

export function selectedPrimalProfile(state,c){
  return primalProfiles(state,c).find(p=>p.id===state.classChoices?.companion?.[0])||null;
}

export function reconcilePrimalDamage(state,c){
  const allowed=selectedPrimalProfile(state,c)?.types_degats||[];
  state.classChoices.companionDamage=(state.classChoices.companionDamage||[]).filter(type=>allowed.includes(type));
}

export function primalCompanionSheet(state,c,mods,proficiency){
  const profile=selectedPrimalProfile(state,c);
  if(!profile)return null;
  const wisdom=mods.SAG;
  const known=Number.isFinite(wisdom);
  const type=profile.types_degats.find(t=>t===state.classChoices?.companionDamage?.[0])||null;
  const bonus=known?profile.bonus_degats+wisdom:null;
  const checks=Object.fromEntries(Object.entries(profile.caracteristiques).map(([a,value])=>[a,Math.floor((value-10)/2)+proficiency]));
  return {
    nom:profile.nom,
    apparence:state.classChoices?.companionAppearance?.[0]||'À décrire librement, en accord avec ce profil.',
    type:'Bête',taille:profile.taille,alignement:'Neutre',
    ca:known?13+wisdom:null,
    pv:profile.pv_base+profile.pv_par_niveau*state.level,
    des_de_vie:state.level+profile.de_vie,
    vitesse:structuredClone(profile.vitesse),
    caracteristiques:{...profile.caracteristiques},
    bonus_maitrise:proficiency,
    tests_de_caracteristique:{...checks},
    jets_de_sauvegarde:{...checks},
    sens:{vision_dans_le_noir_m:profile.vision_noir_m,perception_passive:12+proficiency},
    langues:'Comprend les langues que vous connaissez.',
    lien_primordial:'Votre bonus de maîtrise est inclus dans chaque test de caractéristique et sauvegarde ci-dessus.',
    frappe:{
      attaque:known?proficiency+wisdom:null,
      allonge_m:1.5,
      degats:known&&type?`${profile.de_degats}${bonus<0?bonus:bonus===0?'':'+'+bonus} ${type}`:'À compléter',
      type_de_degats:type||'À choisir',
      nombre:state.level>=11?2:1,
      effet:profile.trait,
      ...(profile.id==='mer'?{dd_evasion:known?8+proficiency+wisdom:null}:{}),
      ...(state.level>=7?{option:'À chaque touche, Force possible à la place du type normal.'}:{}),
      ...(state.level>=11?{marque_du_chasseur:`Premier coup par tour sur votre cible marquée : +${state.level>=20?'1d10':'1d6'} Force, égal au bonus du sort.`}:{}),
    },
    ...(state.level>=15?{partage_de_sorts:'Un sort vous ciblant peut aussi affecter la bête à 9 m maximum.'}:{}),
    source:profile.source,
  };
}
