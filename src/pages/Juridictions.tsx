import { useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import { useAuth } from '../auth';
import { LBL_NIVEAU_JURIDICTION, LBL_TYPE_JURIDICTION } from '../labels';
import {
  NIVEAU_JURIDICTION, TYPE_JURIDICTION,
  type Juridiction, type NiveauJuridiction, type TypeJuridiction,
} from '../models';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Pagination, usePagination } from '../components/Pagination';
import { Checkbox, SelectionBar, useRowSelection } from '../components/RowSelection';
import { ImportDialog } from '../components/ImportDialog';
import { JURIDICTIONS_IMPORT } from '../lib/imports/juridictions';
import type { JuridictionInput } from '../data/source';

function emptyForm(): JuridictionInput {
  return {
    libelle: '', typeJuridiction: 'TRIBUNAL_PREMIERE_INSTANCE',
    niveau: 'PREMIER_DEGRE', ville: '', pays: 'CM', isActive: true,
  };
}

function JuridictionForm({
  initial, onSubmit, onCancel, submitting,
}: {
  initial: JuridictionInput; onSubmit: (v: JuridictionInput) => void;
  onCancel: () => void; submitting: boolean;
}) {
  const [form, setForm] = useState<JuridictionInput>(initial);
  const set = <K extends keyof JuridictionInput>(k: K, v: JuridictionInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const valid = form.libelle.trim().length >= 3 && form.ville.trim().length >= 2;

  const submit = (e: FormEvent) => { e.preventDefault(); if (valid) onSubmit(form); };

  return (
    <form id="juridiction-form" onSubmit={submit}>
      <div className="form-grid">
        <div className="field full">
          <label>Libellé</label>
          <input required minLength={3} value={form.libelle}
                 onChange={(e) => set('libelle', e.target.value)} />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={form.typeJuridiction}
                  onChange={(e) => set('typeJuridiction', e.target.value as TypeJuridiction)}>
            {TYPE_JURIDICTION.map((t) => <option key={t} value={t}>{LBL_TYPE_JURIDICTION[t]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Niveau</label>
          <select value={form.niveau}
                  onChange={(e) => set('niveau', e.target.value as NiveauJuridiction)}>
            {NIVEAU_JURIDICTION.map((n) => <option key={n} value={n}>{LBL_NIVEAU_JURIDICTION[n]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Ville</label>
          <input required value={form.ville} onChange={(e) => set('ville', e.target.value)} />
        </div>
        <div className="field">
          <label>Pays (ISO)</label>
          <input maxLength={2} value={form.pays}
                 onChange={(e) => set('pays', e.target.value.toUpperCase())} />
        </div>
        <div className="field">
          <label>E-mail du greffe</label>
          <input type="email" value={form.emailGreffe ?? ''}
                 onChange={(e) => set('emailGreffe', e.target.value || undefined)} />
        </div>
        <div className="field">
          <label>Téléphone</label>
          <input value={form.telephone ?? ''}
                 onChange={(e) => set('telephone', e.target.value || undefined)} />
        </div>
        <div className="field full">
          <label>
            <input type="checkbox" checked={form.isActive}
                   onChange={(e) => set('isActive', e.target.checked)} />
            {' '}Active
          </label>
        </div>
      </div>
      <div className="row mt-24" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={!valid || submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

export function Juridictions() {
  const {
    juridictions, dossiers, avocats, agents,
    createJuridiction, updateJuridiction, deleteJuridiction,
  } = useStore();
  const { can } = useAuth();
  const canManage = can('modifierDossier'); // Pas de permission dédiée — réutilise modifierDossier
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Juridiction | null>(null);
  const [deleting, setDeleting] = useState<Juridiction | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const { page, pageSize, pageItems, setPage, setPageSize } = usePagination(juridictions);
  const selection = useRowSelection(juridictions, (j) => j.id);
  const pageIds = pageItems.map((j) => j.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selection.isSelected(id));
  const someOnPageSelected = !allOnPageSelected && pageIds.some((id) => selection.isSelected(id));

  const onCreate = async (input: JuridictionInput) => {
    setSubmitting(true);
    try { await createJuridiction(input); setCreating(false); }
    finally { setSubmitting(false); }
  };
  const onEdit = async (input: JuridictionInput) => {
    if (!editing) return;
    setSubmitting(true);
    try { await updateJuridiction(editing.id, input); setEditing(null); }
    finally { setSubmitting(false); }
  };
  const onDelete = async () => {
    if (!deleting) return;
    await deleteJuridiction(deleting.id);
    setDeleting(null);
  };

  const onBulkDelete = async () => {
    for (const id of selection.selected) await deleteJuridiction(id);
    selection.clear();
    setBulkDeleting(false);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Juridictions</div>
          <div className="page-subtitle">{juridictions.length} juridiction(s) référencée(s)</div>
        </div>
        {canManage && (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => setImporting(true)}>📥 Importer</button>
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              + Nouvelle juridiction
            </button>
          </div>
        )}
      </div>

      <div className="table-wrap">
        {canManage && (
          <SelectionBar count={selection.count} label="juridiction"
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
              <th>Libellé</th>
              <th>Type</th>
              <th>Niveau</th>
              <th>Ville</th>
              <th>Pays</th>
              <th>Greffe</th>
              <th>Statut</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((j) => (
              <tr key={j.id}>
                {canManage && (
                  <td className="col-check">
                    <Checkbox checked={selection.isSelected(j.id)}
                              ariaLabel={`Sélectionner ${j.libelle}`}
                              onChange={() => selection.toggle(j.id)} />
                  </td>
                )}
                <td className="fw-700">{j.libelle}</td>
                <td><span className="pill gray">{LBL_TYPE_JURIDICTION[j.typeJuridiction]}</span></td>
                <td>{LBL_NIVEAU_JURIDICTION[j.niveau]}</td>
                <td>{j.ville}</td>
                <td className="muted">{j.pays}</td>
                <td className="muted">{j.emailGreffe ?? j.telephone ?? '—'}</td>
                <td>
                  {j.isActive ? <span className="pill green">Active</span> : <span className="pill gray">Inactive</span>}
                </td>
                {canManage && (
                  <td className="text-right">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(j)}>Éditer</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                            onClick={() => setDeleting(j)}>Supprimer</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination total={juridictions.length} page={page} pageSize={pageSize}
                    onPageChange={setPage} onPageSizeChange={setPageSize}
                    itemLabel="juridiction" />
      </div>

      <Modal open={creating} title="Nouvelle juridiction" onClose={() => setCreating(false)}>
        <JuridictionForm initial={emptyForm()} onSubmit={onCreate}
                         onCancel={() => setCreating(false)} submitting={submitting} />
      </Modal>
      <Modal open={!!editing} title={`Éditer : ${editing?.libelle ?? ''}`} onClose={() => setEditing(null)}>
        {editing && (
          <JuridictionForm
            initial={{
              libelle: editing.libelle, typeJuridiction: editing.typeJuridiction,
              niveau: editing.niveau, ville: editing.ville, pays: editing.pays,
              adresse: editing.adresse, telephone: editing.telephone,
              emailGreffe: editing.emailGreffe, isActive: editing.isActive, notes: editing.notes,
            }}
            onSubmit={onEdit} onCancel={() => setEditing(null)} submitting={submitting}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleting} destructive
        title="Supprimer la juridiction"
        message={`Confirmer la suppression de « ${deleting?.libelle ?? ''} » ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={onDelete} onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={bulkDeleting} destructive
        title="Supprimer la sélection"
        message={`Confirmer la suppression de ${selection.count} juridiction(s) ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={onBulkDelete} onCancel={() => setBulkDeleting(false)}
      />

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        schema={JURIDICTIONS_IMPORT}
        context={{ dossiers, juridictions, avocats, agents }}
        onCommit={(input) => createJuridiction(input)}
      />
    </>
  );
}
