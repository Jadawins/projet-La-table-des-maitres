import {CURRENT_RULES_VERSION} from '../maquette/character-version.mjs';
import {buildCatalogue} from '../catalogue.mjs';
import {clericProfile} from '../maquette/character-rules.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {advancementInitial,improvementLevels} from '../maquette/cleric-progression.mjs';
import {fillBackgroundFixture} from './background-fixture.mjs';
export function clericFixture(c,level,subclassId,vocation='Thaumaturge'){
  const state={schemaVersion:2,rulesVersion:CURRENT_RULES_VERSION,name:'Contrôle du clerc',classId:'clerc',speciesId:'humain',backgroundId:'charlatan',equipment:'A',backgroundEquipment:'A',level,scores:{FOR:12,DEX:11,CON:14,INT:14,SAG:18,CHA:9},statsMethod:'physical',bonusMode:'three',divineOrder:vocation,subclassId:level>=3?subclassId:'',classSkills:['Médecine','Religion'],speciesSize:'M',speciesSkill:'Perception',originFeatId:'robuste',hpMode:'fixed',hpRolls:{},rolls:[],advancements:{},sacredStrike:level>=7?'Magie puissante':'',details:{},step:7};
  for(const n of [4,8])if(level>=n)state.advancements[n]={...advancementInitial(),mode:'ability',abilities:['SAG','CON']};
  for(const n of [12,16])if(level>=n)state.advancements[n]={...advancementInitial(),mode:'ability',abilities:['CON','INT']};
  if(level>=19)state.advancements[19]={...advancementInitial(),mode:'feat',featId:'faveur_de_memoire_magique',featAbility:'SAG'};
  const p=clericProfile(state,c);
  state.cantrips=p.cantrips.slice(0,p.cantripCount).map(s=>s.id);state.prepared=p.prepared.slice(0,p.preparedCount).map(s=>s.id);
  return fillBackgroundFixture(state,c);
}
export function buildClericAudit(snapshot,{maxLevel=10}={}){
  const c=buildCatalogue(snapshot),rows=[];
  for(const domain of c.subclasses.filter(s=>s.classe_parente==='clerc'))for(let level=1;level<=maxLevel;level++){
    const variations=['Protecteur','Thaumaturge'].map(vocation=>{
      const state=clericFixture(c,level,domain.id,vocation),p=clericProfile(state,c),m=sheetModel(state,c);
      return {vocation,issues:m.errors,cantrips:p.cantripCount,prepared:p.preparedCount,slots:p.slots,proficiency:p.proficiency,channel:p.channel||0,sparkDice:p.sparkDice||null,hp:m.hp,dc:m.magic.dc,scores:m.scores};
    });
    const p=clericProfile(clericFixture(c,level,domain.id),c);
    rows.push({domain:domain.nom,domainId:domain.id,level,domainApplicable:level>=3,status:variations.every(v=>!v.issues.length)?'integration_verifiee':'a_corriger',unlinkedSpells:p.always.filter(s=>s.unresolved).map(s=>s.nom),classFeatures:c.classes.find(s=>s.id==='clerc').niveaux[level].capacites?.map(f=>f.nom)||[],domainFeatures:p.domainFeatures.map(f=>f.nom),variations});
  }
  return {policy:'bdd-actuelle',scope:`Ordinateur uniquement. Création et fiche du clerc 1–${maxLevel}, quatre domaines, deux vocations.`,snapshotDate:snapshot.date,rows,notes:['Vérification de l’intégration des données présentes, sans validation globale des règles ; compléments ciblés de sorts autorisés et tracés.','Les sorts non reliés conservent leur libellé source. Aucun remplacement n’est inventé.','Les choix des dons sont validés et conservés. Caractéristiques, maîtrises, expertise, sens, résistances, vitesse et CA sont calculés selon leurs conditions permanentes. Les effets en partie restent détaillés et chiffrés sur la fiche.']};
}
