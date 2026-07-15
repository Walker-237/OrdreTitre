/**
 * Page « Rôles & permissions » — matrice éditable des droits par rôle.
 * Réservée aux profils disposant de `gererUtilisateurs` (cf. App.tsx).
 *
 * Les modifications sont appliquées immédiatement (live) et persistées en
 * localStorage via {@link useRbac}. « Réinitialiser » restaure les défauts.
 */
import { useRbac, PERMISSION_LABELS, ROLES_ORDER } from '../rbac';
import { LBL_ROLE } from '../labels';

export function RolesPermissions() {
  const { permsByRole, setPerm, resetAll, isCustomized } = useRbac();

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Rôles &amp; permissions</div>
          <div className="page-subtitle">
            Définissez les droits accordés à chaque profil. Les changements
            s'appliquent immédiatement et sont conservés localement.
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {isCustomized && <span className="pill orange">Personnalisé</span>}
          <button className="btn btn-ghost btn-sm" onClick={resetAll} disabled={!isCustomized}>
            Réinitialiser les défauts
          </button>
        </div>
      </div>

      <div className="table-wrap" style={{ borderRadius: 14 }}>
        <table className="data">
          <thead>
            <tr>
              <th style={{ minWidth: 260 }}>Permission</th>
              {ROLES_ORDER.map((r) => (
                <th key={r} className="text-center" style={{ whiteSpace: 'nowrap' }}>
                  {LBL_ROLE[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_LABELS.map(({ key, label }) => (
              <tr key={key}>
                <td>
                  <div className="fw-700" style={{ fontSize: 13 }}>{label}</div>
                  <code style={{ fontSize: 10, color: 'var(--gray-500)' }}>{key}</code>
                </td>
                {ROLES_ORDER.map((role) => {
                  const checked = permsByRole[role][key];
                  return (
                    <td key={role} className="text-center">
                      <label
                        title={`${label} — ${LBL_ROLE[role]}`}
                        style={{ display: 'inline-flex', cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setPerm(role, key, e.target.checked)}
                          aria-label={`${label} pour ${LBL_ROLE[role]}`}
                        />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
        Note : le rôle <strong>{LBL_ROLE.ADMIN}</strong> doit conserver
        « Gérer les utilisateurs &amp; rôles » pour garder l'accès à cette page.
      </p>
    </>
  );
}
