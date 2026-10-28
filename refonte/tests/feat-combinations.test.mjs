import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {featFixture} from '../audit/feat-fixtures.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../data/rules-mongodb.json',import.meta.url))));
for(const cls of c.classes)for(const feat of c.feats.filter(f=>!f.prerequis?.classe))test(`${cls.nom} · don ${feat.nom} · admissibilité et conservation`,()=>{
  const {state:s,eligible}=featFixture(c,cls.id,feat),saved=validateSavedCharacter(characterSnapshot(s),c);
  if(!eligible){assert.equal(saved.status,'draft');assert.ok(saved.issues.some(x=>x.includes('don éligible')));return;}
  assert.equal(saved.status,'ready',saved.issues.join('; '));
  const m=sheetModel(saved.character,c);assert.deepEqual(m.errors,[]);
  assert.ok(m.effects.summaries.some(x=>x.name===feat.nom));
  assert.deepEqual(validateSavedCharacter(characterSnapshot(saved.character),c).character,saved.character);
});
