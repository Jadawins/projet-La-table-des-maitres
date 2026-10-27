// Données factuelles vérifiées le 27/10/2026 sur les sources primaires ci-dessous.
export const sources = {
  cleric:{title:'Règles officielles 2024 : clerc',url:'https://www.dndbeyond.com/sources/dnd/br-2024/character-classes#Cleric'},
  domains:{title:'Présentation officielle des changements 2024 du clerc',url:'https://www.dndbeyond.com/posts/1767-2024-cleric-vs-2014-cleric-whats-new'},
};
const prepared=[4,5,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22];
const slots=[
  [2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],
  [4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],
  [4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],
  [4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
];
export const clericProgression = prepared.map((count,index)=>{
  const level=index+1;
  return {level,prepared:count,cantrips:level>=10?5:level>=4?4:3,proficiency:2+Math.floor((level-1)/4),channel:level>=18?4:level>=6?3:level>=2?2:0,slots:Object.fromEntries(slots[index].map((value,i)=>[i+1,value]))};
});
export const lifeSpellUnlocks = [{level:3,count:4},{level:5,count:6},{level:7,count:8},{level:9,count:10}];

// Observations ciblées : les conditions évitent de conserver une anomalie après correction.
// Ces notices sont des écarts d'audit, pas une reproduction des descriptions du manuel.
export const domainChecks = [
  {id:'vie-preservation',domain:'clerc_domaine_vie',level:3,source:'cleric',test:s=>!(s.niveaux?.['3']?.capacites||[]).some(c=>/pr.servation/i.test(c.nom)),summary:'Préservation de la vie manque au niveau 3.'},
  {id:'vie-supreme',domain:'clerc_domaine_vie',level:17,source:'cleric',test:s=>(s.niveaux?.['17']?.capacites||[]).some(c=>/0 PV/i.test(c.description)),summary:'Guérison suprême est limitée à tort aux cibles à 0 PV.'},
  {id:'lumiere-aurore',domain:'clerc_domaine_lumiere',level:3,source:'domains',test:s=>!(s.niveaux?.['3']?.capacites||[]).some(c=>/aube|aurore/i.test(c.nom)),summary:'Lumière : pouvoir de Canal divin du niveau 3 absent.'},
  {id:'lumiere-flash',domain:'clerc_domaine_lumiere',level:3,source:'domains',test:s=>(s.niveaux?.['3']?.capacites||[]).some(c=>/emplacement/i.test(c.description)),summary:'Lumière : fonctionnement du pouvoir défensif à corriger.'},
  {id:'lumiere-invisibilite',domain:'clerc_domaine_lumiere',level:3,source:'domains',test:s=>!Object.values(s.niveaux?.['3']?.sorts_domaine||{}).flat().some(n=>/invisib/i.test(n)),summary:'Lumière : sort de détection de l’invisibilité absent.'},
  {id:'lumiere-n6',domain:'clerc_domaine_lumiere',level:6,source:'domains',test:s=>(s.niveaux?.['6']?.capacites||[]).some(c=>/aura/i.test(c.nom)),summary:'Lumière : aptitude du niveau 6 incorrecte.'},
  {id:'lumiere-n17',domain:'clerc_domaine_lumiere',level:17,source:'domains',test:s=>(s.niveaux?.['17']?.capacites||[]).some(c=>/ajoute ton modificateur/i.test(c.description)),summary:'Lumière : aptitude finale à corriger.'},
  {id:'ruse-benediction',domain:'clerc_domaine_ruse',level:3,source:'domains',test:s=>!(s.niveaux?.['3']?.capacites||[]).some(c=>/b.n.diction/i.test(c.nom)),summary:'Ruse : bénédiction du niveau 3 absente.'},
  {id:'ruse-double',domain:'clerc_domaine_ruse',level:3,source:'domains',test:s=>!(s.niveaux?.['3']?.capacites||[]).some(c=>/illusion|duplicit/i.test(c.description)),summary:'Ruse : double illusoire absent au niveau 3.'},
  {id:'ruse-concentration',domain:'clerc_domaine_ruse',level:6,source:'domains',test:s=>(s.niveaux?.['6']?.capacites||[]).some(c=>/concentration/i.test(c.description)),summary:'Ruse : concentration encore imposée au double.'},
  {id:'ruse-n17',domain:'clerc_domaine_ruse',level:17,source:'domains',test:s=>(s.niveaux?.['17']?.capacites||[]).some(c=>/non-d.tection/i.test(c.description)),summary:'Ruse : aptitude finale incorrecte.'},
  {id:'guerre-recuperation',domain:'clerc_domaine_guerre',level:3,source:'domains',test:s=>(s.niveaux?.['3']?.capacites||[]).some(c=>/Pr.tre/i.test(c.nom)&&!/court/i.test(c.description)),summary:'Guerre : récupération au repos court manquante.'},
  {id:'guerre-n6',domain:'clerc_domaine_guerre',level:6,source:'domains',test:s=>(s.niveaux?.['6']?.capacites||[]).some(c=>/bonus de \+10/i.test(c.description)),summary:'Guerre : aptitude du niveau 6 non actualisée.'},
];
