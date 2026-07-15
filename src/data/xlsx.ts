/**
 * Lecture des fichiers importés (CSV/XLSX) et génération des modèles
 * téléchargeables pour chaque schéma d'import (cf. src/imports/*.ts).
 *
 * Deux librairies, deux rôles :
 *   - `xlsx` (SheetJS)  → lecture des fichiers utilisateur (parseFile).
 *                         Gère nativement CSV et XLSX, BOM UTF-8 inclus.
 *   - `exceljs`         → génération du modèle (downloadTemplate).
 *                         Nécessaire pour la validation de données
 *                         (listes déroulantes) — non supportée par la
 *                         version gratuite de SheetJS en écriture.
 */
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import type { ImportColumn, ImportSchema } from '../lib/imports/common';

// ─────────────────────────────────────────────────────────────────────────
// Lecture (import) — CSV ou XLSX → lignes en Record<string, string>
// ─────────────────────────────────────────────────────────────────────────

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parse un fichier CSV ou XLSX en mémoire (côté navigateur).
 * SheetJS détecte le format à partir du contenu, pas de l'extension —
 * un .csv avec BOM UTF-8 est décodé correctement.
 */
export async function parseFile(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];

  // defval: '' → cellules vides deviennent des chaînes vides plutôt qu'absentes,
  // ce qui simplifie `cell()` côté schémas d'import.
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false, // force le formatage texte (dates → chaînes lisibles, pas de numéros de série Excel)
  });

  const headers = raw.length
    ? Object.keys(raw[0])
    : (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? []).map(String);

  const rows: Record<string, string>[] = raw.map((r) => {
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) row[k] = v == null ? '' : String(v);
    return row;
  });

  return { headers, rows };
}

// ─────────────────────────────────────────────────────────────────────────
// Génération du modèle (export) — ImportSchema → fichier .xlsx téléchargeable
// ─────────────────────────────────────────────────────────────────────────

/** Feuilles de référence optionnelles (ex. liste des références de dossiers valides). */
export interface ReferenceList {
  /** Nom de l'onglet (ex. "Dossiers valides"). */
  sheetName: string;
  /** Titre de colonne (ligne 1). */
  columnLabel: string;
  /** Valeurs à lister, une par ligne. */
  values: string[];
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F2937' }, // gris foncé
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };
const REQUIRED_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFB91C1C' } }; // rouge

/**
 * Génère et télécharge le modèle XLSX pour un schéma d'import donné.
 *
 * Structure du fichier :
 *   - Onglet principal (nom = `schema.entityLabel`) : en-têtes + une ligne
 *     d'exemple. Les colonnes avec `options` reçoivent une liste déroulante
 *     (validation de données) sur les 500 premières lignes de données.
 *   - Onglet "Notice" : description de chaque colonne (obligatoire, format
 *     attendu, valeurs autorisées).
 *   - Onglets de référence additionnels (`referenceLists`), si fournis —
 *     utile par ex. pour lister les références de dossiers existants.
 */
export async function downloadTemplate<T>(
  schema: ImportSchema<T>,
  referenceLists?: ReferenceList[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OrdreTitres';
  workbook.created = new Date();

  addDataSheet(workbook, schema);
  addNoticeSheet(workbook, schema);
  if (referenceLists) {
    for (const ref of referenceLists) addReferenceSheet(workbook, ref);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, schema.templateFilename);
}

function addDataSheet<T>(workbook: ExcelJS.Workbook, schema: ImportSchema<T>): void {
  const sheet = workbook.addWorksheet(schema.entityLabel.slice(0, 31)); // 31 car. max Excel

  sheet.columns = schema.columns.map((c) => ({
    header: c.label,
    key: c.label,
    width: Math.max(c.label.length + 4, 18),
  }));

  // Ligne d'en-tête : style
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((c, colNumber) => {
    c.fill = HEADER_FILL;
    c.font = schema.columns[colNumber - 1]?.required
      ? { ...HEADER_FONT, ...REQUIRED_FONT, color: HEADER_FONT.color }
      : HEADER_FONT;
  });
  headerRow.height = 20;

  // Ligne d'exemple (ligne 2)
  const exampleRow: Record<string, string> = {};
  for (const c of schema.columns) exampleRow[c.label] = c.example ?? '';
  sheet.addRow(exampleRow);
  sheet.getRow(2).font = { italic: true, color: { argb: 'FF6B7280' } };

  // Validation de données (listes déroulantes) — une plage par colonne à `options`,
  // appliquée sur les lignes 3 à 502 (500 lignes de saisie sous l'exemple).
  const FIRST_DATA_ROW = 3;
  const LAST_DATA_ROW = 502;
  schema.columns.forEach((col: ImportColumn, idx: number) => {
    if (!col.options || col.options.length === 0) return;
    const colLetter = sheet.getColumn(idx + 1).letter;
    const range = `${colLetter}${FIRST_DATA_ROW}:${colLetter}${LAST_DATA_ROW}`;
    // Une formule de liste directe supporte ~255 caractères ; au-delà, une plage
    // nommée / feuille de référence serait nécessaire — les enums métier ici
    // restent largement en dessous.
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
    void range; // conservé pour lisibilité/debug, non utilisé directement
  });

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function addNoticeSheet<T>(workbook: ExcelJS.Workbook, schema: ImportSchema<T>): void {
  const sheet = workbook.addWorksheet('Notice');
  sheet.columns = [
    { header: 'Colonne', key: 'label', width: 24 },
    { header: 'Obligatoire', key: 'required', width: 14 },
    { header: 'Description', key: 'description', width: 60 },
    { header: 'Exemple', key: 'example', width: 30 },
  ];
  sheet.getRow(1).eachCell((c) => { c.fill = HEADER_FILL; c.font = HEADER_FONT; });

  for (const col of schema.columns) {
    sheet.addRow({
      label: col.label,
      required: col.required ? 'Oui' : 'Non',
      description: col.description ?? (col.options ? `Parmi : ${col.options.join(', ')}.` : ''),
      example: col.example ?? '',
    });
  }
  sheet.getColumn('required').alignment = { horizontal: 'center' };
}

function addReferenceSheet(workbook: ExcelJS.Workbook, ref: ReferenceList): void {
  const sheet = workbook.addWorksheet(ref.sheetName.slice(0, 31));
  sheet.columns = [{ header: ref.columnLabel, key: 'value', width: 30 }];
  sheet.getRow(1).eachCell((c) => { c.fill = HEADER_FILL; c.font = HEADER_FONT; });
  for (const v of ref.values) sheet.addRow({ value: v });
}

/** Déclenche le téléchargement d'un buffer XLSX côté navigateur. */
function triggerDownload(buffer: ExcelJS.Buffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}