const summary=document.getElementById('rules-summary');
const entries=document.getElementById('rules-entries');
const filter=document.getElementById('rules-filter');
const labels={pending:'À comparer','partial-fields-prepared':'Quelques champs corrigés ; contrôle complet à faire','data-compared-ui-pending':'Données comparées ; parcours à vérifier','data-compared-tests-pending':'Comparé et corrigé · tests regroupés à venir','reference-unavailable':'Référence non retrouvée · non proposé en création',verified:'Vérifié'};
function element(tag,text,parent){const node=document.createElement(tag);node.textContent=text;if(parent)parent.append(node);return node;}
let selected='';
async function refresh(){
  try{
    const responses=await Promise.all(['/rules-update-status.json','/rules-update-ledger.json'].map(url=>fetch(url,{cache:'no-store'})));
    if(responses.some(r=>!r.ok))throw Error();
    const [status,ledger]=await Promise.all(responses.map(r=>r.json()));
    summary.replaceChildren();
    element('p',status.status==='frozen'?'Version figée.':'Vérifications en cours — version encore candidate.',summary).className='notice';
    element('p',status.phase,summary);
    const campaign=status.verification?.finalCampaign;
    if(campaign){
      element('h2','Campagne finale',summary);
      for(const [key,label]of [['unit','Calculs et sauvegarde'],['browser','Parcours navigateur']]){const result=campaign[key];if(result)element('p',`${label} : ${result.passed} réussis, ${result.failed} échecs sur ${result.total} · ${result.status==='running'?'en cours':'exécution terminée'}.`,summary);}
      if(campaign.corrective){element('p',`Contrôles après correction des tests : ${campaign.corrective.passed} réussis, ${campaign.corrective.failed} échecs. Bilan : ${campaign.distinctJourneys} parcours distincts couverts, ${campaign.remainingFailed} échec restant. Les deux échecs initiaux restent conservés dans le rapport.`,summary).className='notice';}
      element('p',status.status==='frozen'?'Contrôles terminés ; preuves et réserves conservées dans le bilan final.':'Ces résultats sont lus dans les journaux réels. La version reste candidate tant que tous les contrôles ne sont pas terminés.',summary).className='hint';
    }
    if(status.workflow?.mode==='corrections-first-tests-afterwards'&&status.status!=='frozen')element('p','Méthode actuelle : corrections regroupées d’abord, campagne de tests ensuite. Les corrections nouvelles restent à tester ; les anciens résultats ci-dessous ne certifient pas ces modifications.',summary).className='notice';
    const verified=ledger.entries.filter(x=>x.status==='verified').length;
    const compared=status.modules.reduce((n,m)=>n+(m.reviewed||0),0);
    element('p',`${compared} entrées comparées aux références · ${status.correctionsPrepared||0} entrées avec des corrections locales.`,summary);
    element('p',`Dernier lot : ${status.verification?.unitLatest?.passed||status.verification?.unitFull?.passed||0} tests de calcul et validation réussis. ${status.verification?.browserPassed||0} parcours navigateur réussis depuis le début de cette stabilisation.`,summary);
    element('p',`Clôture complète : ${verified} / ${ledger.entries.length}. Une entrée n’est clôturée qu’une fois ses données, ses choix et ses calculs contrôlés ; les corrections partielles sont comptées séparément.`,summary).className='hint';
    const excluded=ledger.entries.filter(e=>e.status==='reference-unavailable'&&e.excludedFromCreation).length;
    if(excluded)element('p',`${excluded} variantes sans référence sont documentées et exclues des nouveaux choix. Elles restent distinctes des entrées vérifiées.`,summary).className='hint';
    element('p',status.deployment?.status==='deployed'?`Production : version figée publiée · livraison ${status.deployment.release}.`:'Production : aucune correction de ce lot publiée.',summary);
    const table=element('table','',summary);table.className='sheet-table';
    const head=element('tr','',element('thead','',table));for(const text of ['Module','Inventaire','Comparées','Corrections locales','Clôturées'])element('th',text,head);
    const body=element('tbody','',table);
    for(const m of status.modules){const row=element('tr','',body);for(const text of [m.name,m.total,m.reviewed,m.prepared||0,ledger.entries.filter(e=>e.collection===m.id&&e.status==='verified').length])element('td',String(text),row);}
    if(filter.options.length===1)for(const m of status.modules){const option=element('option',m.name,filter);option.value=m.id;}
    entries.replaceChildren();
    for(const e of ledger.entries.filter(e=>!selected||e.collection===selected)){
      const article=element('article','',entries);article.className='sheet-feature';
      element('h3',e.name||e.id,article);element('p',labels[e.status]||e.status,article);
      if(e.source){const link=element('a','Référence consultée',article);link.href=e.source;link.target='_blank';link.rel='noopener';}
    }
  }catch{summary.textContent='Suivi indisponible. Réessayez dans quelques instants.';}
}
filter.addEventListener('change',()=>{selected=filter.value;refresh();});
await refresh();setInterval(refresh,15000);
