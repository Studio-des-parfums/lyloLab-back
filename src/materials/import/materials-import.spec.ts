import ExcelJS from 'exceljs';
import { readTables } from './file-readers.js';
import { extractMaterials } from './materials-import.service.js';
import { IMPORT_FIELDS, columnTarget } from './import-format.js';
import { FACETS } from '../../ai/formula-changes.js';

async function extract(fileName: string, content: Buffer | string) {
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  return extractMaterials(await readTables(fileName, buffer));
}

describe('material import', () => {
  it('reads an Excel sheet with a title row, percentage cells and facets', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventaire');
    sheet.addRow(['Inventaire labo 2026']);
    sheet.addRow(['Matière première', 'N° CAS', 'Limite IFRA Cat.4', 'Floral', 'Boisé', 'Stock', 'Colonne inconnue']);
    sheet.addRow(['Linalol', '78-70-6', 0.006, 7, 1, '1,5 kg', 'x']);
    sheet.getCell('C3').numFmt = '0.0%';
    sheet.addRow([]);
    sheet.addRow(['Hédione', '24851-98-7', 'Aucune limite', 12, null, 250]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const { sheets, materials } = await extract('stock.xlsx', buffer);
    expect(sheets[0]).toMatchObject({ name: 'Inventaire', headerRow: 2, materialRows: 2 });
    expect(sheets[0].columns.find((c) => c.header === 'Colonne inconnue')?.label).toBeNull();

    const [linalol, hedione] = materials;
    expect(linalol).toMatchObject({
      name: 'Linalol',
      text: { casNumber: '78-70-6' },
      ifraLimit: '0,6 %',
      descriptors: { Floral: 7, Boisé: 1 },
    });
    expect(linalol.stocks[0].stockGrams).toBe(1500);
    expect(hedione.ifraLimit).toBe('Aucune limite');
    expect(hedione.descriptors.Floral).toBe(9);
    expect(hedione.warnings[0]).toContain('ramené entre 0 et 9');
  });

  it('reads a Windows-1252 CSV with semicolons, quotes and merged duplicates', async () => {
    const csv =
      'Nom;Fournisseur;Emplacement;Stock;Note libre;Water base\r\n' +
      'Coumarine;"MPE; Paris";A1;100;"Cristaux\nblancs";oui\r\n' +
      'coumarine;BLH;B2;"2*500g";;peut-être\r\n' +
      ';;;;;\r\n' +
      ';Orphelin;C3;;;\r\n';
    const { materials, errors } = await extract('mp.csv', Buffer.from(csv, 'latin1'));

    expect(materials).toHaveLength(1);
    const [coumarine] = materials;
    expect(coumarine.text.freeNote).toBe('Cristaux blancs');
    expect(coumarine.waterBase).toBe(true);
    expect(coumarine.stocks).toEqual([
      { supplier: 'MPE; Paris', producer: null, location: 'A1', stockGrams: 100, stockNote: null },
      { supplier: 'BLH', producer: null, location: 'B2', stockGrams: null, stockNote: '2*500g' },
    ]);
    expect(coumarine.warnings.some((w) => w.includes('2 fois'))).toBe(true);
    expect(coumarine.warnings.some((w) => w.includes('Water base'))).toBe(true);
    expect(errors).toEqual([{ ref: 'Ligne 5', message: 'Ligne ignorée : le nom de la matière est vide.' }]);
  });

  it('reads JSON lists with nested descriptors', async () => {
    const json = JSON.stringify({
      materials: [
        { name: 'Vanilline', nature: 'Synthétique', descriptors: { Gourmand: 8 }, allergens: ['Coumarin'] },
        { name: 'Bergamote', nature: 'bof' },
      ],
    });
    const { materials } = await extract('export.json', json);
    expect(materials[0]).toMatchObject({
      nature: 'synthetic',
      descriptors: { Gourmand: 8 },
      allergens: ['Coumarin'],
    });
    expect(materials[1].nature).toBeUndefined();
    expect(materials[1].warnings[0]).toContain('Nature « bof »');
  });

  it('recognises every header of the downloadable template (field labels and facets)', () => {
    for (const field of IMPORT_FIELDS) {
      expect(columnTarget(field.label)).toEqual({ kind: 'field', key: field.key });
    }
    for (const facet of FACETS) {
      expect(columnTarget(facet)).toEqual({ kind: 'facet', facet });
    }
  });

  it('rejects unsupported formats with a helpful message', async () => {
    await expect(extract('vieux.xls', 'x')).rejects.toThrow('.xlsx');
    await expect(extract('notes.pdf', 'x')).rejects.toThrow('Formats acceptés');
  });
});
