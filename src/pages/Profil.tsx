import { useState } from 'react';
import { useAuth } from '../auth';
import { LBL_ROLE, LBL_SOURCE_AUTH } from '../labels';
import { SeedDataSource } from '../data/sources/seed';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function Profil() {
  const { user, permissions } = useAuth();
  const perms = Object.entries(permissions).filter(([, v]) => v).map(([k]) => k);
  const [confirmReset, setConfirmReset] = useState(false);

  const onResetData = () => {
    SeedDataSource.resetStorage();
    // Recharge l'app : la prochaine init du SeedDataSource repart des graines.
    window.location.reload();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Mon profil</div>
          <div className="page-subtitle">Compte utilisateur et permissions effectives</div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-title">Compte</div>
          <div className="kv-list">
            <div className="kv-row"><span className="k">Nom affiché</span><span className="v">{user.nomAffichage}</span></div>
            <div className="kv-row"><span className="k">Identifiant</span><span className="v"><code>{user.login}</code></span></div>
            <div className="kv-row"><span className="k">E-mail</span><span className="v">{user.email || '—'}</span></div>
            <div className="kv-row"><span className="k">Rôle</span><span className="v"><span className="pill black">{LBL_ROLE[user.role]}</span></span></div>
            <div className="kv-row"><span className="k">Source d'auth</span><span className="v">{LBL_SOURCE_AUTH[user.sourceAuth]}</span></div>
            <div className="kv-row"><span className="k">Statut</span><span className="v">{user.isActive ? 'Actif' : 'Inactif'}</span></div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Permissions effectives ({perms.length})</div>
          {perms.length === 0 ? (
            <div className="muted" style={{ fontSize: 12 }}>Aucune permission accordée.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {perms.map((p) => <span key={p} className="pill green">{p}</span>)}
            </div>
          )}
        </div>
      </div>

      {user.role === 'ADMIN' && (
        <div className="card mt-24" style={{ borderColor: 'var(--red)', borderWidth: 1 }}>
          <div className="card-title" style={{ color: 'var(--red)' }}>Zone d'administration</div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
            En mode <strong>données de démonstration</strong> (source <code>seed</code>),
            les enregistrements (dossiers, audiences, délibérés, etc.) sont conservés
            dans le <strong>localStorage du navigateur</strong>. Le bouton ci-dessous
            efface ces données et restaure le jeu de démo initial. Il n'affecte ni
            SharePoint ni Dataverse.
          </p>
          <button type="button" className="btn btn-ghost"
                  style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                  onClick={() => setConfirmReset(true)}>
            Réinitialiser les données de démo
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset} destructive
        title="Réinitialiser les données"
        message="Toutes les modifications enregistrées localement (dossiers créés, édités, supprimés…) vont être effacées et le jeu de démonstration initial sera restauré. L'app va se recharger."
        confirmLabel="Tout réinitialiser"
        onConfirm={onResetData}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
}
