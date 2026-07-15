import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import { useAuth } from '../auth';
import { formatDate, formatMontantCourt, LBL_STATUT_PAIEMENT, LBL_TYPE_FRAIS } from '../labels';
import {
  STATUT_PAIEMENT, TYPE_FRAIS,
  type Honoraire, type StatutPaiement, type TypeFrais,
} from '../models';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PiecesSection } from '../components/PiecesSection';
import { Pagination, usePagination } from '../components/Pagination';
import { Checkbox, SelectionBar, useRowSelection } from '../components/RowSelection';
import { SearchableSelect } from '../components/SearchableSelect';
import { ImportDialog } from '../components/ImportDialog';
import { HONORAIRES_IMPORT } from '../lib/imports/honoraires';
import { exportPdf, exportExcel } from '../lib/export';
import { exportHonoraires } from '../lib/reports';
import type { HonoraireInput } from '../data/source';

function emptyHonoraire(dossierId: string, avocatId: string): HonoraireInput {
  return {
    dossierId, avocatId, typeFrais: 'HONORAIRES',
    montantFacture: 0, montantPaye: 0, statutPaiement: 'EN_ATTENTE',
    dateFacture: new Date().toISOString().slice(0, 10),
  };
}

function HonoraireForm({
  initial, dossiers, avocats, onSubmit, onCancel, submitting, editing,
}: {
  initial: HonoraireInput;
  dossiers: { id: string; reference: string }[];
  avocats: { id: string; nom: string; prenom?: string; cabinet: string }[];
  onSubmit: (v: HonoraireInput) => void; onCancel: () => void; submitting: boolean;
  editing?: Honoraire | null;
}) {
  const [form, setForm] = useState<HonoraireInput>(initial);
  const set = <K extends keyof HonoraireInput>(k: K, v: HonoraireInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const valid = !!form.dossierId && !!form.avocatId && form.montantFacture > 0;
  const submit = (e: FormEvent) => { e.preventDefault(); if (valid) onSubmit(form); };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field">
          <label>Dossier</label>
          <SearchableSelect
            required
            value={form.dossierId}
            onChange={(v) => set('dossierId', v)}
            options={dossiers.map((d) => ({ value: d.id, label: d.reference }))}
          />
        </div>
        <div className="field">
          <label>Avocat</label>
          <SearchableSelect
            required
            value={form.avocatId}
            onChange={(v) => set('avocatId', v)}
            options={avocats.map((a) => ({
              value: a.id,
              label: `${a.prenom ? `${a.prenom} ${a.nom}` : a.nom} — ${a.cabinet}`,
            }))}
          />
        </div>
        <div className="field full">
          <label>Référence facture</label>
          <input value={form.referenceFacture ?? ''}
                 onChange={(e) => set('referenceFacture', e.target.value || undefined)} />
        </div>
        <div className="field">
          <label>Type de frais</label>
          <select value={form.typeFrais}
                  onChange={(e) => set('typeFrais', e.target.value as TypeFrais)}>
            {TYPE_FRAIS.map((t) => <option key={t} value={t}>{LBL_TYPE_FRAIS[t]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Statut paiement</label>
          <select value={form.statutPaiement}
                  onChange={(e) => set('statutPaiement', e.target.value as StatutPaiement)}>
            {STATUT_PAIEMENT.map((s) => <option key={s} value={s}>{LBL_STATUT_PAIEMENT[s]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Montant facturé (XAF)</label>
          <input type="number" min={0} required value={form.montantFacture}
                 onChange={(e) => set('montantFacture', Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Montant payé (XAF)</label>
          <input type="number" min={0} value={form.montantPaye}
                 onChange={(e) => set('montantPaye', Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Date facture</label>
          <input type="date" value={form.dateFacture}
                 onChange={(e) => set('dateFacture', e.target.value)} />
        </div>
        <div className="field">
          <label>Date paiement</label>
          <input type="date" value={form.datePaiement ?? ''}
                 onChange={(e) => set('datePaiement', e.target.value || undefined)} />
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
            parentType="HONORAIRE"
            parentId={editing.id}
            pieces={editing.pieces ?? []}
            canEdit
            title="Pièces de la facture"
            description="Facture PDF, justificatifs, bons à payer…"
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

export function Honoraires() {
  const {
    honoraires, dossiers, avocats, juridictions, agents,
    createHonoraire, updateHonoraire, deleteHonoraire,
  } = useStore();
  const { can } = useAuth();
  const canManage = can('gererHonoraires');
  const dossierRefById = new Map(dossiers.map((d) => [d.id, d.reference]));
  const avocatById = new Map(avocats.map((a) => [a.id, a]));
  const [filtre, setFiltre] = useState<'TOUS' | StatutPaiement>('TOUS');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Honoraire | null>(null);
  const [deleting, setDeleting] = useState<Honoraire | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  const liste = useMemo(
    () => honoraires
      .filter((h) => filtre === 'TOUS' || h.statutPaiement === filtre)
      .sort((a, b) => b.dateFacture.localeCompare(a.dateFacture)),
    [honoraires, filtre],
  );
  const { page, pageSize, pageItems, setPage, setPageSize } = usePagination(liste);
  const selection = useRowSelection(liste, (h) => h.id);
  const pageIds = pageItems.map((h) => h.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selection.isSelected(id));
  const someOnPageSelected = !allOnPageSelected && pageIds.some((id) => selection.isSelected(id));

  const totaux = useMemo(() => {
    const facture = honoraires.reduce((s, h) => s + h.montantFacture, 0);
    const paye = honoraires.reduce((s, h) => s + h.montantPaye, 0);
    return { facture, paye, restant: facture - paye };
  }, [honoraires]);

  const onCreate = async (input: HonoraireInput) => {
    setSubmitting(true);
    try { await createHonoraire(input); setCreating(false); }
    finally { setSubmitting(false); }
  };
  const onEdit = async (input: HonoraireInput) => {
    if (!editing) return;
    setSubmitting(true);
    try { await updateHonoraire(editing.id, input); setEditing(null); }
    finally { setSubmitting(false); }
  };
  const onDelete = async () => {
    if (!deleting) return;
    await deleteHonoraire(deleting.id);
    setDeleting(null);
  };

  const onBulkDelete = async () => {
    for (const id of selection.selected) await deleteHonoraire(id);
    selection.clear();
    setBulkDeleting(false);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Honoraires &amp; frais</div>
          <div className="page-subtitle">{liste.length} facture(s)</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => exportPdf(
                    { titre: 'Honoraires & frais', sousTitre: `${liste.length} facture(s)` },
                    exportHonoraires(liste, dossiers, avocats),
                  )}>📄 PDF</button>
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => exportExcel(
                    { titre: 'Honoraires & frais', sousTitre: `${liste.length} facture(s)` },
                    exportHonoraires(liste, dossiers, avocats),
                  )}>📊 Excel</button>
          {canManage && (
            <>
              <button type="button" className="btn btn-ghost btn-sm"
                      onClick={() => setImporting(true)}>📥 Importer</button>
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                + Nouvelle facture
              </button>
            </>
          )}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label">Total facturé</div><div className="kpi-value">{formatMontantCourt(totaux.facture)}</div></div>
        <div className="kpi"><div className="kpi-label">Total payé</div><div className="kpi-value">{formatMontantCourt(totaux.paye)}</div></div>
        <div className="kpi dark"><div className="kpi-label">Restant dû</div><div className="kpi-value">{formatMontantCourt(totaux.restant)}</div></div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="filters">
            <button className={`filter-chip${filtre === 'TOUS' ? ' active' : ''}`}
                    onClick={() => setFiltre('TOUS')} type="button">Tous</button>
            {STATUT_PAIEMENT.map((s) => (
              <button key={s} className={`filter-chip${filtre === s ? ' active' : ''}`}
                      onClick={() => setFiltre(s)} type="button">
                {LBL_STATUT_PAIEMENT[s]}
              </button>
            ))}
          </div>
        </div>

        {canManage && (
          <SelectionBar count={selection.count} label="facture"
                        onDelete={() => setBulkDeleting(true)} onClear={selection.clear} />
        )}

        {liste.length === 0 ? (
          <div className="empty"><div className="em-title">Aucune facture</div></div>
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
                <th>Référence</th>
                <th>Dossier</th>
                <th>Avocat</th>
                <th>Type</th>
                <th>Facturé</th>
                <th>Payé</th>
                <th>Date</th>
                <th>Statut</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((h) => {
                const av = avocatById.get(h.avocatId);
                return (
                  <tr key={h.id}>
                    {canManage && (
                      <td className="col-check">
                        <Checkbox checked={selection.isSelected(h.id)}
                                  ariaLabel={`Sélectionner la facture ${h.referenceFacture ?? h.id}`}
                                  onChange={() => selection.toggle(h.id)} />
                      </td>
                    )}
                    <td><code>{h.referenceFacture ?? h.id}</code></td>
                    <td>
                      <Link to={`/dossiers/${h.dossierId}`} className="row-link">
                        {dossierRefById.get(h.dossierId) ?? h.dossierId}
                      </Link>
                    </td>
                    <td>{av ? `${av.prenom ?? ''} ${av.nom}`.trim() : '—'}</td>
                    <td><span className="pill gray">{LBL_TYPE_FRAIS[h.typeFrais]}</span></td>
                    <td>{formatMontantCourt(h.montantFacture)}</td>
                    <td>{formatMontantCourt(h.montantPaye)}</td>
                    <td className="muted">{formatDate(h.dateFacture)}</td>
                    <td>
                      <span className={`pill ${
                        h.statutPaiement === 'PAYE' ? 'green' :
                        h.statutPaiement === 'REJETE' ? 'red' :
                        h.statutPaiement === 'EN_ATTENTE' ? 'orange' : ''
                      }`}>
                        {LBL_STATUT_PAIEMENT[h.statutPaiement]}
                      </span>
                    </td>
                    {canManage && (
                      <td className="text-right">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(h)}>Éditer</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                                onClick={() => setDeleting(h)}>Supprimer</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination total={liste.length} page={page} pageSize={pageSize}
                    onPageChange={setPage} onPageSizeChange={setPageSize}
                    itemLabel="facture" />
      </div>

      <Modal open={creating} title="Nouvelle facture" onClose={() => setCreating(false)} maxWidth={780}>
        <HonoraireForm
          initial={emptyHonoraire(dossiers[0]?.id ?? '', avocats[0]?.id ?? '')}
          dossiers={dossiers} avocats={avocats}
          onSubmit={onCreate} onCancel={() => setCreating(false)} submitting={submitting}
        />
      </Modal>
      <Modal open={!!editing} title="Éditer la facture" onClose={() => setEditing(null)} maxWidth={780}>
        {editing && (
          <HonoraireForm
            initial={{
              dossierId: editing.dossierId, avocatId: editing.avocatId,
              referenceFacture: editing.referenceFacture, typeFrais: editing.typeFrais,
              montantFacture: editing.montantFacture, montantValide: editing.montantValide,
              montantPaye: editing.montantPaye, statutPaiement: editing.statutPaiement,
              dateFacture: editing.dateFacture, dateValidation: editing.dateValidation,
              datePaiement: editing.datePaiement, validateurId: editing.validateurId,
              pieceJointeUrl: editing.pieceJointeUrl, observations: editing.observations,
            }}
            dossiers={dossiers} avocats={avocats}
            editing={editing}
            onSubmit={onEdit} onCancel={() => setEditing(null)} submitting={submitting}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleting} destructive
        title="Supprimer la facture"
        message={`Confirmer la suppression de la facture ${deleting?.referenceFacture ?? deleting?.id} ?`}
        confirmLabel="Supprimer"
        onConfirm={onDelete} onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={bulkDeleting} destructive
        title="Supprimer la sélection"
        message={`Confirmer la suppression de ${selection.count} facture(s) ?`}
        confirmLabel="Supprimer"
        onConfirm={onBulkDelete} onCancel={() => setBulkDeleting(false)}
      />

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        schema={HONORAIRES_IMPORT}
        context={{ dossiers, juridictions, avocats, agents }}
        onCommit={(input) => createHonoraire(input)}
      />
    </>
  );
}
