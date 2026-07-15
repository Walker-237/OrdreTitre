import { useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import { formatDate, LBL_ROLE, LBL_SOURCE_AUTH } from '../labels';
import { ROLE, SOURCE_AUTH, type Role, type SourceAuth, type Utilisateur } from '../models';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Pagination, usePagination } from '../components/Pagination';
import { Checkbox, SelectionBar, useRowSelection } from '../components/RowSelection';
import type { UtilisateurInput } from '../data/source';

function emptyUtilisateur(): UtilisateurInput {
  return {
    login: '', nomAffichage: '', email: '',
    role: 'LECTEUR', isActive: true, sourceAuth: 'AD',
  };
}

function UtilisateurForm({
  initial, onSubmit, onCancel, submitting,
}: {
  initial: UtilisateurInput; onSubmit: (v: UtilisateurInput) => void;
  onCancel: () => void; submitting: boolean;
}) {
  const [form, setForm] = useState<UtilisateurInput>(initial);
  const set = <K extends keyof UtilisateurInput>(k: K, v: UtilisateurInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const valid = form.login.trim().length >= 2 && form.email.includes('@') && form.nomAffichage.trim().length >= 2;
  const submit = (e: FormEvent) => { e.preventDefault(); if (valid) onSubmit(form); };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field"><label>Login</label>
          <input required value={form.login} onChange={(e) => set('login', e.target.value)} /></div>
        <div className="field"><label>Nom affiché</label>
          <input required value={form.nomAffichage} onChange={(e) => set('nomAffichage', e.target.value)} /></div>
        <div className="field full"><label>E-mail</label>
          <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="field"><label>Rôle</label>
          <select value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
            {ROLE.map((r) => <option key={r} value={r}>{LBL_ROLE[r]}</option>)}
          </select></div>
        <div className="field"><label>Source d'auth</label>
          <select value={form.sourceAuth} onChange={(e) => set('sourceAuth', e.target.value as SourceAuth)}>
            {SOURCE_AUTH.map((s) => <option key={s} value={s}>{LBL_SOURCE_AUTH[s]}</option>)}
          </select></div>
        <div className="field full"><label>
          <input type="checkbox" checked={form.isActive}
                 onChange={(e) => set('isActive', e.target.checked)} /> Actif
        </label></div>
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

export function Utilisateurs() {
  const {
    utilisateurs, createUtilisateur, updateUtilisateur, deleteUtilisateur, toggleUtilisateurActive,
  } = useStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Utilisateur | null>(null);
  const [deleting, setDeleting] = useState<Utilisateur | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { page, pageSize, pageItems, setPage, setPageSize } = usePagination(utilisateurs);
  const selection = useRowSelection(utilisateurs, (u) => u.id);
  const pageIds = pageItems.map((u) => u.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selection.isSelected(id));
  const someOnPageSelected = !allOnPageSelected && pageIds.some((id) => selection.isSelected(id));

  const onCreate = async (v: UtilisateurInput) => {
    setSubmitting(true);
    try { await createUtilisateur(v); setCreating(false); }
    finally { setSubmitting(false); }
  };
  const onEdit = async (v: UtilisateurInput) => {
    if (!editing) return;
    setSubmitting(true);
    try { await updateUtilisateur(editing.id, v); setEditing(null); }
    finally { setSubmitting(false); }
  };
  const onDelete = async () => {
    if (!deleting) return;
    await deleteUtilisateur(deleting.id);
    setDeleting(null);
  };

  const onBulkDelete = async () => {
    for (const id of selection.selected) await deleteUtilisateur(id);
    selection.clear();
    setBulkDeleting(false);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Utilisateurs</div>
          <div className="page-subtitle">{utilisateurs.length} compte(s) — gestion RBAC</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouvel utilisateur
        </button>
      </div>

      <div className="table-wrap">
        <SelectionBar count={selection.count} label="compte"
                      onDelete={() => setBulkDeleting(true)} onClear={selection.clear} />
        <table className="data">
          <thead>
            <tr>
              <th className="col-check">
                <Checkbox checked={allOnPageSelected} indeterminate={someOnPageSelected}
                          ariaLabel="Tout sélectionner"
                          onChange={() => selection.toggleMany(pageIds, !allOnPageSelected)} />
              </th>
              <th>Nom affiché</th><th>Login</th><th>E-mail</th><th>Rôle</th>
              <th>Source</th><th>Dernière connexion</th><th>Statut</th><th></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((u) => (
              <tr key={u.id}>
                <td className="col-check">
                  <Checkbox checked={selection.isSelected(u.id)}
                            ariaLabel={`Sélectionner ${u.nomAffichage}`}
                            onChange={() => selection.toggle(u.id)} />
                </td>
                <td className="fw-700">{u.nomAffichage}</td>
                <td><code>{u.login}</code></td>
                <td className="muted">{u.email}</td>
                <td><span className="pill black">{LBL_ROLE[u.role]}</span></td>
                <td>{LBL_SOURCE_AUTH[u.sourceAuth]}</td>
                <td className="muted">{u.derniereConnexion ? formatDate(u.derniereConnexion) : '—'}</td>
                <td>
                  {u.isActive ? <span className="pill green">Actif</span> : <span className="pill gray">Inactif</span>}
                </td>
                <td className="text-right">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}>Éditer</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleUtilisateurActive(u.id)}>
                    {u.isActive ? 'Désactiver' : 'Activer'}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                          onClick={() => setDeleting(u)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination total={utilisateurs.length} page={page} pageSize={pageSize}
                    onPageChange={setPage} onPageSizeChange={setPageSize}
                    itemLabel="compte" />
      </div>

      <Modal open={creating} title="Nouvel utilisateur" onClose={() => setCreating(false)}>
        <UtilisateurForm initial={emptyUtilisateur()} onSubmit={onCreate}
                         onCancel={() => setCreating(false)} submitting={submitting} />
      </Modal>
      <Modal open={!!editing} title={`Éditer : ${editing?.nomAffichage ?? ''}`} onClose={() => setEditing(null)}>
        {editing && (
          <UtilisateurForm
            initial={{
              login: editing.login, nomAffichage: editing.nomAffichage,
              email: editing.email, role: editing.role, isActive: editing.isActive,
              sourceAuth: editing.sourceAuth, derniereConnexion: editing.derniereConnexion,
            }}
            onSubmit={onEdit} onCancel={() => setEditing(null)} submitting={submitting}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleting} destructive
        title="Supprimer l'utilisateur"
        message={`Confirmer la suppression de « ${deleting?.nomAffichage ?? ''} » ?`}
        confirmLabel="Supprimer"
        onConfirm={onDelete} onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={bulkDeleting} destructive
        title="Supprimer la sélection"
        message={`Confirmer la suppression de ${selection.count} compte(s) ?`}
        confirmLabel="Supprimer"
        onConfirm={onBulkDelete} onCancel={() => setBulkDeleting(false)}
      />
    </>
  );
}
