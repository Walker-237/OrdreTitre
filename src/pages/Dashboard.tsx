import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import { formatMontantCourt, formatDate, LBL_STATUT_DOSSIER } from '../labels';
import { useAuth } from '../auth';

/** Tableau de bord — vue d'ensemble pour le rôle courant. */
export function Dashboard() {
  const { dossiers, audiences, deliberes, alertes } = useStore();
  const { user } = useAuth();

  const stats = useMemo(() => {
    const actifs = dossiers.filter((d) => d.statut !== 'CLOTURE' && d.statut !== 'ARCHIVE');
    const upcoming = audiences
      .filter((a) => a.statut === 'PLANIFIEE')
      .sort((a, b) => a.date.localeCompare(b.date));
    const deliberesAttendus = deliberes.filter((d) => d.statut === 'EN_ATTENTE');
    const montantEnJeu = actifs.reduce((s, d) => s + d.montantEnJeu, 0);
    return { actifs, upcoming, deliberesAttendus, montantEnJeu };
  }, [dossiers, audiences, deliberes]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Bonjour {user.nomAffichage.split(' ')[0] || user.login}</div>
          <div className="page-subtitle">Vue d'ensemble des dossiers, audiences et délibérés en cours</div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Dossiers actifs</div>
          <div className="kpi-value">{stats.actifs.length}</div>
          <div className="kpi-trend">sur {dossiers.length} au total</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Audiences planifiées</div>
          <div className="kpi-value">{stats.upcoming.length}</div>
          <div className="kpi-trend">
            {stats.upcoming[0] ? `Prochaine : ${formatDate(stats.upcoming[0].date)}` : 'aucune'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Délibérés attendus</div>
          <div className="kpi-value">{stats.deliberesAttendus.length}</div>
          <div className="kpi-trend">à suivre</div>
        </div>
        <div className="kpi dark">
          <div className="kpi-label">Montant en jeu (actifs)</div>
          <div className="kpi-value">{formatMontantCourt(stats.montantEnJeu)}</div>
          <div className="kpi-trend">tous dossiers actifs cumulés</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
        <div className="card">
          <div className="card-title row between">
            <span>Dossiers récents</span>
            <Link to="/dossiers" className="btn btn-ghost btn-sm">Tout voir</Link>
          </div>
          {dossiers.length === 0 ? (
            <div className="empty">Aucun dossier.</div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Intitulé</th>
                  <th>Statut</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {dossiers.slice(0, 6).map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link to={`/dossiers/${d.id}`} className="row-link">{d.reference}</Link>
                    </td>
                    <td className="muted">{d.intitule}</td>
                    <td><span className="pill">{LBL_STATUT_DOSSIER[d.statut]}</span></td>
                    <td>{formatMontantCourt(d.montantEnJeu, d.devise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-title">Prochaines audiences</div>
          {stats.upcoming.length === 0 ? (
            <div className="empty">Aucune audience planifiée.</div>
          ) : (
            <div className="kv-list">
              {stats.upcoming.slice(0, 5).map((a) => (
                <div key={a.id} className="kv-row">
                  <span className="k">{formatDate(a.date)} · {a.heure}</span>
                  <span className="v">{a.objet}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card-title mt-24">Alertes en attente</div>
          {alertes.length === 0 ? (
            <div className="empty">RAS.</div>
          ) : (
            <div className="kv-list">
              {alertes.slice(0, 4).map((a) => (
                <div key={a.id} className="kv-row">
                  <span className="k">
                    <span className={`pill ${a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'orange' : 'gray'}`}>
                      {a.dossier}
                    </span>
                  </span>
                  <span className="v" style={{ textAlign: 'right' }}>{a.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
