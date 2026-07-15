import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import { useAuth } from '../auth';
import {
  formatDate, formatMontantCourt,
  LBL_RESULTAT_DELIBERE, LBL_STATUT_DELIBERE, LBL_VOIE_RECOURS,
} from '../labels';
import {
  RESULTAT_DELIBERE, STATUT_DELIBERE, VOIE_RECOURS,
  type Delibere, type ResultatDelibere, type StatutDelibere, type VoieRecours,
} from '../models';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PiecesSection } from '../components/PiecesSection';
import { Pagination, usePagination } from '../components/Pagination';
import { Checkbox, SelectionBar, useRowSelection } from '../components/RowSelection';
import { SearchableSelect } from '../components/SearchableSelect';
import { ImportDialog } from '../components/ImportDialog';
import { DELIBERES_IMPORT } from '../lib/imports/deliberes';
import { exportPdf, exportExcel } from '../lib/export';
import { exportDeliberes } from '../lib/reports';
import type { DelibereInput } from '../data/source';

function emptyDelibere(dossierId: string): DelibereInput {
  return {
    dossierId, dateDelibere: new Date().toISOString().slice(0, 10),
    statut: 'EN_ATTENTE', voiesRecours: [], recoursExerce: false, grosseLevee: false,
  };
}

function DelibereForm({
  initial, dossiers, onSubmit, onCancel, submitting, editing,
}: {
  initial: DelibereInput;
  dossiers: { id: string; reference: string }[];
  onSubmit: (v: DelibereInput) => void; onCancel: () => void; submitting: boolean;
  editing?: Delibere | null;
}) {
  const [form, setForm] = useState<DelibereInput>(initial);
  const set = <K extends keyof DelibereInput>(k: K, v: DelibereInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleVoie = (v: VoieRecours) => {
    setForm((f) => ({
      ...f,
      voiesRecours: f.voiesRecours.includes(v)
        ? f.voiesRecours.filter((x) => x !== v)
        : [...f.voiesRecours, v],
    }));
  };

  const valid = !!form.dossierId && !!form.dateDelibere;
  const submit = (e: FormEvent) => { e.preventDefault(); if (valid) onSubmit(form); };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field full">
          <label>Dossier</label>
          <SearchableSelect
            required
            value={form.dossierId}
            onChange={(v) => set('dossierId', v)}
            options={dossiers.map((d) => ({ value: d.id, label: d.reference }))}
          />
        </div>
        <div className="field">
          <label>Date prévue</label>
          <input type="date" required value={form.dateDelibere}
                 onChange={(e) => set('dateDelibere', e.target.value)} />
        </div>
        <div className="field">
          <label>Date effective</label>
          <input type="date" value={form.dateDelibereEffectif ?? ''}
                 onChange={(e) => set('dateDelibereEffectif', e.target.value || undefined)} />
        </div>
        <div className="field">
          <label>Statut</label>
          <select value={form.statut}
                  onChange={(e) => set('statut', e.target.value as StatutDelibere)}>
            {STATUT_DELIBERE.map((s) => <option key={s} value={s}>{LBL_STATUT_DELIBERE[s]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Résultat</label>
          <select value={form.resultat ?? ''}
                  onChange={(e) => set('resultat', (e.target.value || undefined) as ResultatDelibere | undefined)}>
            <option value="">— Aucun —</option>
            {RESULTAT_DELIBERE.map((r) => <option key={r} value={r}>{LBL_RESULTAT_DELIBERE[r]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Montant accordé</label>
          <input type="number" min={0} value={form.montantAccorde ?? ''}
                 onChange={(e) => set('montantAccorde', e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div className="field">
          <label>Montant condamné</label>
          <input type="number" min={0} value={form.montantCondamne ?? ''}
                 onChange={(e) => set('montantCondamne', e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div className="field full">
          <label>Voies de recours possibles</label>
          <div className="row wrap" style={{ gap: 6 }}>
            {VOIE_RECOURS.map((v) => (
              <button key={v} type="button"
                      className={`filter-chip${form.voiesRecours.includes(v) ? ' active' : ''}`}
                      onClick={() => toggleVoie(v)}>
                {LBL_VOIE_RECOURS[v]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>
            <input type="checkbox" checked={form.recoursExerce}
                   onChange={(e) => set('recoursExerce', e.target.checked)} />
            {' '}Recours exercé
          </label>
        </div>
        <div className="field">
          <label>
            <input type="checkbox" checked={form.grosseLevee}
                   onChange={(e) => set('grosseLevee', e.target.checked)} />
            {' '}Grosse levée
          </label>
        </div>
        <div className="field full">
          <label>Dispositif / décision</label>
          <textarea value={form.dispositif ?? ''}
                    onChange={(e) => set('dispositif', e.target.value || undefined)} />
        </div>
        <div className="field full">
          <label>Observations</label>
          <textarea value={form.observations ?? ''}
                    onChange={(e) => set('observations', e.target.value || undefined)} />
        </div>
      </div>
      {editing && (
        <div className="mt-24">
          <PiecesSection
            parentType="DELIBERE"
            parentId={editing.id}
            pieces={editing.pieces ?? []}
            canEdit
            title="Pièces du délibéré"
            description="Décision, jugement, grosse, actes d'appel…"
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

export function Deliberes() {
  const {
    deliberes, dossiers, juridictions, avocats, agents,
    createDelibere, updateDelibere, deleteDelibere,
  } = useStore();
  const { can } = useAuth();
  const canManage = can('enregistrerDelibere');
  const dossierRefById = new Map(dossiers.map((d) => [d.id, d.reference]));
  const [filtre, setFiltre] = useState<'TOUS' | StatutDelibere>('TOUS');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Delibere | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  // Toujours relire le délibéré en cours d'édition depuis le store pour que
  // l'ajout/suppression d'une pièce rafraîchisse la section PiecesSection.
  const editing = editingId ? deliberes.find((d) => d.id === editingId) ?? null : null;

  const liste = useMemo(
    () => deliberes
      .filter((d) => filtre === 'TOUS' || d.statut === filtre)
      .sort((a, b) => b.dateDelibere.localeCompare(a.dateDelibere)),
    [deliberes, filtre],
  );
  const { page, pageSize, pageItems, setPage, setPageSize } = usePagination(liste);
  const selection = useRowSelection(liste, (d) => d.id);
  const pageIds = pageItems.map((d) => d.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selection.isSelected(id));
  const someOnPageSelected = !allOnPageSelected && pageIds.some((id) => selection.isSelected(id));

  const onCreate = async (input: DelibereInput) => {
    setSubmitting(true);
    try { await createDelibere(input); setCreating(false); }
    finally { setSubmitting(false); }
  };
  const onEdit = async (input: DelibereInput) => {
    if (!editing) return;
    setSubmitting(true);
    try { await updateDelibere(editing.id, input); setEditingId(null); }
    finally { setSubmitting(false); }
  };
  const onDelete = async () => {
    if (!deleting) return;
    await deleteDelibere(deleting.id);
    setDeleting(null);
  };

  const onBulkDelete = async () => {
    for (const id of selection.selected) await deleteDelibere(id);
    selection.clear();
    setBulkDeleting(false);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Délibérés</div>
          <div className="page-subtitle">{liste.length} délibéré(s) — suivi des décisions de justice</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => exportPdf(
                    { titre: 'Délibérés', sousTitre: `${liste.length} délibéré(s)` },
                    exportDeliberes(liste, dossiers),
                  )}>📄 PDF</button>
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => exportExcel(
                    { titre: 'Délibérés', sousTitre: `${liste.length} délibéré(s)` },
                    exportDeliberes(liste, dossiers),
                  )}>📊 Excel</button>
          {canManage && (
            <>
              <button type="button" className="btn btn-ghost btn-sm"
                      onClick={() => setImporting(true)}>📥 Importer</button>
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                + Enregistrer un délibéré
              </button>
            </>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="filters">
            <button className={`filter-chip${filtre === 'TOUS' ? ' active' : ''}`}
                    onClick={() => setFiltre('TOUS')} type="button">Tous</button>
            {STATUT_DELIBERE.map((s) => (
              <button key={s} className={`filter-chip${filtre === s ? ' active' : ''}`}
                      onClick={() => setFiltre(s)} type="button">
                {LBL_STATUT_DELIBERE[s]}
              </button>
            ))}
          </div>
        </div>

        {canManage && (
          <SelectionBar count={selection.count} label="délibéré"
                        onDelete={() => setBulkDeleting(true)} onClear={selection.clear} />
        )}

        {liste.length === 0 ? (
          <div className="empty"><div className="em-title">Aucun délibéré</div></div>
        ) : (
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
                <th>Dossier</th>
                <th>Statut</th>
                <th>Résultat</th>
                <th>Montant</th>
                <th>Voies de recours</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((d) => (
                <tr key={d.id}>
                  {canManage && (
                    <td className="col-check">
                      <Checkbox checked={selection.isSelected(d.id)}
                                ariaLabel={`Sélectionner le délibéré du ${d.dateDelibere}`}
                                onChange={() => selection.toggle(d.id)} />
                    </td>
                  )}
                  <td>{formatDate(d.dateDelibere)}</td>
                  <td>
                    <Link to={`/dossiers/${d.dossierId}`} className="row-link">
                      {dossierRefById.get(d.dossierId) ?? d.dossierId}
                    </Link>
                  </td>
                  <td><span className="pill">{LBL_STATUT_DELIBERE[d.statut]}</span></td>
                  <td>
                    {d.resultat ? (
                      <span className={`pill ${
                        d.resultat === 'FAVORABLE' ? 'green' :
                        d.resultat === 'DEFAVORABLE' ? 'red' : 'orange'
                      }`}>
                        {LBL_RESULTAT_DELIBERE[d.resultat]}
                      </span>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td>{d.montantAccorde != null ? formatMontantCourt(d.montantAccorde) : '—'}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {d.voiesRecours.length === 0 ? '—' : d.voiesRecours.map((v) => LBL_VOIE_RECOURS[v]).join(', ')}
                  </td>
                  {canManage && (
                    <td className="text-right">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(d.id)}>Éditer</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                              onClick={() => setDeleting(d)}>Supprimer</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination total={liste.length} page={page} pageSize={pageSize}
                    onPageChange={setPage} onPageSizeChange={setPageSize}
                    itemLabel="délibéré" />
      </div>

      <Modal open={creating} title="Enregistrer un délibéré" onClose={() => setCreating(false)} maxWidth={780}>
        <DelibereForm
          initial={emptyDelibere(dossiers[0]?.id ?? '')}
          dossiers={dossiers}
          onSubmit={onCreate} onCancel={() => setCreating(false)} submitting={submitting}
        />
      </Modal>
      <Modal open={!!editing} title="Éditer le délibéré" onClose={() => setEditingId(null)} maxWidth={780}>
        {editing && (
          <DelibereForm
            initial={{
              dossierId: editing.dossierId, audienceOrigineId: editing.audienceOrigineId,
              dateDelibere: editing.dateDelibere,
              dateDelibereEffectif: editing.dateDelibereEffectif,
              statut: editing.statut, resultat: editing.resultat,
              dispositif: editing.dispositif, decision: editing.decision,
              montantAccorde: editing.montantAccorde, montantCondamne: editing.montantCondamne,
              voiesRecours: editing.voiesRecours, dateLimiteRecours: editing.dateLimiteRecours,
              recoursExerce: editing.recoursExerce, typeRecoursExerce: editing.typeRecoursExerce,
              dateExerciceRecours: editing.dateExerciceRecours,
              grosseLevee: editing.grosseLevee, dateLeveeGrosse: editing.dateLeveeGrosse,
              agentSuiviId: editing.agentSuiviId, observations: editing.observations,
            }}
            dossiers={dossiers}
            editing={editing}
            onSubmit={onEdit} onCancel={() => setEditingId(null)} submitting={submitting}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleting} destructive
        title="Supprimer le délibéré"
        message={`Confirmer la suppression du délibéré du ${formatDate(deleting?.dateDelibere)} ?`}
        confirmLabel="Supprimer"
        onConfirm={onDelete} onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={bulkDeleting} destructive
        title="Supprimer la sélection"
        message={`Confirmer la suppression de ${selection.count} délibéré(s) ?`}
        confirmLabel="Supprimer"
        onConfirm={onBulkDelete} onCancel={() => setBulkDeleting(false)}
      />

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        schema={DELIBERES_IMPORT}
        context={{ dossiers, juridictions, avocats, agents }}
        onCommit={(input) => createDelibere(input)}
      />
    </>
  );
}
