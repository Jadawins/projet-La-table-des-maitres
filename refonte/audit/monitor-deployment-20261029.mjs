import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const file=new URL('./rules-2024-status.json',import.meta.url);
const logFile=path.join(os.tmpdir(),'myrpgtable-deployment-package.txt');
function refresh(){
  const log=fs.readFileSync(logFile,'utf8');
  const passed=[...log.matchAll(/^\s+ok\s+\d+ \[chromium\]/gm)].length;
  const ready=log.includes('Public landing and authenticated workshop packaged.');
  const failed=/Vérification échouée|Tests failed:|Sources ont changé|Les sources ont changé|Parcours manquants|\d+ failed/.test(log);
  const status=JSON.parse(fs.readFileSync(file,'utf8'));
  status.deploymentCampaign={updatedAt:new Date().toISOString(),status:ready?'package-ready':failed?'failed':'running',browserPassed:passed,browserTotal:1298,productionChanged:false};
  status.phase=ready?'Version locale figée. Paquet validé et prêt ; mise en ligne et contrôles serveur à terminer.':failed?'Version locale figée. Validation du paquet en échec ; production précédente conservée.':`Version locale figée. Validation du paquet de publication : ${passed} parcours navigateur réussis sur 1298. Ancienne version toujours en ligne.`;
  const temp=new URL('./rules-2024-status.deploy.tmp',import.meta.url);fs.writeFileSync(temp,JSON.stringify(status,null,2)+'\n');fs.renameSync(temp,file);
  return !ready&&!failed;
}
if(refresh()){const timer=setInterval(()=>{try{if(!refresh())clearInterval(timer);}catch(e){console.error(e.message);clearInterval(timer);}},15000);}
