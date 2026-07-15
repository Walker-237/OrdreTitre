import { useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import { useAuth } from '../auth';
import { formatDate, LBL_NATURE } from '../labels';
import {
  NATURE_PROCEDURE, type JurisprudenceEntry, type NatureProcedure,
} from '../models';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PiecesSection } from '../components/PiecesSection';
import { Pagination, usePagination } from '../components/Pagination';
import { Checkbox, SelectionBar, useRowSelection } from '../components/RowSelection';
import { exportPdf, exportExcel } from '../lib/export';
import { rapportJurisprudenceInterne } from '../lib/reports';
import type { JurisprudenceInput } from '../data/source';

function emptyEntry(): JurisprudenceInput {
  return {
    reference: '', date: new Date().toISOString().slice(0, 10),
    juridiction: '', matiere: 'COMMERCIALE',
    resume: '', motsCles: [], isPubliable: true,
  };
}

function JurisprudenceForm({
  initial, onSubmit, onCancel, submitting, editing,
}: {
  initial: JurisprudenceInput;
  onSubmit: (v: JurisprudenceInput) => void; onCancel: () => void; submitting: boolean;
  editing?: JurisprudenceEntry | null;
}) {
  const [form, setForm] = useState<JurisprudenceInput>(initial);
  const [motsStr, setMotsStr] = useState(initial.motsCles.join(', '));
  const set = <K extends keyof JurisprudenceInput>(k: K, v: JurisprudenceInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const valid = form.reference.trim().length >= 3 && form.resume.trim().length >= 10;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSubmit({ ...form, motsCles: motsStr.split(',').map((s) => s.trim()).filter(Boolean) });
  };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field"><label>Référence</label>
          <input required value={form.reference} onChange={(e) => set('reference', e.target.value)} /></div>
        <div className="field"><label>Date</label>
          <input type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div className="field"><label>Juridiction</label>
          <input value={form.juridiction} onChange={(e) => set('juridiction', e.target.value)} /></div>
        <div className="field"><label>Matière</label>
          <select value={form.matiere}
                  onChange={(e) => set('matiere', e.target.value as NatureProcedure)}>
            {NATURE_PROCEDURE.map((n) => <option key={n} value={n}>{LBL_NATURE[n]}</option>)}
          </select></div>
        <div className="field full"><label>Titre</label>
          <input value={form.titre ?? ''} onChange={(e) => set('titre', e.target.value || undefined)} /></div>
        <div className="field full"><label>Résumé</label>
          <textarea required minLength={10} value={form.resume}
                    onChange={(e) => set('resume', e.target.value)} /></div>
        <div className="field full"><label>Dispositif</label>
          <textarea value={form.dispositif ?? ''}
                    onChange={(e) => set('dispositif', e.target.value || undefined)} /></div>
        <div className="field full"><label>Mots-clés (séparés par virgules)</label>
          <input value={motsStr} onChange={(e) => setMotsStr(e.target.value)} /></div>
        <div className="field full"><label>
          <input type="checkbox" checked={form.isPubliable}
                 onChange={(e) => set('isPubliable', e.target.checked)} /> Publiable
        </label></div>
      </div>
      {editing && (
        <div className="mt-24">
          <PiecesSection
            parentType="JURISPRUDENCE"
            parentId={editing.id}
            pieces={editing.pieces ?? []}
            canEdit
            title="Pièces de la décision"
            description="Arrêt PDF, annotations doctrinales, doctrine liée…"
          />
        </div>
      )}
      <div className="row mt-24" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={!valid || submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

export function Jurisprudence() {
  const { jurisprudence, createJurisprudence, updateJurisprudence, deleteJurisprudence } = useStore();
  const { can } = useAuth();
  const canManage = can('modifierDossier'); // Pas de permission dédiée
  const [filtre, setFiltre] = useState<'TOUS' | NatureProcedure>('TOUS');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<JurisprudenceEntry | null>(null);
  const [deleting, setDeleting] = useState<JurisprudenceEntry | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const liste = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jurisprudence.filter((j) => {
      if (filtre !== 'TOUS' && j.matiere !== filtre) return false;
      if (!q) return true;
      return (
        j.reference.toLowerCase().includes(q) ||
        (j.titre ?? '').toLowerCase().includes(q) ||
        j.resume.toLowerCase().includes(q) ||
        j.motsCles.some((m) => m.toLowerCase().includes(q))
      );
    });
  }, [jurisprudence, filtre, query]);
  const { page, pageSize, pageItems, setPage, setPageSize } = usePagination(liste, 10);
  const selection = useRowSelection(liste, (j) => j.id);
  const pageIds = pageItems.map((j) => j.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selection.isSelected(id));
  const someOnPageSelected = !allOnPageSelected && pageIds.some((id) => selection.isSelected(id));

  const onCreate = async (v: JurisprudenceInput) => {
    setSubmitting(true);
    try { await createJurisprudence(v); setCreating(false); }
    finally { setSubmitting(false); }
  };
  const onEdit = async (v: JurisprudenceInput) => {
    if (!editing) return;
    setSubmitting(true);
    try { await updateJurisprudence(editing.id, v); setEditing(null); }
    finally { setSubmitting(false); }
  };
  const onDelete = async () => {
    if (!deleting) return;
    await deleteJurisprudence(deleting.id);
    setDeleting(null);
  };

  const onBulkDelete = async () => {
    for (const id of selection.selected) await deleteJurisprudence(id);
    selection.clear();
    setBulkDeleting(false);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Jurisprudence</div>
          <div className="page-subtitle">{liste.length} décision(s) référencée(s)</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => exportPdf(
                    { titre: 'Jurisprudence interne', sousTitre: `${liste.length} décision(s)` },
                    rapportJurisprudenceInterne(liste),
                  )}>📄 PDF</button>
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => exportExcel(
                    { titre: 'Jurisprudence interne', sousTitre: `${liste.length} décision(s)` },
                    rapportJurisprudenceInterne(liste),
                  )}>📊 Excel</button>
          {canManage && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + Ajouter une décision
            </button>
          )}
        </div>
      </div>

      <div className="row mb-20 wrap" style={{ gap: 8 }}>
        <button className={`filter-chip${filtre === 'TOUS' ? ' active' : ''}`}
                onClick={() => setFiltre('TOUS')} type="button">Toutes matières</button>
        {NATURE_PROCEDURE.map((n) => (
          <button key={n} className={`filter-chip${filtre === n ? ' active' : ''}`}
                  onClick={() => setFiltre(n)} type="button">{LBL_NATURE[n]}</button>
        ))}
        <input type="search" placeholder="Rechercher…"
               value={query} onChange={(e) => setQuery(e.target.value)}
               style={{ height: 32, padding: '0 12px', border: '1px solid var(--gray-300)',
                        borderRadius: 8, fontSize: 13, minWidth: 240, marginLeft: 'auto' }} />
      </div>

      {liste.length === 0 ? (
        <div className="empty"><div className="em-title">Aucune décision trouvée</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {canManage && selection.count > 0 && (
            <div className="table-wrap" style={{ borderRadius: 14 }}>
              <SelectionBar count={selection.count} label="décision"
                            onDelete={() => setBulkDeleting(true)} onClear={selection.clear} />
            </div>
          )}
          {canManage && selection.count === 0 && (
            <div className="row" style={{ gap: 8 }}>
              <Checkbox checked={allOnPageSelected} indeterminate={someOnPageSelected}
                        ariaLabel="Tout sélectionner"
                        onChange={() => selection.toggleMany(pageIds, !allOnPageSelected)} />
              <span className="muted" style={{ fontSize: 12 }}>Tout sélectionner sur cette page</span>
            </div>
          )}
          {pageItems.map((j) => (
            <div key={j.id} className="card">
              <div className="row between mb-12">
                <div className="row" style={{ gap: 10 }}>
                  {canManage && (
                    <Checkbox checked={selection.isSelected(j.id)}
                              ariaLabel={`Sélectionner ${j.reference}`}
                              onChange={() => selection.toggle(j.id)} />
                  )}
                  <div>
                    <div className="fw-700" style={{ fontSize: 15 }}>{j.titre ?? j.reference}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      <code>{j.reference}</code> · {j.juridiction} · {formatDate(j.date)}
                    </div>
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <span className="pill gray">{LBL_NATURE[j.matiere]}</span>
                  {canManage && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(j)}>Éditer</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                              onClick={() => setDeleting(j)}>Supprimer</button>
                    </>
                  )}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{j.resume}</p>
              {j.dispositif && (
                <p className="muted mt-8" style={{ fontSize: 12, fontStyle: 'italic' }}>
                  Dispositif : {j.dispositif}
                </p>
              )}
              {j.motsCles.length > 0 && (
                <div className="row wrap mt-8" style={{ gap: 4 }}>
                  {j.motsCles.map((m) => (
                    <span key={m} className="pill" style={{ fontSize: 10 }}>{m}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="table-wrap" style={{ borderRadius: 14, marginTop: 4 }}>
            <Pagination total={liste.length} page={page} pageSize={pageSize}
                        onPageChange={setPage} onPageSizeChange={setPageSize}
                        itemLabel="décision" />
          </div>
        </div>
      )}

      <Modal open={creating} title="Ajouter une décision" onClose={() => setCreating(false)} maxWidth={760}>
        <JurisprudenceForm initial={emptyEntry()} onSubmit={onCreate}
                           onCancel={() => setCreating(false)} submitting={submitting} />
      </Modal>
      <Modal open={!!editing} title="Éditer la décision" onClose={() => setEditing(null)} maxWidth={760}>
        {editing && (
          <JurisprudenceForm
            initial={{
              delibereId: editing.delibereId, dossierId: editing.dossierId,
              juridictionId: editing.juridictionId, reference: editing.reference,
              date: editing.date, juridiction: editing.juridiction, matiere: editing.matiere,
              titre: editing.titre, resume: editing.resume, dispositif: editing.dispositif,
              motsCles: editing.motsCles, annotations: editing.annotations,
              fichierUrl: editing.fichierUrl, isPubliable: editing.isPubliable,
              createdBy: editing.createdBy,
            }}
            editing={editing}
            onSubmit={onEdit} onCancel={() => setEditing(null)} submitting={submitting}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleting} destructive
        title="Supprimer la décision"
        message={`Confirmer la suppression de « ${deleting?.reference ?? ''} » ?`}
        confirmLabel="Supprimer"
        onConfirm={onDelete} onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={bulkDeleting} destructive
        title="Supprimer la sélection"
        message={`Confirmer la suppression de ${selection.count} décision(s) ?`}
        confirmLabel="Supprimer"
        onConfirm={onBulkDelete} onCancel={() => setBulkDeleting(false)}
      />
    </>
  );
}
