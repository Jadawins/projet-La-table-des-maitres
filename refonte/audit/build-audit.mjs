import {createHash} from 'node:crypto';
import {clericProgression,domainChecks,lifeSpellUnlocks,sources} from './cleric-reference.mjs';
const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const sortedSlots=slots=>Object.fromEntries(Object.entries(slots||{}).sort((a,b)=>Number(a[0])-Number(b[0])));
function inherited(cls,field,level) {
  let value=0;
  for(let n=1;n<=level;n++) if(cls.niveaux?.[n]?.[field]!==undefined) value=cls.niveaux[n][field];
  return value;
}
export function buildAudit(snapshot,{externalComparisons=false}={}) {
  const classes=snapshot.collections.classes;
  const subclasses=snapshot.collections.sous_classes;
  const groups=[];
  const findings=[];
  const add=(group,level,id,summary,source,evidence,resolution='a_corriger')=>{
    const finding={id:`${group.id}:${id}`,groupId:group.id,level,summary,source:source?sources[source]:null,evidence,resolution};
    findings.push(finding);return finding;
  };
  for(const cls of [...classes].sort((a,b)=>a.nom.localeCompare(b.nom,'fr'))) {
    const base={id:key(cls.nom),className:cls.nom,name:cls.nom,kind:'classe',rows:[]};
    const isCleric=key(cls.nom)==='clerc';
    for(let level=1;level<=20;level++) {
      const data=cls.niveaux?.[level];
      const row={level,status:'a_verifier',dataPresent:Boolean(data),progression:{status:'a_verifier',checks:[]},featureReview:'a_verifier',integration:isCleric&&level<=20?'partielle':'non_implementee',findingIds:[]};
      if(!data) row.findingIds.push(add(base,level,`niveau-${level}-absent`,'Entrée de niveau absente ; contrôler le mécanisme d’héritage.',null,null,'a_verifier').id);
      if(externalComparisons&&isCleric&&data) {
        const expected=clericProgression[level-1];
        const checks=[
          ['sorts_mineurs',data.sorts_mineurs,expected.cantrips],
          ['sorts_prepares',data.sorts_prepares,expected.prepared],
          ['bonus_maitrise',inherited(cls,'bonusMaitrise',level),expected.proficiency],
          ['canal_divin',inherited(cls,'canal_divin',level),expected.channel],
          ['emplacements',sortedSlots(data.emplacements_de_sort),expected.slots],
        ];
        row.progression={status:checks.every(([,actual,wanted])=>same(actual,wanted))?'valide':'anomalie',source:sources.cleric,checks:checks.map(([field,actual,expected])=>({field,actual,expected,status:same(actual,expected)?'valide':'anomalie'}))};
        for(const [field,actual,wanted] of checks) if(!same(actual,wanted)) row.findingIds.push(add(base,level,`${field}-${level}`,`Progression différente : ${field}.`,'cleric',{actual,expected:wanted}).id);
      }
      row.status=row.findingIds.some(id=>findings.find(f=>f.id===id).resolution==='a_corriger')?'anomalie':'a_verifier';
      base.rows.push(row);
    }
    groups.push(base);
    const children=subclasses.filter(s=>key(s.classe_parente)===key(cls.nom)).sort((a,b)=>a.nom.localeCompare(b.nom,'fr'));
    for(const sub of children) {
      const group={id:sub._source||`${base.id}-${key(sub.nom)}`,className:cls.nom,name:sub.nom,kind:'sous_classe',rows:[],declaredFeatureLevels:sub.niveaux_aptitudes||Object.keys(sub.niveaux||{}).map(Number)};
      if(externalComparisons&&isCleric) {
        if((sub.niveaux?.['8']?.capacites||[]).length) add(group,8,'aptitude-n8','Aptitude de domaine au niveau 8 : conflit avec la progression 2024.','cleric',{names:sub.niveaux['8'].capacites.map(c=>c.nom)});
        if((sub.niveaux_aptitudes||[]).includes(8)) add(group,8,'calendrier-n8','Le calendrier du domaine déclare un palier d’aptitudes supplémentaire au niveau 8.','cleric',{actual:sub.niveaux_aptitudes,expected:[3,6,17]});
        for(const check of domainChecks.filter(c=>c.domain===group.id)) if(check.test(sub)) add(group,check.level,check.id,check.summary,check.source,{abilities:(sub.niveaux?.[check.level]?.capacites||[]).map(c=>({name:c.nom,description:c.description}))});
        // La table complète du domaine de la Vie est publiée dans les règles libres.
        if(group.id==='clerc_domaine_vie') {
          for(let level=3;level<=20;level++) {
            const expected=[...lifeSpellUnlocks].reverse().find(entry=>level>=entry.level).count;
            const declared=Object.entries(sub.niveaux||{}).filter(([n])=>Number(n)<=level).flatMap(([,row])=>Object.values(row.sorts_domaine||{}).flat());
            const actual=new Set(declared.map(key)).size;
            if(actual!==expected) add(group,level,`sorts-cumules-${level}`,'Nombre cumulé de sorts de domaine incorrect à ce niveau.','cleric',{actual,expected});
          }
        }
      }
      for(let level=1;level<=20;level++) {
        const ids=findings.filter(f=>f.groupId===group.id&&f.level===level).map(f=>f.id);
        group.rows.push({level,status:level<3?'sans_objet':ids.length?'anomalie':'a_verifier',dataPresent:Boolean(sub.niveaux?.[level]),findingIds:ids,featureReview:level<3?'sans_objet':ids.length?'anomalie':'a_verifier',integration:sub.classe_parente==='clerc'&&level>=3&&level<=20?'partielle':'non_implementee'});
      }
      groups.push(group);
    }
  }
  const unattached=subclasses.filter(s=>!classes.some(c=>key(c.nom)===key(s.classe_parente))).map(s=>({name:s.nom,parent:s.classe_parente}));
  const rows=groups.flatMap(g=>g.rows);
  return {schemaVersion:1,generatedAt:new Date().toISOString(),snapshotDate:snapshot.date,snapshotHash:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),sources,
    policy:externalComparisons?'comparaison-externe':'bdd-actuelle',
    scope:externalComparisons?'Comparaison externe conservée à part.':'Base de travail : BDD actuelle. Comparaisons externes différées.',
    summary:{classes:classes.length,subclasses:subclasses.length,combinations:subclasses.length*20,totalRows:rows.length,aVerifier:rows.filter(r=>r.status==='a_verifier').length,anomalies:rows.filter(r=>r.status==='anomalie').length,valides:rows.filter(r=>r.status==='valide').length,sansObjet:rows.filter(r=>r.status==='sans_objet').length,progressionChecks:rows.reduce((n,r)=>n+(r.progression?.checks.length||0),0),findings:findings.length},
    groups,findings,unattached,
    validationPolicy:externalComparisons?'Comparaison documentaire ; aucune correction automatique.':'La BDD actuelle fait référence. Le suivi porte sur son intégration dans l’application ; les comparaisons et errata externes sont remis à plus tard.',
  };
}
