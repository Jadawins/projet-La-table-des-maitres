import {readFile,writeFile} from 'node:fs/promises';
const snapshot=JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url),'utf8'));
const originalSkills=JSON.parse(await readFile(new URL('../../Json/2024/Régles/competences.json',import.meta.url),'utf8'));
const srd='https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf';
const update='https://www.dndbeyond.com/posts/1767-2024-cleric-vs-2014-cleric-whats-new';
const notes={
  clerc_domaine_guerre:['bénédiction divine : intitulé absent remplacé par Rayon traçant (Guiding Bolt), sort de rang 1 du domaine Guerre 2024 confirmé par la présentation officielle ; le reste de la liste BDD reste inchangé.','haste → Hâte : intitulé anglais relié à la fiche française existante.','Croissance d’épines : rang 2 de la fiche existante, plutôt que rang 3 ; palier d’acquisition BDD conservé.'],
  clerc_domaine_lumiere:['lumière des fées → Lueurs féeriques : nom de la fiche existante.','flambée → Détection de l’invisibilité : remplacement ciblé par le sort du domaine 2024 indiqué dans la présentation officielle.'],
  clerc_domaine_ruse:['passe-sans-trace → Passage sans trace : nom de la fiche existante.','déguisement de groupe et ennemis à foison : remplacement ciblé par Antidétection et Motif hypnotique, les sorts de rang 3 indiqués officiellement pour la Ruse 2024. Le palier BDD 6 est conservé.','Porte dimensionnelle : ajout de la fiche SRD du rang 4 ; palier BDD 8 conservé.'],
  clerc_domaine_vie:['revivification → Retour à la vie : fiche existante de rang 3.','guérison de masse des blessures → Soins de groupe : fiche existante de rang 5, déplacée au niveau de clerc 9 confirmé par le SRD. Les autres sorts et aptitudes restent inchangés.'],
};
const changes=[];
for(const sub of snapshot.collections.sous_classes.filter(s=>s.classe_parente==='clerc')){
  const levels=structuredClone(sub.niveaux);
  if(sub._source==='clerc_domaine_guerre'){
    levels[3].sorts_domaine[1]=levels[3].sorts_domaine[1].map(n=>n==='bénédiction divine'?'Rayon traçant':n);
    levels[6].sorts_domaine={2:["croissance d'épines"],3:['Hâte']};
  }
  if(sub._source==='clerc_domaine_lumiere'){
    levels[3].sorts_domaine[1]=levels[3].sorts_domaine[1].map(n=>n==='lumière des fées'?'Lueurs féeriques':n);
    levels[3].sorts_domaine[2]=levels[3].sorts_domaine[2].map(n=>n==='flambée'?"Détection de l'invisibilité":n);
  }
  if(sub._source==='clerc_domaine_ruse'){
    levels[3].sorts_domaine[2]=levels[3].sorts_domaine[2].map(n=>n==='passe-sans-trace'?'Passage sans trace':n);
    levels[6].sorts_domaine[3]=['Antidétection','Motif hypnotique'];
  }
  if(sub._source==='clerc_domaine_vie'){
    levels[6].sorts_domaine[3]=levels[6].sorts_domaine[3].map(n=>n==='revivification'?'Retour à la vie':n);
    levels[8].sorts_domaine[4]=levels[8].sorts_domaine[4].filter(n=>n!=='guérison de masse des blessures');
    levels[9]={...(levels[9]||{}),sorts_domaine:{...(levels[9]?.sorts_domaine||{}),5:['Soins de groupe']}};
  }
  changes.push({sourceId:sub._source,before:sub.niveaux,after:levels,notes:notes[sub._source],references:[srd,...(sub._source.includes('lumiere')||sub._source.includes('ruse')||sub._source.includes('guerre')?[update]:[])]});
}
const spell={id:'porte_dimensionnelle',nom:'Porte dimensionnelle',niveau:4,ecole:'Invocation',classes:['Barde','Ensorceleur','Magicien','Occultiste'],temps_incantation:'action',portee:'150 m',composantes:{V:true,S:false,M:false},duree:'instantanée',concentration:false,rituel:false,attaque:null,sauvegarde:null,degats:null,niveau_superieur:null,description:'Téléportez-vous à un emplacement situé à 150 m au maximum : un lieu visible, visualisé ou défini par sa direction et sa distance. Une créature consentante à 1,50 m de vous peut vous accompagner et arrive à 1,50 m de votre destination. Si un emplacement d’arrivée est occupé par une créature ou entièrement obstrué, la téléportation échoue et chaque voyageur subit 4d6 dégâts de force.',source:'SRD 5.2.1 français',reference:{url:srd,page:168,licence:'CC-BY-4.0',adaptation:'Résumé français ; consulter la source pour le texte intégral.'}};
const skill=originalSkills.find(s=>s.nom==='Escamotage');if(!skill)throw new Error('Compétence source introuvable');
await writeFile(new URL('../data/spell-link-corrections.json',import.meta.url),JSON.stringify({id:'2026-10-27-cleric-links-v1',scope:'Corrections ciblées autorisées : noms, fiches absentes et rangs incohérents ; aucune révision générale des aptitudes.',changes,addSpells:[spell],restoreSkills:[{...skill,source_refonte:'Json/2024/Régles/competences.json'}]},null,2));
console.log('Plan ciblé : quatre domaines, une fiche de sort et une compétence récupérée de la source locale.');
