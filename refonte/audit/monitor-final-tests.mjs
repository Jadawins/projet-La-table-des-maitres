import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const statusFile=new URL('./rules-2024-status.json',import.meta.url);
const read=name=>{try{return fs.readFileSync(path.join(os.tmpdir(),name),'utf8');}catch{return '';}};
const startedAt=new Date().toISOString();
function refresh(){
  const unit=read('myrpgtable-final-unit-pass2.txt'),browser=read('myrpgtable-final-browser.txt');
  const unitDone=/# duration_ms \d/.test(unit);
  const browserDone=/^\s*\d+ (?:passed|failed|did not run)(?:\s|$)/m.test(browser);
  const count=(text,re)=>[...text.matchAll(re)].length;
  const number=(text,re,fallback)=>Number(text.match(re)?.[1]??fallback);
  const stats={startedAt,updatedAt:new Date().toISOString(),
    unit:{status:unitDone?'completed':'running',passed:number(unit,/# pass (\d+)/,count(unit,/^ok \d+ /gm)),failed:number(unit,/# fail (\d+)/,count(unit,/^not ok \d+ /gm)),total:number(unit,/# tests (\d+)/,2840),log:'TEMP/myrpgtable-final-unit-pass2.txt'},
    browser:{status:browserDone?'completed':'running',passed:count(browser,/^\s+ok\s+\d+ \[chromium\]/gm),failed:count(browser,/^\s+(?:x|✘|×|not ok)\s+\d+ \[chromium\]/gm),total:number(browser,/Running (\d+) tests/,1298),log:'TEMP/myrpgtable-final-browser.txt'}};
  stats.status=unitDone&&browserDone?(stats.unit.failed||stats.browser.failed||/\d+ failed/.test(browser)?'failed':'completed'):'running';
  const status=JSON.parse(fs.readFileSync(statusFile,'utf8'));
  status.verification.finalCampaign=stats;
  const temporary=new URL('./rules-2024-status.tmp',import.meta.url);
  fs.writeFileSync(temporary,JSON.stringify(status,null,2)+'\n');fs.renameSync(temporary,statusFile);
  return stats.status;
}
if(refresh()==='running'){
  const timer=setInterval(()=>{try{if(refresh()!=='running')clearInterval(timer);}catch(error){console.error(error.message);}},15000);
}
