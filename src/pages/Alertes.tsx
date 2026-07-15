import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import { formatDate, LBL_CANAL_ALERTE, LBL_STATUT_ALERTE, LBL_TYPE_ALERTE } from '../labels';
import type { Alerte, Severity, TypeAlerte } from '../models';
import { Pagination, usePagination } from '../components/Pagination';
import { NotifyDialog } from '../components/NotifyDialog';
import { buildRecipientCandidates, composeAlerteEmail } from '../lib/notify';
import { createNotification } from '../data/notifications';

const SEVERITY_LABEL: Record<Severity, string> = { high: 'Haute', medium: 'Moyenne', low: 'Basse' };
const SEVERITY_PILL: Record<Severity, string> = {
  high: 'red', medium: 'orange', low: 'gray',
};

const ICON_BY_TYPE: Record<TypeAlerte, string> = {
  RAPPEL_AUDIENCE: '⚖',
  DELAI_RECOURS: '⏳',
  DOSSIER_INCOMPLET: '📂',
  FRAIS_A_PAYER: '💶',
  DELIBERE_ATTENDU: '⏰',
  CHARGE_AVOCAT: '👤',
  INACTIVITE_DOSSIER: '🌙',
  AUTRE: '🔔',
};

export function Alertes() {
  const {
    alertes, regles, dossiers, agents, avocats, utilisateurs,
    markAlerteAsRead, dismissAlerte, toggleRegle, resetAlertes,
  } = useStore();
  const [filtreSev, setFiltreSev] = useState<'TOUS' | Severity>('TOUS');
  const [hideRead, setHideRead] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [notifying, setNotifying] = useState<Alerte | null>(null);

  // Contexte de notification pour l'alerte ouverte (dossier + contacts).
  const notifyData = useMemo(() => {
    if (!notifying) return null;
    const dossier = notifying.dossierId
      ? dossiers.find((d) => d.id === notifying.dossierId) ?? null
      : null;
    const candidates = buildRecipientCandidates({ dossier, agents, avocats, utilisateurs });
    const { subject, body } = composeAlerteEmail(notifying, dossier);
    return { candidates, subject, body };
  }, [notifying, dossiers, agents, avocats, utilisateurs]);

  const liste = useMemo(() => alertes.filter((a) => {
    if (filtreSev !== 'TOUS' && a.severity !== filtreSev) return false;
    if (hideRead && a.statut === 'LUE') return false;
    return true;
  }), [alertes, filtreSev, hideRead]);
  const { page, pageSize, pageItems, setPage, setPageSize } = usePagination(liste, 10);

  const byType = useMemo(() => {
    const m = new Map<TypeAlerte, number>();
    for (const a of alertes) m.set(a.typeAlerte, (m.get(a.typeAlerte) ?? 0) + 1);
    return m;
  }, [alertes]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Alertes &amp; rappels</div>
          <div className="page-subtitle">
            {alertes.length} alerte(s) — dérivées en continu des dossiers, audiences,
            délibérés, honoraires et avocats.
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowConfig((v) => !v)}>
            {showConfig ? '✕ Fermer config' : '⚙ Configurer les règles'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={resetAlertes}>
            Réinitialiser
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="card mb-20">
          <div className="card-title">Règles d'alerte</div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
            Active ou désactive chaque déclencheur. Les préférences sont conservées
            localement dans le navigateur.
          </p>
          <table className="data">
            <thead>
              <tr>
                <th></th><th>Déclencheur</th><th>Type</th><th>Alertes actives</th><th></th>
              </tr>
            </thead>
            <tbody>
              {regles.map((r) => (
                <tr key={r.type}>
                  <td>{ICON_BY_TYPE[r.type]}</td>
                  <td>
                    <div className="fw-700">{LBL_TYPE_ALERTE[r.type]}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{r.declencheur}</div>
                  </td>
                  <td><code style={{ fontSize: 10 }}>{r.type}</code></td>
                  <td>{byType.get(r.type) ?? 0}</td>
                  <td className="text-right">
                    <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={r.actif}
                             onChange={() => toggleRegle(r.type)} />
                      {r.actif ? 'Activée' : 'Désactivée'}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row mb-20 wrap" style={{ gap: 8 }}>
        <button className={`filter-chip${filtreSev === 'TOUS' ? ' active' : ''}`}
                onClick={() => setFiltreSev('TOUS')} type="button">Toutes</button>
        {(['high', 'medium', 'low'] as Severity[]).map((s) => (
          <button key={s} className={`filter-chip${filtreSev === s ? ' active' : ''}`}
                  onClick={() => setFiltreSev(s)} type="button">
            Sévérité {SEVERITY_LABEL[s].toLowerCase()}
          </button>
        ))}
        <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input type="checkbox" checked={hideRead} onChange={(e) => setHideRead(e.target.checked)} />
          Masquer les alertes lues
        </label>
      </div>

      {liste.length === 0 ? (
        <div className="empty">
          <div className="em-title">Aucune alerte</div>
          <div>Soit tout est sous contrôle, soit toutes les règles correspondantes sont désactivées.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pageItems.map((a) => {
            const borderColor =
              a.severity === 'high' ? 'var(--red)' :
              a.severity === 'medium' ? 'var(--black)' : 'var(--gray-400)';
            const isRead = a.statut === 'LUE';
            return (
              <div key={a.id} className="card"
                   style={{ borderLeft: `4px solid ${borderColor}`, opacity: isRead ? 0.65 : 1 }}>
                <div className="row between">
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{ICON_BY_TYPE[a.typeAlerte]}</span>
                    <div className="fw-700">{a.title}</div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`pill ${SEVERITY_PILL[a.severity]}`}>
                      {SEVERITY_LABEL[a.severity]}
                    </span>
                    <span className={`pill ${isRead ? 'gray' : ''}`}>
                      {LBL_STATUT_ALERTE[a.statut]}
                    </span>
                  </div>
                </div>
                <div className="muted mt-8" style={{ fontSize: 12 }}>
                  {LBL_TYPE_ALERTE[a.typeAlerte]}
                  {a.dossier !== '—' && (
                    <>
                      {' · '}
                      {a.dossierId
                        ? <Link to={`/dossiers/${a.dossierId}`} className="row-link">{a.dossier}</Link>
                        : <span>{a.dossier}</span>}
                    </>
                  )}
                  {' · échéance '}{formatDate(a.due)}
                </div>
                <div className="mt-8" style={{ fontSize: 13 }}>{a.desc}</div>
                <div className="row between mt-8" style={{ alignItems: 'center' }}>
                  <div className="muted" style={{ fontSize: 11 }}>
                    Canaux : {a.canaux.map((c) => LBL_CANAL_ALERTE[c]).join(', ')}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setNotifying(a)}>
                      📧 Notifier
                    </button>
                    {!isRead && (
                      <button className="btn btn-ghost btn-sm" onClick={() => markAlerteAsRead(a.id)}>
                        ✓ Marquer comme lue
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                            onClick={() => dismissAlerte(a.id)}>
                      ✕ Écarter
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="table-wrap" style={{ borderRadius: 14 }}>
            <Pagination total={liste.length} page={page} pageSize={pageSize}
                        onPageChange={setPage} onPageSizeChange={setPageSize}
                        itemLabel="alerte" />
          </div>
        </div>
      )}

      {notifyData && (
        <NotifyDialog
          open={!!notifying}
          onClose={() => setNotifying(null)}
          title="Notifier cette alerte"
          candidates={notifyData.candidates}
          initialSubject={notifyData.subject}
          initialBody={notifyData.body}
          onSent={(draft) => {
            if (!notifying) return;
            // Trace persistante de la notification envoyée (liste SharePoint).
            void createNotification({
              type: notifying.typeAlerte,
              severity: notifying.severity,
              titre: notifying.title,
              message: notifying.desc,
              dossierId: notifying.dossierId,
              destinataireId: notifying.destinataireId,
              destinataireEmail: draft.to[0],
              canal: 'EMAIL',
              dateEnvoi: new Date().toISOString(),
            });
          }}
        />
      )}
    </>
  );
}
