/**
 * Cœur de lecture xlsx/csv — isolé de `./import.ts` pour n'avoir **aucune**
 * dépendance DOM (`document`, `File`, `Blob`…). Ce fichier doit rester
 * importable depuis un script Node (cf. le générateur de fichiers de test,
 * `src/lib/imports/generators/core.ts`), en plus du navigateur.
 */
import * as XLSX from 'xlsx';

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parse un classeur xlsx/csv déjà chargé en mémoire. Mêmes garanties, même
 * chemin de code que l'import réel (`parseFile` dans `./import.ts`) — ne pas
 * dupliquer cette logique ailleurs.
 */
export function parseWorkbook(buf: ArrayBuffer | Uint8Array): ParsedFile {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Fichier vide ou format inattendu.');
  const sheet = wb.Sheets[sheetName];

  // `header: 1` → tableau 2D ; on extrait headers + lignes pour pouvoir
  // gérer les en-têtes dupliqués ou vides proprement.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, raw: false, defval: '', blankrows: false,
  });
  if (aoa.length === 0) return { headers: [], rows: [] };

  const headers = (aoa[0] ?? []).map((h) => String(h ?? '').trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] ?? [];
    const obj: Record<string, string> = {};
    let nonEmpty = false;
    for (let c = 0; c < headers.length; c++) {
      const v = r[c];
      const s = v == null ? '' : String(v).trim();
      if (s !== '') nonEmpty = true;
      obj[headers[c]] = s;
    }
    if (nonEmpty) rows.push(obj);
  }
  return { headers, rows };
}
