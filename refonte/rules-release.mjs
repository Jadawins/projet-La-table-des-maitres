export function assertRulesReady(status,ledger,revision){
  if(status.releaseId!==revision.id||ledger.releaseId!==revision.id||status.cutoff!==revision.cutoff||ledger.cutoff!==revision.cutoff)throw new Error('Versions de règles incohérentes.');
  if(!ledger.entries?.length)throw new Error('Registre des règles absent.');
  const keys=ledger.entries.map(x=>x.collection+'/'+x.id);
  if(new Set(keys).size!==keys.length)throw new Error('Entrées du registre en double.');
  const total=status.modules.reduce((n,m)=>n+m.total,0);
  if(ledger.entries.length!==total)throw new Error('Inventaire des règles incomplet.');
  const documentedExclusion=e=>e.status==='reference-unavailable'&&e.excludedFromCreation===true&&typeof e.note==='string'&&e.note.trim().length>0&&typeof e.exclusionEvidence==='string'&&e.exclusionEvidence.length>0;
  const pending=ledger.entries.filter(e=>!e.source||(e.status!=='verified'&&!documentedExclusion(e)));
  if(pending.length)throw new Error(`Mise en ligne bloquée : ${pending.length} entrées de règles ne sont pas entièrement vérifiées.`);
  if(status.blockers?.length)throw new Error('Mise en ligne bloquée : des problèmes de règles restent ouverts.');
  if(status.status!=='frozen'||revision.status!=='frozen')throw new Error('La version de règles n’est pas encore figée.');
}
