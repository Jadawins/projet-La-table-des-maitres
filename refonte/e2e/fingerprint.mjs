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
      else if(/\.(mjs|js|json|css|html|yaml|pdf)$/.test(entry.name))files.push('refonte/audit/equipment-reference-2024.json',name);
    }
  }
  for(const folder of ['refonte/maquette','refonte/accueil','refonte/access','refonte/tests','refonte/e2e'])await collect(folder);
  files.push('refonte/audit/spell-reference-2024.json','refonte/audit/spell-comparisons-2024.json','refonte/audit/spell-reference-aliases-2024.json','refonte/audit/index-spell-reference.mjs','refonte/audit/extract-spell-columns.py','refonte/audit/prepare-spell-revision.mjs','refonte/audit/prepare-spell-metadata.mjs','refonte/audit/feat-reference-2024.json','refonte/audit/prepare-feat-revision.mjs','refonte/audit/complementary-spells-2024-preparation.json','refonte/audit/dragon-reference-2024.json','refonte/audit/familiar-reference-2024.json','refonte/audit/animal-reference-2024.json','refonte/audit/extract-animal-reference.mjs','refonte/rules-release.mjs','refonte/audit/background-reference-2024.json','refonte/rules-revision.mjs','refonte/data/rules-2024-corrections.json','refonte/audit/background-fixture.mjs','refonte/tests/fixtures/rules-2024.json','refonte/data/class-supplements.json','refonte/data/fighter-supplements.json','refonte/data/remaining-supplements.json','refonte/data/missing-spells.json','refonte/data/invocations.json','refonte/data/origin-link-corrections.json','refonte/audit/origin-fixtures.mjs','refonte/audit/feat-fixtures.mjs','refonte/catalogue.mjs','refonte/audit/class-fixtures.mjs','assets/img/fond-bibliotheque-sombre.png','assets/icone/favicon-192.png');
  files.push('refonte/editorial-revision.mjs','refonte/data/editorial-description-corrections-20261030.json');
  files.push('refonte/data/non-srd-description-rewrite-20261030.json');
  const hash=createHash('sha256');
  for(const file of files.sort()){hash.update(file);hash.update(await readFile(path.join(root,file)));}
  return hash.digest('hex');
}
