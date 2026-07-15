/**
 * Types et helpers partagés par tous les schémas d'import.
 *
 * Un schéma d'import expose :
 *  - `entityLabel`        — nom métier (« Dossiers », « Audiences »…),
 *  - `templateFilename`   — nom de fichier suggéré pour le modèle XLSX,
 *  - `columns`            — colonnes attendues (en-tête + exemple + obligatoire),
 *  - `parseRow`           — convertit une ligne brute en entrée typée + erreurs.
 */
import type {
  Agent, Avocat, Dossier, Juridiction,
} from '../../models';

/** Description d'une colonne attendue par le schéma. */
export interface ImportColumn {
  /** En-tête tel qu'attendu dans le fichier (insensible casse/accents). */
  label: string;
  /** Si true, une cellule vide produit une erreur. */
  required?: boolean;
  /** Valeur affichée dans le modèle XLSX à titre d'exemple. */
  example?: string;
  /** Texte d'aide affiché dans l'onglet Notice du modèle. */
  description?: string;
  /** Valeurs autorisées — si présent, génère une liste déroulante (validation) dans le modèle XLSX. */
  options?: readonly string[];
}

/** Données de référence injectées dans `parseRow` pour résoudre les FK. */
export interface ImportContext {
  dossiers: Pick<Dossier, 'id' | 'reference'>[];
  juridictions: Pick<Juridiction, 'id' | 'libelle'>[];
  avocats: Pick<Avocat, 'id' | 'nom' | 'prenom' | 'cabinet'>[];
  agents: Pick<Agent, 'id' | 'nom' | 'prenom' | 'poste'>[];
}

/** Résultat du parsing d'une ligne. */
export interface ParsedRow<T> {
  input: T | null;
  errors: string[];
}

/** Schéma générique d'import d'une entité. */
export interface ImportSchema<TInput> {
  entityLabel: string;
  templateFilename: string;
  columns: ImportColumn[];
  parseRow: (row: Record<string, string>, ctx: ImportContext) => ParsedRow<TInput>;
}

/** Normalise une chaîne pour comparaison insensible casse/accents. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Accès case-insensitive à une colonne (le fichier utilisateur peut varier). */
export function cell(row: Record<string, string>, label: string): string {
  if (label in row) return row[label] ?? '';
  const want = normalize(label);
  for (const k of Object.keys(row)) {
    if (normalize(k) === want) return row[k] ?? '';
  }
  return '';
}

/** Parse une valeur d'enum à partir du code MAJUSCULES ou du libellé FR. */
export function parseEnum<T extends string>(
  raw: string,
  allowed: readonly T[],
  labels?: Record<T, string>,
): T | null {
  if (!raw) return null;
  const n = normalize(raw);
  for (const v of allowed) {
    if (normalize(v) === n) return v;
    if (labels && normalize(labels[v]) === n) return v;
    // Tolère les codes sans underscore (« EN COURS » ≈ « EN_COURS »).
    if (normalize(v.replace(/_/g, ' ')) === n) return v;
  }
  return null;
}

/** Parse une date FR (JJ/MM/AAAA) ou ISO (AAAA-MM-JJ) → ISO court (AAAA-MM-JJ). */
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // ISO direct (YYYY-MM-DD)
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // FR JJ/MM/AAAA ou JJ-MM-AAAA
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s);
  if (fr) {
    const d = fr[1].padStart(2, '0');
    const m = fr[2].padStart(2, '0');
    let y = fr[3];
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
    return `${y}-${m}-${d}`;
  }
  // Date sérialisée par xlsx (objet Date converti en string)
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/** Parse un nombre tolérant aux séparateurs FR (espace, virgule). */
export function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s| /g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parse un booléen depuis « oui/non », « true/false », « 1/0 », « X »… */
export function parseBoolean(raw: string): boolean {
  const n = normalize(raw);
  return n === 'oui' || n === 'true' || n === '1' || n === 'x' || n === 'vrai';
}

/** Résout un identifiant de dossier par référence (insensible casse). */
export function resolveDossierId(
  raw: string,
  dossiers: ImportContext['dossiers'],
): string | null {
  if (!raw) return null;
  const want = normalize(raw);
  const found = dossiers.find((d) => normalize(d.reference) === want);
  return found?.id ?? null;
}

/** Résout un id de juridiction par libellé. */
export function resolveJuridictionId(
  raw: string,
  juridictions: ImportContext['juridictions'],
): string | null {
  if (!raw) return null;
  const want = normalize(raw);
  const found = juridictions.find((j) => normalize(j.libelle) === want);
  return found?.id ?? null;
}

/** Résout un avocat depuis « Prénom Nom » ou « Nom » (insensible casse). */
export function resolveAvocatId(
  raw: string,
  avocats: ImportContext['avocats'],
): string | null {
  if (!raw) return null;
  const want = normalize(raw);
  const found = avocats.find((a) => {
    const full = `${a.prenom ? `${a.prenom} ` : ''}${a.nom}`;
    return normalize(full) === want || normalize(a.nom) === want;
  });
  return found?.id ?? null;
}

/** Résout un agent depuis « Prénom Nom » ou « Nom » (insensible casse). */
export function resolveAgentId(
  raw: string,
  agents: ImportContext['agents'],
): string | null {
  if (!raw) return null;
  const want = normalize(raw);
  const found = agents.find((a) => {
    const full = `${a.prenom ? `${a.prenom} ` : ''}${a.nom}`;
    return normalize(full) === want || normalize(a.nom) === want;
  });
  return found?.id ?? null;
}