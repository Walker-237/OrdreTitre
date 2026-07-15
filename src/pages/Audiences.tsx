import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import { useAuth } from '../auth';
import { formatDate, LBL_ISSUE_AUDIENCE, LBL_STATUT_AUDIENCE, LBL_TYPE_AUDIENCE } from '../labels';
import {
  ISSUE_AUDIENCE, STATUT_AUDIENCE, TYPE_AUDIENCE,
  type Audience, type IssueAudience, type StatutAudience, type TypeAudience,
} from '../models';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PiecesSection } from '../components/PiecesSection';
import { Pagination, usePagination } from '../components/Pagination';
import { Checkbox, SelectionBar, useRowSelection } from '../components/RowSelection';
import { SearchableSelect } from '../components/SearchableSelect';
import { ImportDialog } from '../components/ImportDialog';
import { exportPdf, exportExcel } from '../lib/export';
import { exportAudiences } from '../lib/reports';
import { AUDIENCES_IMPORT } from '../lib/imports/audiences';
import type { AudienceInput } from '../data/source';

function emptyAudience(dossierId: string): AudienceInput {
  return {
    dossierId, date: new Date().toISOString().slice(0, 10), heure: '09:00',
    statut: 'PLANIFIEE', typeAudience: 'FOND', juridiction: '',
    agent: '', objet: '', rappelEnvoye: false,
  };
}

function AudienceForm({
  initial, dossiers, onSubmit, onCancel, submitting, editing,
}: {
  initial: AudienceInput;
  dossiers: { id: string; reference: string; juridiction: string; agent: string }[];
  onSubmit: (v: AudienceInput) => void; onCancel: () => void; submitting: boolean;
  /** Audience existante en cours d'édition (pour exposer la section Pièces). */
  editing?: Audience | null;
}) {
  const [form, setForm] = useState<AudienceInput>(initial);
  const set = <K extends keyof AudienceInput>(k: K, v: AudienceInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Auto-remplit juridiction/agent depuis le dossier sélectionné si vides.
  const onDossierChange = (id: string) => {
    const d = dossiers.find((x) => x.id === id);
    setForm((f) => ({
      ...f, dossierId: id,
      juridiction: f.juridiction || d?.juridiction || '',
      agent: f.agent || d?.agent || '',
    }));
  };

  const valid = form.dossierId && form.date && form.heure && form.objet.trim().length >= 3;
  const submit = (e: FormEvent) => { e.preventDefault(); if (valid) onSubmit(form); };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field full">
          <label>Dossier</label>
          <SearchableSelect
            required
            value={form.dossierId}
            onChange={onDossierChange}
            options={dossiers.map((d) => ({ value: d.id, label: d.reference }))}
          />
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" required value={form.date}
                 onChange={(e) => set('date', e.target.value)} />
        </div>
        <div className="field">
          <label>Heure</label>
          <input type="time" required value={form.heure}
                 onChange={(e) => set('heure', e.target.value)} />
        </div>
        <div className="field">
          <label>Type d'audience</label>
          <select value={form.typeAudience}
                  onChange={(e) => set('typeAudience', e.target.value as TypeAudience)}>
            {TYPE_AUDIENCE.map((t) => <option key={t} value={t}>{LBL_TYPE_AUDIENCE[t]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Statut</label>
          <select value={form.statut}
                  onChange={(e) => set('statut', e.target.value as StatutAudience)}>
            {STATUT_AUDIENCE.map((s) => <option key={s} value={s}>{LBL_STATUT_AUDIENCE[s]}</option>)}
          </select>
        </div>
        <div className="field full">
          <label>Objet</label>
          <input required minLength={3} value={form.objet}
                 onChange={(e) => set('objet', e.target.value)} />
        </div>
        <div className="field">
          <label>Juridiction</label>
          <input value={form.juridiction} onChange={(e) => set('juridiction', e.target.value)} />
        </div>
        <div className="field">
          <label>N° de rôle</label>
          <input value={form.numeroRole ?? ''}
                 onChange={(e) => set('numeroRole', e.target.value || undefined)} />
        </div>
        <div className="field">
          <label>Salle</label>
          <input value={form.salleAudience ?? ''}
                 onChange={(e) => set('salleAudience', e.target.value || undefined)} />
        </div>
        <div className="field">
          <label>Agent référent</label>
          <input value={form.agent} onChange={(e) => set('agent', e.target.value)} />
        </div>
        <div className="field">
          <label>Issue</label>
          <select value={form.issueAudience ?? ''}
                  onChange={(e) => set('issueAudience', (e.target.value || undefined) as IssueAudience | undefined)}>
            <option value="">— Aucune —</option>
            {ISSUE_AUDIENCE.map((i) => <option key={i} value={i}>{LBL_ISSUE_AUDIENCE[i]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>
            <input type="checkbox" checked={form.rappelEnvoye}
                   onChange={(e) => set('rappelEnvoye', e.target.checked)} />
            {' '}Rappel envoyé
          </label>
        </div>
        <div className="field full">
          <label>Compte rendu</label>
          <textarea value={form.compteRendu ?? ''}
                    onChange={(e) => set('compteRendu', e.target.value || undefined)} />
        </div>
      </div>
      {editing && (
        <div className="mt-24">
          <PiecesSection
            parentType="AUDIENCE"
            parentId={editing.id}
            pieces={editing.pieces ?? []}
            canEdit
            title="Pièces de l'audience"
            description="PV d'audience, compte rendu, notes du juriste…"
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

export function Audiences() {
  const {
    audiences, dossiers, juridictions, avocats, agents,
    createAudience, updateAudience, deleteAudience,
  } = useStore();
  const { can } = useAuth();
  const canManage = can('planifierAudience');
  const dossierRefById = new Map(dossiers.map((d) => [d.id, d.reference]));
  const sorted = useMemo(
    () => [...audiences].sort((a, b) => a.date.localeCompare(b.date)),
    [audiences],
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Audience | null>(null);
  const [deleting, setDeleting] = useState<Audience | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const { page, pageSize, pageItems, setPage, setPageSize } = usePagination(sorted);
  const selection = useRowSelection(sorted, (a) => a.id);
  const pageIds = pageItems.map((a) => a.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selection.isSelected(id));
  const someOnPageSelected = !allOnPageSelected && pageIds.some((id) => selection.isSelected(id));

  const onCreate = async (input: AudienceInput) => {
    setSubmitting(true);
    try { await createAudience(input); setCreating(false); }
    finally { setSubmitting(false); }
  };
  const onEdit = async (input: AudienceInput) => {
    if (!editing) return;
    setSubmitting(true);
    try { await updateAudience(editing.id, input); setEditing(null); }
    finally { setSubmitting(false); }
  };
  const onDelete = async () => {
    if (!deleting) return;
    await deleteAudience(deleting.id);
    setDeleting(null);
  };

  const onBulkDelete = async () => {
    for (const id of selection.selected) await deleteAudience(id);
    selection.clear();
    setBulkDeleting(false);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Audiences</div>
          <div className="page-subtitle">{sorted.length} audience(s)</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => exportPdf(
                    { titre: 'Audiences', sousTitre: `${sorted.length} audience(s)` },
                    exportAudiences(sorted, dossiers),
                  )}>📄 PDF</button>
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => exportExcel(
                    { titre: 'Audiences', sousTitre: `${sorted.length} audience(s)` },
                    exportAudiences(sorted, dossiers),
                  )}>📊 Excel</button>
          {canManage && (
            <>
              <button type="button" className="btn btn-ghost btn-sm"
                      onClick={() => setImporting(true)}>📥 Importer</button>
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                + Planifier une audience
              </button>
            </>
          )}
        </div>
      </div>

      <div className="table-wrap">
        {canManage && (
          <SelectionBar count={selection.count} label="audience"
                        onDelete={() => setBulkDeleting(true)} onClear={selection.clear} />
        )}
        <table className="data">
          <thead>
            <tr>
              {canManage && (
                <th className="col-check">
                  <Checkbox checked={allOnPageSelected} indeterminate={someOnPageSelected}
                            ariaLabel="Tout sélectionner"
                            onChange={() => selection.toggleMany(pageIds, !allOnPageSelected)} />
                </th>
              )}
              <th>Date</th>
              <th>Heure</th>
              <th>Dossier</th>
              <th>Type</th>
              <th>Objet</th>
              <th>Juridiction</th>
              <th>Statut</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((a) => (
              <tr key={a.id}>
                {canManage && (
                  <td className="col-check">
                    <Checkbox checked={selection.isSelected(a.id)}
                              ariaLabel={`Sélectionner l'audience du ${a.date}`}
                              onChange={() => selection.toggle(a.id)} />
                  </td>
                )}
                <td>{formatDate(a.date)}</td>
                <td>{a.heure}</td>
                <td>
                  <Link to={`/dossiers/${a.dossierId}`} className="row-link">
                    {dossierRefById.get(a.dossierId) ?? a.dossierId}
                  </Link>
                </td>
                <td><span className="pill gray">{LBL_TYPE_AUDIENCE[a.typeAudience]}</span></td>
                <td className="muted">{a.objet}</td>
                <td className="muted">{a.juridiction}</td>
                <td><span className="pill">{LBL_STATUT_AUDIENCE[a.statut]}</span></td>
                {canManage && (
                  <td className="text-right">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(a)}>Éditer</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                            onClick={() => setDeleting(a)}>Supprimer</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination total={sorted.length} page={page} pageSize={pageSize}
                    onPageChange={setPage} onPageSizeChange={setPageSize}
                    itemLabel="audience" />
      </div>

      <Modal open={creating} title="Planifier une audience" onClose={() => setCreating(false)} maxWidth={820}>
        <AudienceForm
          initial={emptyAudience(dossiers[0]?.id ?? '')}
          dossiers={dossiers}
          onSubmit={onCreate} onCancel={() => setCreating(false)} submitting={submitting}
        />
      </Modal>
      <Modal open={!!editing} title="Éditer l'audience" onClose={() => setEditing(null)} maxWidth={820}>
        {editing && (
          <AudienceForm
            initial={{
              dossierId: editing.dossierId, date: editing.date, heure: editing.heure,
              dateTenueEffective: editing.dateTenueEffective, statut: editing.statut,
              typeAudience: editing.typeAudience, juridictionId: editing.juridictionId,
              juridiction: editing.juridiction, numeroRole: editing.numeroRole,
              salleAudience: editing.salleAudience, agentId: editing.agentId,
              agent: editing.agent, avocatId: editing.avocatId, objet: editing.objet,
              compteRendu: editing.compteRendu, issueAudience: editing.issueAudience,
              dateRenvoi: editing.dateRenvoi, piecesDeposees: editing.piecesDeposees,
              rappelEnvoye: editing.rappelEnvoye,
            }}
            editing={editing}
            dossiers={dossiers}
            onSubmit={onEdit} onCancel={() => setEditing(null)} submitting={submitting}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleting} destructive
        title="Supprimer l'audience"
        message={`Confirmer la suppression de l'audience du ${formatDate(deleting?.date)} ?`}
        confirmLabel="Supprimer"
        onConfirm={onDelete} onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={bulkDeleting} destructive
        title="Supprimer la sélection"
        message={`Confirmer la suppression de ${selection.count} audience(s) ?`}
        confirmLabel="Supprimer"
        onConfirm={onBulkDelete} onCancel={() => setBulkDeleting(false)}
      />

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        schema={AUDIENCES_IMPORT}
        context={{ dossiers, juridictions, avocats, agents }}
        onCommit={(input) => createAudience(input)}
      />
    </>
  );
}
