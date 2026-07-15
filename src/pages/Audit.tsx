import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { LBL_AUDIT_ACTION } from '../labels';
import { AUDIT_ACTION, type AuditAction } from '../models';
import { Pagination, usePagination } from '../components/Pagination';

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function Audit() {
  const { audit } = useStore();
  const [filtre, setFiltre] = useState<'TOUS' | AuditAction>('TOUS');
  const [filterEntite, setFilterEntite] = useState<string>('TOUS');

  const entiteOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of audit) set.add(a.entiteCible);
    return Array.from(set).sort();
  }, [audit]);

  const entries = useMemo(
    () => audit
      .filter((e) => filtre === 'TOUS' || e.action === filtre)
      .filter((e) => filterEntite === 'TOUS' || e.entiteCible === filterEntite)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [audit, filtre, filterEntite],
  );
  const { page, pageSize, pageItems, setPage, setPageSize } = usePagination(entries, 50);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">
            Journal d'audit{' '}
            <span className="pill black" style={{ marginLeft: 8, verticalAlign: 'middle' }}>
              🔒 Table verrouillée
            </span>
          </div>
          <div className="page-subtitle">
            {entries.length} entrée(s) — traçabilité <strong>immuable et append-only</strong>.
            Chaque création / modification / suppression dans l'app génère automatiquement
            une entrée. Aucune méthode ne permet de modifier ou supprimer une entrée
            existante (cf. <code>src/data/source.ts</code> — pas de <code>updateAudit</code>
            / <code>deleteAudit</code> exposé).
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="filters">
            <button className={`filter-chip${filtre === 'TOUS' ? ' active' : ''}`}
                    onClick={() => setFiltre('TOUS')} type="button">Toutes actions</button>
            {AUDIT_ACTION.map((a) => (
              <button key={a} className={`filter-chip${filtre === a ? ' active' : ''}`}
                      onClick={() => setFiltre(a)} type="button">
                {LBL_AUDIT_ACTION[a]}
              </button>
            ))}
          </div>
          <select className="filter-chip"
                  value={filterEntite}
                  onChange={(e) => setFilterEntite(e.target.value)}>
            <option value="TOUS">Toutes entités</option>
            {entiteOptions.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {entries.length === 0 ? (
          <div className="empty"><div className="em-title">Aucune entrée d'audit</div></div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Horodatage</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Entité cible</th>
                <th>Identifiant</th>
                <th>Détail (avant → après)</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((e) => (
                <tr key={e.id}>
                  <td className="muted">{formatTs(e.timestamp)}</td>
                  <td><code>{e.utilisateurLogin}</code></td>
                  <td>
                    <span className={`pill ${
                      e.action === 'DELETE' ? 'red' :
                      e.action === 'CREATE' ? 'green' :
                      e.action === 'LOGIN' || e.action === 'LOGOUT' ? 'black' : 'gray'
                    }`}>
                      {LBL_AUDIT_ACTION[e.action]}
                    </span>
                  </td>
                  <td className="muted">{e.entiteCible}</td>
                  <td><code style={{ fontSize: 10 }}>{e.idEntiteCible}</code></td>
                  <td className="muted" style={{ fontSize: 11, maxWidth: 380, wordBreak: 'break-all' }}>
                    {e.valeurAvant && (<>
                      <span style={{ color: 'var(--red)' }}>↩ </span>
                      <code style={{ fontSize: 10 }}>{e.valeurAvant}</code>
                      <br />
                    </>)}
                    {e.valeurApres && (<>
                      <span style={{ color: '#0a7a39' }}>↪ </span>
                      <code style={{ fontSize: 10 }}>{e.valeurApres}</code>
                    </>)}
                    {!e.valeurAvant && !e.valeurApres && <span>—</span>}
                  </td>
                  <td className="muted" style={{ fontSize: 11 }}>{e.ipAdresse ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination total={entries.length} page={page} pageSize={pageSize}
                    onPageChange={setPage} onPageSizeChange={setPageSize}
                    itemLabel="entrée" />
      </div>
    </>
  );
}
