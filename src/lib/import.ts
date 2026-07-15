/**
 * Couche d'import Excel/CSV — wrapper sur SheetJS pour produire un
 * tableau de `Record<string, string>` à partir d'un fichier utilisateur.
 *
 * Tous les schémas d'import par entité (cf. `src/lib/imports/*`) consomment
 * la sortie de `parseFile` puis appliquent leur propre normalisation.
 *
 * `downloadTemplate` utilise ExcelJS (et non SheetJS) car la génération de
 * listes déroulantes (validation de données) sur les colonnes à choix
 * (`ImportColumn.options`) n'est pas supportée en écriture par SheetJS
 * dans sa version gratuite.
 */
import ExcelJS from 'exceljs';
import type { ImportColumn } from './imports/common';
import { parseWorkbook, type ParsedFile } from './parseWorkbook';

export type { ParsedFile };

/**
 * Lit un fichier CSV ou XLSX, renvoie en-têtes et lignes textuelles.
 * - La 1ʳᵉ feuille est utilisée pour XLSX.
 * - Les cellules vides sont normalisées en chaîne vide.
 * - Les nombres et dates Excel sont sérialisés tels que vus dans la cellule
 *   (chaîne ISO pour les dates si possible, sinon le rendu locale).
 */
export async function parseFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  return parseWorkbook(buf);
}

/** Slugifie un titre pour un nom de fichier. */
function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

function triggerDownload(buffer: ExcelJS.Buffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };

/**
 * Construit et télécharge un modèle XLSX (1 onglet) avec :
 *  - une ligne d'en-têtes (les libellés FR des colonnes attendues),
 *  - une ligne d'exemple (valeurs `example` du schéma),
 *  - une liste déroulante (validation) sur chaque colonne dotée d'`options`,
 *  - un onglet `Notice` avec la description de chaque colonne.
 */
export async function downloadTemplate(opts: {
  filename: string;
  sheetName: string;
  columns: ImportColumn[];
}): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'OrdreTitres';
  wb.created = new Date();

  // ── Onglet principal : headers + 1 ligne d'exemple + dropdowns ──────────
  const sheet = wb.addWorksheet(opts.sheetName.slice(0, 31));
  sheet.columns = opts.columns.map((c) => ({
    header: c.label,
    key: c.label,
    width: Math.min(40, Math.max(12, c.label.length + 4)),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });
  headerRow.height = 20;

  const exampleValues: Record<string, string> = {};
  for (const c of opts.columns) exampleValues[c.label] = c.example ?? '';
  sheet.addRow(exampleValues);
  sheet.getRow(2).font = { italic: true, color: { argb: 'FF6B7280' } };

  const FIRST_DATA_ROW = 3;
  const LAST_DATA_ROW = 502;
  opts.columns.forEach((col, idx) => {
    if (!col.options || col.options.length === 0) return;
    const colLetter = sheet.getColumn(idx + 1).letter;
    const formulaList = `"${col.options.join(',')}"`;
    for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW; r++) {
      sheet.getCell(`${colLetter}${r}`).dataValidation = {
        type: 'list',
        allowBlank: !col.required,
        formulae: [formulaList],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Valeur invalide',
        error: `Choisir une valeur dans la liste : ${col.options.join(', ')}`,
      };
    }
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Onglet Notice : description + obligatoire/optionnel ─────────────────
  const notice = wb.addWorksheet('Notice');
  notice.columns = [
    { header: 'Colonne', key: 'label', width: 26 },
    { header: 'Obligatoire', key: 'required', width: 12 },
    { header: 'Description', key: 'description', width: 80 },
  ];
  notice.getRow(1).eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });
  for (const c of opts.columns) {
    notice.addRow({
      label: c.label,
      required: c.required ? 'Oui' : 'Non',
      description: c.description ?? (c.options ? `Parmi : ${c.options.join(', ')}.` : ''),
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(buffer, opts.filename.endsWith('.xlsx') ? opts.filename : `${slugify(opts.filename)}.xlsx`);
}