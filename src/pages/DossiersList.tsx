import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import { useAuth } from '../auth';
import { formatMontantCourt, formatDate, LBL_STATUT_DOSSIER, LBL_NATURE, LBL_RISQUE } from '../labels';
import type { Dossier, StatutDossier } from '../models';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Pagination, usePagination } from '../components/Pagination';
import { Checkbox, SelectionBar, useRowSelection } from '../components/RowSelection';
import { ImportDialog } from '../components/ImportDialog';
import { exportPdf, exportExcel } from '../lib/export';
import { exportDossiers } from '../lib/reports';
import { DOSSIERS_IMPORT } from '../lib/imports/dossiers';

const STATUTS: StatutDossier[] = ['OUVERT', 'EN_COURS', 'DELIBERE', 'CLOTURE', 'ARCHIVE'];

export function DossiersList() {
  const {
    dossiers, deleteDossier, createDossier,
    juridictions, avocats, agents,
  } = useStore();
  const { can } = useAuth();
  const [filtre, setFiltre] = useState<'TOUS' | StatutDossier>('TOUS');
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<Dossier | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [importing, setImporting] = useState(false);

  const liste = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dossiers.filter((d) => {
      if (filtre !== 'TOUS' && d.statut !== filtre) return false;
      if (!q) return true;
      return (
        d.reference.toLowerCase().includes(q) ||
        d.intitule.toLowerCase().includes(q) ||
        d.juridiction.toLowerCase().includes(q)
      );
    });
  }, [dossiers, filtre, query]);

  const canDelete = can('archiverDossier');
  const { page, pageSize, pageItems, setPage, setPageSize } = usePagination(liste);
  const selection = useRowSelection(liste, (d) => d.id);
  const pageIds = pageItems.map((d) => d.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selection.isSelected(id));
  const someOnPageSelected = !allOnPageSelected && pageIds.some((id) => selection.isSelected(id));

  const onDelete = async () => {
    if (!deleting) return;
    await deleteDossier(deleting.id);
    setDeleting(null);
  };

  const onBulkDelete = async () => {
    for (const id of selection.selected) await deleteDossier(id);
    selection.clear();
    setBulkDeleting(false);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Dossiers judiciaires</div>
          <div className="page-subtitle">{liste.length} dossier(s) affiché(s)</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => exportPdf(
                    { titre: 'Dossiers judiciaires', sousTitre: `${liste.length} dossier(s)` },
                    exportDossiers(liste),
                  )}>📄 PDF</button>
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => exportExcel(
                    { titre: 'Dossiers judiciaires', sousTitre: `${liste.length} dossier(s)` },
                    exportDossiers(liste),
                  )}>📊 Excel</button>
          {can('creerDossier') && (
            <>
              <button type="button" className="btn btn-ghost btn-sm"
                      onClick={() => setImporting(true)}>📥 Importer</button>
              <Link to="/dossiers/nouveau" className="btn btn-primary">+ Nouveau dossier</Link>
            </>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="filters">
            <button className={`filter-chip${filtre === 'TOUS' ? ' active' : ''}`}
                    onClick={() => setFiltre('TOUS')} type="button">Tous</button>
            {STATUTS.map((s) => (
              <button key={s} className={`filter-chip${filtre === s ? ' active' : ''}`}
                      onClick={() => setFiltre(s)} type="button">
                {LBL_STATUT_DOSSIER[s]}
              </button>
            ))}
          </div>
          <input type="search" placeholder="Rechercher (référence, intitulé, juridiction)…"
                 value={query} onChange={(e) => setQuery(e.target.value)}
                 style={{ height: 32, padding: '0 12px', border: '1px solid var(--gray-300)',
                          borderRadius: 8, fontSize: 13, minWidth: 280 }} />
        </div>

        {canDelete && (
          <SelectionBar count={selection.count} label="dossier"
                        onDelete={() => setBulkDeleting(true)} onClear={selection.clear} />
        )}

        {liste.length === 0 ? (
          <div className="empty">
            <div className="em-title">Aucun dossier</div>
            <div>Ajustez le filtre ou la recherche.</div>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                {canDelete && (
                  <th className="col-check">
                    <Checkbox checked={allOnPageSelected} indeterminate={someOnPageSelected}
                              ariaLabel="Tout sélectionner"
                              onChange={() => selection.toggleMany(pageIds, !allOnPageSelected)} />
                  </th>
                )}
                <th>Référence</th>
                <th>Intitulé</th>
                <th>Nature</th>
                <th>Juridiction</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Risque</th>
                <th>Échéance</th>
                {canDelete && <th></th>}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((d) => (
                <tr key={d.id}>
                  {canDelete && (
                    <td className="col-check">
                      <Checkbox checked={selection.isSelected(d.id)}
                                ariaLabel={`Sélectionner ${d.reference}`}
                                onChange={() => selection.toggle(d.id)} />
                    </td>
                  )}
                  <td>
                    <Link to={`/dossiers/${d.id}`} className="row-link">{d.reference}</Link>
                  </td>
                  <td>
                    <div className="fw-700">{d.intitule}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{d.sousNature}</div>
                  </td>
                  <td>{LBL_NATURE[d.nature]}</td>
                  <td className="muted">{d.juridiction}</td>
                  <td>{formatMontantCourt(d.montantEnJeu, d.devise)}</td>
                  <td><span className="pill">{LBL_STATUT_DOSSIER[d.statut]}</span></td>
                  <td>
                    <span className={`pill ${d.risque === 'ELEVE' ? 'red' : d.risque === 'MOYEN' ? 'orange' : 'green'}`}>
                      {LBL_RISQUE[d.risque]}
                    </span>
                  </td>
                  <td className="muted">{formatDate(d.prochaineEcheance)}</td>
                  {canDelete && (
                    <td className="text-right">
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
                    itemLabel="dossier" />
      </div>

      <ConfirmDialog
        open={!!deleting} destructive
        title="Supprimer le dossier"
        message={`Confirmer la suppression de ${deleting?.reference ?? ''} ? Les audiences, délibérés et honoraires liés seront également supprimés.`}
        confirmLabel="Supprimer"
        onConfirm={onDelete} onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={bulkDeleting} destructive
        title="Supprimer la sélection"
        message={`Confirmer la suppression de ${selection.count} dossier(s) ? Les audiences, délibérés et honoraires liés seront également supprimés.`}
        confirmLabel="Supprimer"
        onConfirm={onBulkDelete} onCancel={() => setBulkDeleting(false)}
      />

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        schema={DOSSIERS_IMPORT}
        context={{ dossiers, juridictions, avocats, agents }}
        onCommit={(input) => createDossier(input)}
      />
    </>
  );
}
