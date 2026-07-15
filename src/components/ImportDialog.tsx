/**
 * Boîte de dialogue d'import générique — pilote un schéma `ImportSchema<T>` :
 *  1. Téléchargement du modèle XLSX (en-têtes + 1 ligne d'exemple + notice).
 *  2. Choix d'un fichier CSV ou XLSX.
 *  3. Parsing + validation ligne par ligne, affichage des erreurs.
 *  4. Création en masse via la fonction `onCommit(input)` passée par la page.
 *
 * Le parent fournit son propre `parseRow` (via le schéma) ; ce composant ne
 * connaît aucun champ métier — il se contente d'orchestrer.
 */
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Modal } from './Modal';
import { downloadTemplate, parseFile } from '../lib/import';
import type { ImportContext, ImportSchema } from '../lib/imports/common';

interface ImportDialogProps<T> {
  open: boolean;
  onClose: () => void;
  schema: ImportSchema<T>;
  context: ImportContext;
  /** Crée une entité dans la source. Renvoie une promesse résolue/rejetée. */
  onCommit: (input: T) => Promise<unknown>;
  /** Appelée une fois l'import terminé (succès partiel ou total). */
  onDone?: (counts: { ok: number; failed: number }) => void;
}

interface RowState<T> {
  index: number;
  raw: Record<string, string>;
  input: T | null;
  errors: string[];
  status: 'pending' | 'ok' | 'failed';
  failReason?: string;
}

export function ImportDialog<T>({
  open, onClose, schema, context, onCommit, onDone,
}: ImportDialogProps<T>) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [rows, setRows] = useState<RowState<T>[]>([]);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const valid = rows.filter((r) => r.errors.length === 0).length;
    const invalid = rows.length - valid;
    const ok = rows.filter((r) => r.status === 'ok').length;
    const failed = rows.filter((r) => r.status === 'failed').length;
    return { total: rows.length, valid, invalid, ok, failed };
  }, [rows]);

  function reset() {
    setRows([]); setFilename(''); setGlobalError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFilename(file.name);
    setRows([]); setGlobalError(null); setParsing(true);
    try {
      const parsed = await parseFile(file);
      if (parsed.rows.length === 0) {
        setGlobalError('Aucune ligne de données détectée dans le fichier.');
        return;
      }
      const next: RowState<T>[] = parsed.rows.map((raw, i) => {
        const { input, errors } = schema.parseRow(raw, context);
        return { index: i + 2, raw, input, errors, status: 'pending' };
      });
      setRows(next);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
    }
  }

  async function onImport() {
    if (committing) return;
    setCommitting(true);
    // Itération séquentielle : reste lisible pour l'utilisateur et garde
    // l'ordre du fichier en cas d'erreurs intermittentes côté backend.
    const next = [...rows];
    for (let i = 0; i < next.length; i++) {
      const r = next[i];
      if (r.errors.length > 0 || !r.input) continue;
      if (r.status === 'ok') continue;
      try {
        await onCommit(r.input);
        next[i] = { ...r, status: 'ok' };
      } catch (err) {
        next[i] = {
          ...r, status: 'failed',
          failReason: err instanceof Error ? err.message : String(err),
        };
      }
      setRows([...next]);
    }
    setCommitting(false);
    onDone?.({
      ok: next.filter((r) => r.status === 'ok').length,
      failed: next.filter((r) => r.status === 'failed').length,
    });
  }

  function close() {
    if (committing) return;
    reset();
    onClose();
  }

  return (
    <Modal open={open} title={`Importer des ${schema.entityLabel.toLowerCase()}`}
           onClose={close} maxWidth={920}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="fw-700" style={{ fontSize: 14, marginBottom: 4 }}>
              1. Téléchargez le modèle
            </div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Un fichier Excel avec les colonnes attendues, une ligne d'exemple
              et un onglet « Notice » détaillant chaque champ.
            </div>
            <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => downloadTemplate({
                      filename: schema.templateFilename,
                      sheetName: schema.entityLabel,
                      columns: schema.columns,
                    })}>
              📥 Télécharger le modèle (.xlsx)
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <div className="fw-700" style={{ fontSize: 14, marginBottom: 4 }}>
              2. Importez le fichier rempli
            </div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Formats acceptés : <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>.
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={onPickFile}
              style={{ display: 'none' }}
            />
            <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => fileInputRef.current?.click()} disabled={parsing}>
              📂 {parsing ? 'Analyse…' : (filename ? 'Changer de fichier' : 'Choisir un fichier')}
            </button>
            {filename && (
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                <code>{filename}</code>
              </div>
            )}
          </div>
        </div>

        {globalError && (
          <div className="pill red" style={{ display: 'block', padding: '8px 12px', whiteSpace: 'normal' }}>
            {globalError}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
              <span className="pill gray">{stats.total} ligne(s)</span>
              <span className="pill green">{stats.valid} valide(s)</span>
              {stats.invalid > 0 && <span className="pill red">{stats.invalid} en erreur</span>}
              {stats.ok > 0 && <span className="pill black">{stats.ok} importée(s)</span>}
              {stats.failed > 0 && <span className="pill red">{stats.failed} échec(s)</span>}
            </div>

            <div className="table-wrap" style={{ maxHeight: 320, overflow: 'auto' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Ligne</th>
                    <th style={{ width: 110 }}>État</th>
                    <th>Erreurs / aperçu</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const ok = r.errors.length === 0;
                    const pill =
                      r.status === 'ok'      ? <span className="pill green">Importé</span>
                      : r.status === 'failed' ? <span className="pill red">Échec</span>
                      : ok                    ? <span className="pill gray">Prêt</span>
                      :                         <span className="pill red">Erreur</span>;
                    return (
                      <tr key={r.index}>
                        <td className="muted">{r.index}</td>
                        <td>{pill}</td>
                        <td style={{ fontSize: 12 }}>
                          {r.errors.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--red)' }}>
                              {r.errors.map((er, i) => <li key={i}>{er}</li>)}
                            </ul>
                          ) : r.status === 'failed' ? (
                            <span style={{ color: 'var(--red)' }}>
                              {r.failReason ?? 'Échec lors de la création'}
                            </span>
                          ) : (
                            <span className="muted">
                              {previewLine(r.raw)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={close} disabled={committing}>
            Fermer
          </button>
          <button type="button" className="btn btn-primary"
                  disabled={stats.valid === 0 || committing}
                  onClick={onImport}>
            {committing
              ? `Import en cours… (${stats.ok}/${stats.valid})`
              : `Importer ${stats.valid} ligne(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Aperçu condensé d'une ligne — 3 premières colonnes non vides. */
function previewLine(raw: Record<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(raw)) {
    if (!v) continue;
    parts.push(`${k}: ${v}`);
    if (parts.length >= 3) break;
  }
  return parts.join(' · ') || '—';
}
