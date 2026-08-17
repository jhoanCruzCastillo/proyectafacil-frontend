import JSZip from 'jszip';
import fs from 'fs';

const path =
  'C:/Users/anton/Documents/GitHub/Herrera/book/templates_editor/public/fichas_oficiales/agricultura-riego/1_FTE_Apoyo_Desarrollo_Productivo_Agropecuario-Forestal_Sostenible.xlsm';
const zip = await JSZip.loadAsync(fs.readFileSync(path));

// Find Base de datos sheet and read AD14:AD33
const wb = await zip.file('xl/workbook.xml').async('string');
const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
const sheetTag = [...wb.matchAll(/<sheet[^>]+>/g)].find((m) => /Base de datos/i.test(m[0]));
console.log('sheet tag', sheetTag?.[0]);
const rid = /r:id="(rId\d+)"/.exec(sheetTag?.[0] ?? '')?.[1];
const target = new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1];
console.log('path', target);
const sheet = await zip.file('xl/' + target.replace(/^\//, '')).async('string');
const ss = (await zip.file('xl/sharedStrings.xml').async('string'));
// parse a few shared strings indices - rough
const strings = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
);

for (const ref of ['AD14', 'AD15', 'AD16', 'AD20', 'AD33']) {
  const m = new RegExp(`<c r="${ref}"([^>]*)>([\\s\\S]*?)</c>`).exec(sheet);
  if (!m) {
    console.log(ref, 'MISSING');
    continue;
  }
  const t = /t="([^"]+)"/.exec(m[1])?.[1];
  const v = /<v>([^<]*)<\/v>/.exec(m[2])?.[1];
  const val = t === 's' ? strings[Number(v)] : v;
  console.log(ref, { t, v, val: val?.slice(0, 80) });
}
