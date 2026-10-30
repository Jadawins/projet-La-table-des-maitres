import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {pdfValues,createCharacterPDF} from '../maquette/character-pdf.mjs';
import {PDFDocument,PDFName,PDFArray} from '../maquette/assets/pdf-lib-1.17.1.mjs';
const c=buildCatalogue(JSON.parse(readFileSync(new URL('fixtures/rules-2024.json',import.meta.url))));
const template=readFileSync(new URL('../maquette/assets/fiche-personnage-2024.pdf',import.meta.url));
for(const level of [3,20])test(`Vrai formulaire PDF niveau ${level} : valeurs persistées et champs modifiables`,async()=>{
  const state=classFixture(c,'clerc',level,'clerc_domaine_vie',{divineOrder:'Protecteur',sacredStrike:level>=7?'Frappe sacrée':''});state.name=`Éloïse · niveau ${level}`;
  const before=JSON.stringify(state),expected=pdfValues(state,c),result=await createCharacterPDF(state,c,template),doc=await PDFDocument.load(result.bytes),form=doc.getForm();
  assert.equal(JSON.stringify(state),before);assert.equal(form.getTextField('charactername').getText(),state.name);assert.equal(form.getTextField('level').getText(),String(level));assert.equal(form.getTextField('hp-max').getText(),String(expected.text['hp-max']));assert.equal(form.getTextField('spell-dc').getText(),String(expected.text['spell-dc']));assert.equal(form.getTextField('hp-current').getText(),undefined);assert.equal(form.getTextField('hp-max').isReadOnly(),false);assert.equal(form.getCheckBox('DS1').isChecked(),false);
  const names=form.getFields().map(f=>f.getName());assert.equal(new Set(names).size,names.length);
  const root=form.acroForm.dict.lookup(PDFName.of('Fields'),PDFArray).asArray();
  for(const page of doc.getPages())for(const ref of page.node.Annots()?.asArray()||[]){const widget=doc.context.lookup(ref);if(!widget.has(PDFName.of('T')))continue;assert(root.some(r=>r.toString()===ref.toString()),'Widget enregistré dans le formulaire canonique');assert(widget.lookup(PDFName.of('AP')),'Apparence présente');}
  const exported=form.getFields().filter(f=>/^spell\d+(?:__sorts\d+)?$/.test(f.getName())).map(f=>f.getText()).filter(Boolean);assert.equal(exported.length,expected.spells.length);for(const s of expected.spells)assert(exported.includes(s.nom),s.nom);
  assert(doc.getPageCount()>=2);writeFileSync(new URL(`../.local/formulaire-niveau-${level}.pdf`,import.meta.url),result.bytes);
});
test('Dés physiques, sauvegardes et compétences utilisent les valeurs de la fiche sans aucun lancer',()=>{const state=classFixture(c,'barbare',3,'barbare_frenetique'),a=pdfValues(state,c),b=pdfValues(state,c);assert.deepEqual(a,b);assert.equal(a.text.str,state.scores.FOR);assert.equal(a.checks.s1,true);assert.equal(a.checks.s3,true);assert.equal(a.checks.s5,false);assert.equal(a.text['hp-current'],undefined);assert.equal(a.checks.inspiration,undefined);});
test('Armes du barbare : noms visibles sur une ligne, police réduite et portée structurée lisible',async()=>{
  const state=classFixture(c,'barbare',1,'',{backgroundId:'marin'}),expected=pdfValues(state,c);
  const hatchet=expected.attacks.find(a=>a.name==='Hachette');
  assert.match(hatchet.notes,/6\/18 m/);assert.doesNotMatch(hatchet.notes,/\[object Object\]/);
  assert(expected.attacks.some(a=>a.name==='Hache à deux mains'));
  const result=await createCharacterPDF(state,c,template),doc=await PDFDocument.load(result.bytes),form=doc.getForm();
  for(let row=0;row<expected.attacks.length;row++){
    const field=form.getTextField(`weapons${row+1}1`);
    assert.equal(field.getText(),expected.attacks[row].name);
    for(let col=1;col<=4;col++){
      const cell=form.getTextField(`weapons${row+1}${col}`);
      assert.equal(cell.isMultiline(),false);
      const size=Number(cell.acroField.getDefaultAppearance().match(/([\d.]+) Tf/)[1]);
      assert(size>=6&&size<=8,`${cell.getName()} : ${size} pt`);
    }
  }
  for(const field of form.getFields())if(field.getText)assert.doesNotMatch(field.getText()||'',/\[object Object\]/);
  writeFileSync(new URL('../.local/formulaire-armes-barbare.pdf',import.meta.url),result.bytes);
});
