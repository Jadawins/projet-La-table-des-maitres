import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export async function sourceFingerprint(){
  const files=[];
  async function collect(relative){
    for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){
      if(['node_modules','.runtime','playwright-report','test-results'].includes(entry.name))continue;
      const name=path.posix.join(relative,entry.name);
      if(entry.isDirectory())await collect(name);
      else if(/\.(mjs|js|json|css|html|yaml)$/.test(entry.name))files.push(name);
    }
  }
  for(const folder of ['refonte/maquette','refonte/accueil','refonte/access','refonte/tests','refonte/e2e'])await collect(folder);
  files.push('refonte/data/rules-mongodb.json','refonte/data/class-supplements.json','refonte/data/fighter-supplements.json','refonte/data/remaining-supplements.json','refonte/data/missing-spells.json','refonte/data/invocations.json','refonte/data/origin-link-corrections.json','refonte/audit/origin-fixtures.mjs','refonte/audit/feat-fixtures.mjs','refonte/catalogue.mjs','refonte/audit/class-fixtures.mjs','assets/img/fond-bibliotheque-sombre.png');
  const hash=createHash('sha256');
  for(const file of files.sort()){hash.update(file);hash.update(await readFile(path.join(root,file)));}
  return hash.digest('hex');
}
