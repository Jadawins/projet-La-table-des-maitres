import classSupplements from './data/class-supplements.json' with {type:'json'};
import fighterSupplements from './data/fighter-supplements.json' with {type:'json'};
// La BDD actuelle fait référence. Seuls les identifiants et formats d'affichage sont adaptés.
const slug = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
export function buildCatalogue(snapshot) {
  const d = snapshot.collections;
  const subclasses = d.sous_classes.map(s => ({...s,id:s._source || slug(s.nom),available:true}));
  return {
    classSupplements,fighterSupplements,provenance:{source:snapshot.source,date:snapshot.date,policy:'bdd-actuelle'},
    classes:d.classes.map(c => ({...c,id:slug(c.nom),principales:[c.niveaux?.['0']?.caracteristique_principale].flat().filter(Boolean),equipment:c.niveaux?.['0']?.equipement_depart || []})).sort((a,b)=>a.nom.localeCompare(b.nom,'fr')),
    shapeForms:d.formes_animales||[],masteries:d.armes_bottes||[],species:d.especes,backgrounds:d.backgrounds,subclasses,spells:d.sorts,feats:d.dons,skills:d.competences,armors:d.armures,weapons:d.armes||[],tools:d.outils||[],
  };
}
