import JSZip from 'jszip';
import fs from 'fs';

const path =
  'C:/Users/anton/Documents/GitHub/Herrera/book/templates_editor/public/fichas_oficiales/agricultura-riego/1_FTE_Apoyo_Desarrollo_Productivo_Agropecuario-Forestal_Sostenible.xlsm';
const zip = await JSZip.loadAsync(fs.readFileSync(path));
const wb = await zip.file('xl/workbook.xml').async('string');

// defined names containing Involucrado
const names = [...wb.matchAll(/<definedName[^>]*name="([^"]+)"[^>]*>([^<]*)<\/definedName>/g)];
for (const m of names) {
  if (/involucr/i.test(m[1]) || /involucr/i.test(m[2])) {
    console.log(m[1], '=>', m[2]);
  }
}
console.log('total names', names.length);
console.log('has Involucrado exact', names.some((m) => m[1] === 'Involucrado'));

// Check merges on sheet5 around row 29-31
const sheet = await zip.file('xl/worksheets/sheet5.xml').async('string');
const merges = [...sheet.matchAll(/<mergeCell ref="([^"]+)"/g)].map((m) => m[1]);
console.log('merges near 29-40:', merges.filter((r) => /2[9]|3[0-9]|40/.test(r)).slice(0, 40));
