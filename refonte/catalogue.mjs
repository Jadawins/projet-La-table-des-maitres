import classSupplements from './data/class-supplements.json' with {type:'json'};
import fighterSupplements from './data/fighter-supplements.json' with {type:'json'};
import remainingSupplements from './data/remaining-supplements.json' with {type:'json'};
import missingSpells from './data/missing-spells.json' with {type:'json'};
import invocations from './data/invocations.json' with {type:'json'};
import originCorrections from './data/origin-link-corrections.json' with {type:'json'};
import {applyRulesRevision,rulesRevision} from './rules-revision.mjs';
import {applyEditorialRevision} from './editorial-revision.mjs';
// Les corrections officielles sont versionnées et appliquées sur une copie du relevé Mongo.
const slug = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
export function buildCatalogue(snapshot,{editorial=true}={}) {
  const d = applyRulesRevision(snapshot);
  const subclasses = d.sous_classes.map(s => ({...s,id:s._source || slug(s.nom),available:true}));
  const catalogue={
    originCorrections,dragonForms:d.formes_draconiques||[],familiars:d.familiers||[],classSupplements,fighterSupplements,remainingSupplements,invocations,provenance:{source:snapshot.source,date:snapshot.date,policy:'phb2024-official-corrections',revision:rulesRevision},
    classes:d.classes.map(c => ({...c,id:slug(c.nom),principales:[c.niveaux?.['0']?.caracteristique_principale].flat().filter(Boolean),equipment:c.niveaux?.['0']?.equipement_depart || []})).sort((a,b)=>a.nom.localeCompare(b.nom,'fr')),
    shapeForms:d.formes_animales||[],masteries:(d.armes_bottes||[]).map(r=>({...r,description:(r.effets||[]).map(e=>e.description).filter(Boolean).join(' ')})),species:d.especes,backgrounds:d.backgrounds,subclasses,spells:[...d.sorts,...missingSpells.filter(s=>!s.aliasOf&&!d.sorts.some(x=>x.id===s.id))],feats:d.dons,skills:d.competences,armors:d.armures,weapons:d.armes||[],tools:d.outils||[],
  };
  return editorial?applyEditorialRevision(catalogue):catalogue;
}
