import JSZip from 'jszip';
import fs from 'fs';

const path =
  'C:/Users/anton/Documents/GitHub/Herrera/book/templates_editor/public/fichas_oficiales/agricultura-riego/1_FTE_Apoyo_Desarrollo_Productivo_Agropecuario-Forestal_Sostenible.xlsm';
const zip = await JSZip.loadAsync(fs.readFileSync(path));

// Find INVOLUCRADOS sheet
const wb = await zip.file('xl/workbook.xml').async('string');
const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
const rid = /name="INVOLUCRADOS"[^>]*r:id="(rId\d+)"/.exec(wb)?.[1]
  ?? /name="INVOLUCRADOS"[^>]*id="(rId\d+)"/.exec(wb)?.[1];
console.log('rid', rid);
const target = new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1]
  ?? new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels)?.[1];
console.log('target', target);

const sheetPath = 'xl/' + target.replace(/^\//, '');
const sheet = await zip.file(sheetPath).async('string');

// Extract dataValidations snippets
const idx = sheet.indexOf('dataValidation');
console.log('has dataValidation', idx >= 0);
const idxs = [];
let i = 0;
while ((i = sheet.indexOf('dataValidation', i)) >= 0) {
  idxs.push(i);
  i += 1;
}
console.log('occurrences', idxs.length);

// Print each dataValidation-ish block briefly
for (const start of idxs.slice(0, 30)) {
  const chunk = sheet.slice(Math.max(0, start - 80), start + 400);
  if (/type="list"|sqref|formula1|Posici|Cooperante|INDIRECT|Listas/i.test(chunk) || true) {
    console.log('---');
    console.log(chunk.replace(/\s+/g, ' ').slice(0, 350));
  }
}

// Also search for sqref covering C31 or column C
const sqrefs = [...sheet.matchAll(/sqref="([^"]+)"/g)].map((m) => m[1]);
const xmSqrefs = [...sheet.matchAll(/<xm:sqref>([^<]+)<\/xm:sqref>/g)].map((m) => m[1]);
console.log('sqrefs attr', sqrefs);
console.log('xm sqrefs', xmSqrefs);

// Look for Cooperante in shared strings / sheet
const ss = await zip.file('xl/sharedStrings.xml').async('string');
for (const term of ['Cooperante', 'Beneficiario', 'Oponente', 'Perjudicado', 'Posición']) {
  console.log(term, ss.includes(term));
}
