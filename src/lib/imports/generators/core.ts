/**
 * Cœur du générateur de fichiers de test d'import — partagé par tous les
 * générateurs par entité (cf. `./audiences.ts`, `./dossiers.ts`, …).
 *
 * Contrat : un générateur transforme des données **réelles** (bootstrap de
 * la source de données courante — seed ou back-end réel) en lignes brutes
 * `Record<string, string>` shape-compatibles avec `schema.parseRow`. Il ne
 * doit **jamais** inventer de référence (dossier, agent, avocat, juridiction)
 * — seulement piocher parmi les entités qui existent vraiment, pour que
 * chaque ligne générée passe la validation par construction.
 *
 * `writeGeneratedWorkbook` vérifie cette garantie deux fois avant d'écrire
 * quoi que ce soit sur disque :
 *   1. relecture des lignes via `schema.parseRow` (même code que l'UI),
 *   2. aller-retour réel par le fichier xlsx écrit, relu via
 *      `parseWorkbook` (même fonction que `parseFile` côté navigateur).
 * Si l'une des deux échoue, le script s'arrête en erreur plutôt que de
 * produire un fichier de test cassé.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ExcelJS from 'exceljs';
import type { ImportContext, ImportSchema } from '../common';
import { parseWorkbook } from '../../parseWorkbook';

// ── Aléatoire déterministe (seedable) ───────────────────────────────────────
// Un seed fixe par défaut donne une sortie stable d'une exécution à l'autre
// (diffs lisibles en review) ; passer --seed=<n> pour varier volontairement.
let _seed = 42;
export function setSeed(n: number): void { _seed = n >>> 0; }
function rand(): number {
  // xorshift32 — suffisant pour de la génération de fixtures, pas pour de la crypto.
  _seed ^= _seed << 13; _seed >>>= 0;
  _seed ^= _seed >>> 17;
  _seed ^= _seed << 5; _seed >>>= 0;
  return _seed / 0xffffffff;
}

export function pick<T>(arr: readonly T[], label: string): T {
  if (arr.length === 0) {
    throw new Error(
      `Génération impossible : aucune donnée réelle disponible pour « ${label} ». `
      + `Vérifiez que la source de données (DATA_SOURCE) contient au moins un enregistrement.`,
    );
  }
  return arr[Math.floor(rand() * arr.length)];
}

export function maybe<T>(value: T, probabilityPresent = 0.7): T | undefined {
  return rand() < probabilityPresent ? value : undefined;
}

/** Comme `pick`, mais renvoie `undefined` (jamais d'erreur) si `arr` est vide ou par tirage. */
export function pickMaybe<T>(arr: readonly T[], probabilityPresent = 0.7): T | undefined {
  if (arr.length === 0) return undefined;
  return rand() < probabilityPresent ? arr[Math.floor(rand() * arr.length)] : undefined;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function fullName(p: { nom: string; prenom?: string }): string {
  return `${p.prenom ? `${p.prenom} ` : ''}${p.nom}`;
}

/** Date aléatoire à N jours de `base` (défaut aujourd'hui), formatée JJ/MM/AAAA (format FR attendu par `parseDate`). */
export function randomDateFR(daysMin: number, daysMax: number, base = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + randomInt(daysMin, daysMax));
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function randomHeure(): string {
  const h = String(randomInt(8, 17)).padStart(2, '0');
  const m = pick(['00', '15', '30', '45'], 'minutes');
  return `${h}:${m}`;
}

/** Pioche un code d'enum brut, ou son libellé FR — les deux formes sont acceptées par `parseEnum`. */
export function randomEnumValue<T extends string>(
  values: readonly T[],
  labels?: Record<T, string>,
): string {
  const v = pick(values, 'enum');
  if (labels && rand() < 0.5) return labels[v];
  return v;
}

// ── Écriture + double vérification ──────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };

export interface GeneratedFileResult {
  outputPath: string;
  rowCount: number;
}

/**
 * Écrit un classeur xlsx à partir de lignes déjà générées, après avoir
 * vérifié que chacune passe `schema.parseRow` sans erreur. Relit ensuite le
 * fichier écrit avec le même parseur que l'import réel pour confirmer
 * l'aller-retour (protège contre un écart de formatage ExcelJS ↔ SheetJS).
 */
export async function writeGeneratedWorkbook<T>(opts: {
  schema: ImportSchema<T>;
  rows: Record<string, string>[];
  ctx: ImportContext;
  outputPath: string;
}): Promise<GeneratedFileResult> {
  const { schema, rows, ctx, outputPath } = opts;

  // 1) Vérification logique — même chemin de code que l'ImportDialog.
  const badRows: string[] = [];
  rows.forEach((row, i) => {
    const { errors } = schema.parseRow(row, ctx);
    if (errors.length > 0) badRows.push(`  ligne ${i + 2} : ${errors.join(' | ')}`);
  });
  if (badRows.length > 0) {
    throw new Error(
      `${badRows.length}/${rows.length} ligne(s) générée(s) pour « ${schema.entityLabel} » `
      + `échouent à la validation — le générateur a un bug, pas les données :\n${badRows.join('\n')}`,
    );
  }

  // 2) Écriture xlsx.
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OrdreTitres — generate-test-import';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(schema.entityLabel.slice(0, 31));
  sheet.columns = schema.columns.map((c) => ({
    header: c.label, key: c.label, width: Math.max(c.label.length + 4, 18),
  }));
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((c) => { c.fill = HEADER_FILL; c.font = HEADER_FONT; });
  headerRow.height = 20;
  for (const row of rows) {
    // Toutes les valeurs sont écrites en texte brut (pas de types Excel natifs
    // pour les dates/nombres) pour garantir une relecture SheetJS identique
    // à ce qu'un utilisateur taperait dans une cellule.
    sheet.addRow(row);
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const notice = workbook.addWorksheet('Notice');
  notice.columns = [
    { header: 'Colonne', key: 'label', width: 26 },
    { header: 'Obligatoire', key: 'required', width: 12 },
    { header: 'Description', key: 'description', width: 80 },
  ];
  notice.getRow(1).eachCell((c) => { c.fill = HEADER_FILL; c.font = HEADER_FONT; });
  for (const c of schema.columns) {
    notice.addRow({
      label: c.label,
      required: c.required ? 'Oui' : 'Non',
      description: c.description ?? (c.options ? `Parmi : ${c.options.join(', ')}.` : ''),
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);

  // 3) Aller-retour réel — relit le fichier écrit avec le parseur de production.
  const buf = fs.readFileSync(outputPath);
  const parsed = parseWorkbook(buf);
  const roundTripBad: string[] = [];
  parsed.rows.forEach((row, i) => {
    const { errors } = schema.parseRow(row, ctx);
    if (errors.length > 0) roundTripBad.push(`  ligne ${i + 2} : ${errors.join(' | ')}`);
  });
  if (roundTripBad.length > 0) {
    throw new Error(
      `Aller-retour xlsx invalide pour « ${schema.entityLabel} » — le fichier écrit ne se relit pas `
      + `identique à ce qui a été validé (écart ExcelJS/SheetJS) :\n${roundTripBad.join('\n')}`,
    );
  }
  if (parsed.rows.length !== rows.length) {
    throw new Error(
      `Aller-retour xlsx incohérent : ${rows.length} ligne(s) écrite(s), ${parsed.rows.length} relue(s).`,
    );
  }

  return { outputPath, rowCount: rows.length };
}
