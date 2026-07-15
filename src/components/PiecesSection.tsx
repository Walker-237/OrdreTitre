/**
 * Section réutilisable de pièces jointes — affichage + upload + suppression.
 *
 * Branchée sur les mutations `addEntityPiece` / `removeEntityPiece` du store
 * pour pouvoir alimenter dossiers, audiences, délibérés, honoraires,
 * jurisprudence et avocats sans dupliquer la logique.
 *
 * Pré-requis : l'entité parente DOIT déjà avoir un id en BD (les pièces
 * embarquées ont besoin d'une clé étrangère). Pour les créations multi-étapes,
 * passer `disabled={true}` avec une légende explicative.
 */
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { LBL_TYPE_DOCUMENT, tailleHumaine } from '../labels';
import {
  TYPE_DOCUMENT,
  type Piece, type PieceParentType, type TypeDocument,
} from '../models';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { useStore } from '../data/store';
import {
  ACCEPT_ATTRIBUTE, FileValidationError, MAX_FILE_SIZE,
  guessTypeDocument, isAudioMime, isImageMime, readFileAsDataUrl,
  type UploadedFile,
} from '../lib/upload';

export function PiecePreview({ piece }: { piece: Piece }) {
  if (isImageMime(piece.mimeType) && piece.fichierUrl) {
    return (
      <img src={piece.fichierUrl} alt={piece.libelle}
           style={{ width: 56, height: 56, objectFit: 'cover',
                    borderRadius: 4, border: '1px solid var(--gray-200)' }} />
    );
  }
  if (isAudioMime(piece.mimeType) && piece.fichierUrl) {
    return <audio controls src={piece.fichierUrl} style={{ height: 32, maxWidth: 200 }} />;
  }
  const icon =
    piece.mimeType === 'application/pdf' ? '📄' :
    (piece.mimeType?.includes('spreadsheet') || piece.mimeType?.includes('excel')) ? '📊' : '📎';
  return <span style={{ fontSize: 28 }}>{icon}</span>;
}

interface PieceFormProps {
  onSubmit: (input: Omit<Piece, 'id' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

export function PieceForm({ onSubmit, onCancel, submitting }: PieceFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [libelle, setLibelle] = useState('');
  const [typeDocument, setTypeDocument] = useState<TypeDocument>('AUTRE');
  const [dateDocument, setDateDocument] = useState('');
  const [estConfidentiel, setEstConfidentiel] = useState(false);
  const [error, setError] = useState('');

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const up = await readFileAsDataUrl(file);
      setUploaded(up);
      setLibelle((prev) => prev || file.name);
      setTypeDocument(guessTypeDocument(file.name));
    } catch (err) {
      setError(err instanceof FileValidationError ? err.message : String(err));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!uploaded || !libelle.trim()) return;
    await onSubmit({
      libelle: libelle.trim(),
      typeDocument,
      dateDocument: dateDocument || undefined,
      fichierNom: uploaded.fichierNom,
      fichierUrl: uploaded.dataUrl,
      mimeType: uploaded.mimeType,
      tailleOctets: uploaded.tailleOctets,
      estConfidentiel,
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="field full mb-12">
        <label>Fichier</label>
        <input ref={fileInputRef} type="file" accept={ACCEPT_ATTRIBUTE}
               style={{ display: 'none' }} onChange={onPick} />
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="btn btn-ghost"
                  onClick={() => fileInputRef.current?.click()}>
            📎 {uploaded ? 'Changer de fichier' : 'Choisir un fichier'}
          </button>
          {uploaded && (
            <div className="muted" style={{ fontSize: 12 }}>
              <code>{uploaded.fichierNom}</code> · {tailleHumaine(uploaded.tailleOctets)}
            </div>
          )}
        </div>
        <div className="hint">
          PDF, JPEG, PNG, GIF, audio, Excel — max {MAX_FILE_SIZE / 1024 / 1024} Mo.
        </div>
      </div>

      {error && (
        <div className="pill red mb-12"
             style={{ display: 'block', padding: '8px 12px', whiteSpace: 'normal' }}>
          {error}
        </div>
      )}

      <div className="form-grid">
        <div className="field full"><label>Libellé</label>
          <input required value={libelle} onChange={(e) => setLibelle(e.target.value)} /></div>
        <div className="field"><label>Type de document</label>
          <select value={typeDocument}
                  onChange={(e) => setTypeDocument(e.target.value as TypeDocument)}>
            {TYPE_DOCUMENT.map((t) => <option key={t} value={t}>{LBL_TYPE_DOCUMENT[t]}</option>)}
          </select></div>
        <div className="field"><label>Date du document</label>
          <input type="date" value={dateDocument} onChange={(e) => setDateDocument(e.target.value)} /></div>
        <div className="field full"><label>
          <input type="checkbox" checked={estConfidentiel}
                 onChange={(e) => setEstConfidentiel(e.target.checked)} />
          {' '}Pièce confidentielle
        </label></div>
      </div>

      <div className="row mt-24" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary"
                disabled={!uploaded || !libelle.trim() || submitting}>
          {submitting ? 'Ajout…' : 'Ajouter la pièce'}
        </button>
      </div>
    </form>
  );
}

interface PiecesSectionProps {
  parentType: PieceParentType;
  parentId: string;
  pieces: Piece[];
  canEdit: boolean;
  /** Titre du bloc (défaut « Pièces jointes »). */
  title?: string;
  /** Légende informative sous le titre. */
  description?: string;
  /** Si true, désactive l'ajout/suppression (mais affiche la liste). */
  disabled?: boolean;
  /** Message affiché quand `disabled === true`. */
  disabledHint?: string;
}

export function PiecesSection({
  parentType, parentId, pieces, canEdit,
  title = 'Pièces jointes',
  description,
  disabled = false,
  disabledHint,
}: PiecesSectionProps) {
  const { addEntityPiece, removeEntityPiece } = useStore();
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Piece | null>(null);

  const onAdd = async (input: Omit<Piece, 'id' | 'createdAt'>) => {
    setSubmitting(true);
    try {
      await addEntityPiece(parentType, parentId, input);
      setAdding(false);
    } finally {
      setSubmitting(false);
    }
  };
  const onRemove = async () => {
    if (!deleting?.id) return;
    await removeEntityPiece(parentType, parentId, deleting.id);
    setDeleting(null);
  };

  return (
    <div className="card mb-20">
      <div className="card-header" style={{ padding: 0, marginBottom: 12, border: 'none' }}>
        <div>
          <div className="card-title" style={{ margin: 0 }}>
            {title} ({pieces.length})
          </div>
          {description && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{description}</div>}
        </div>
        {canEdit && !disabled && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
            + Ajouter une pièce
          </button>
        )}
      </div>

      {disabled && disabledHint && (
        <div className="hint" style={{ marginBottom: 10 }}>{disabledHint}</div>
      )}

      {pieces.length === 0 ? (
        <div className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>
          Aucune pièce.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Aperçu</th>
                <th>Libellé</th>
                <th>Type</th>
                <th>Fichier</th>
                <th>Taille</th>
                <th>Conf.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pieces.map((p, i) => (
                <tr key={p.id ?? i}>
                  <td><PiecePreview piece={p} /></td>
                  <td className="fw-700">{p.libelle}</td>
                  <td><span className="pill gray">{LBL_TYPE_DOCUMENT[p.typeDocument]}</span></td>
                  <td className="muted"><code style={{ fontSize: 10 }}>{p.fichierNom}</code></td>
                  <td>{tailleHumaine(p.tailleOctets)}</td>
                  <td>
                    {p.estConfidentiel
                      ? <span className="pill red">🔒</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                    {p.fichierUrl && (
                      <a className="btn btn-ghost btn-sm" href={p.fichierUrl}
                         download={p.fichierNom}>⬇</a>
                    )}
                    {canEdit && !disabled && (
                      <button type="button" className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--red)' }}
                              onClick={() => setDeleting(p)}>✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={adding} title={`Ajouter une pièce — ${title}`}
             onClose={() => setAdding(false)} maxWidth={620}>
        <PieceForm onSubmit={onAdd} onCancel={() => setAdding(false)} submitting={submitting} />
      </Modal>
      <ConfirmDialog
        open={!!deleting} destructive
        title="Supprimer la pièce"
        message={`Confirmer la suppression de la pièce « ${deleting?.libelle ?? ''} » (${deleting?.fichierNom ?? ''}) ?`}
        confirmLabel="Supprimer"
        onConfirm={onRemove} onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
