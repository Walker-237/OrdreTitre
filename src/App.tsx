import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Shell } from './layouts/Shell';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { DossiersList } from './pages/DossiersList';
import { DossierDetail } from './pages/DossierDetail';
import { DossierCreate } from './pages/DossierCreate';
import { Audiences } from './pages/Audiences';
import { Deliberes } from './pages/Deliberes';
import { Intervenants } from './pages/Intervenants';
import { Honoraires } from './pages/Honoraires';
import { Juridictions } from './pages/Juridictions';
import { Alertes } from './pages/Alertes';
import { Rapports } from './pages/Rapports';
import { Jurisprudence } from './pages/Jurisprudence';
import { Utilisateurs } from './pages/Utilisateurs';
import { RolesPermissions } from './pages/RolesPermissions';
import { Audit } from './pages/Audit';
import { Profil } from './pages/Profil';
import type { Permission } from './auth';
import type { ReactElement } from 'react';

/** Garde d'authentification : redirige vers /login si pas de session. */
function RequireAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

/** Splash pendant l'interrogation du player Power Apps (auth Microsoft). */
function AuthSplash() {
  return (
    <div className="login-shell">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="login-title" style={{ marginBottom: 8 }}>Connexion…</div>
        <div className="muted" style={{ fontSize: 13 }}>
          Vérification de votre compte Microsoft.
        </div>
      </div>
    </div>
  );
}

/** Écran « Accès refusé » : identité Microsoft valide mais non autorisée. */
function AccessDenied({ message }: { message: string }) {
  return (
    <div className="login-shell">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="login-title" style={{ marginBottom: 8 }}>Accès refusé</div>
        <div className="pill red mb-12" style={{ display: 'block', padding: '8px 12px' }}>
          {message}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          Direction des Affaires Juridiques · AFB
        </div>
      </div>
    </div>
  );
}

/** Garde RBAC : si l'utilisateur n'a pas la permission, redirige vers /dashboard. */
function RequirePerm({ perm, children }: { perm: keyof Permission; children: ReactElement }) {
  const { can } = useAuth();
  if (!can(perm)) return <Navigate to="/dashboard" replace />;
  return children;
}

/**
 * Routage de l'app — porté depuis Audience/src/app/app.routes.ts.
 * Garde authGuard global via RequireAuth + RBAC ciblé via RequirePerm.
 */
export default function App() {
  const { status, authError } = useAuth();

  // Pendant l'interrogation du player Power Apps : splash.
  if (status === 'initializing') return <AuthSplash />;
  // Identité Microsoft résolue mais non autorisée : accès refusé (pas de routes).
  if (status === 'denied') {
    return <AccessDenied message={authError ?? 'Compte non autorisé.'} />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Shell /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        <Route path="dossiers" element={<DossiersList />} />
        <Route
          path="dossiers/nouveau"
          element={<RequirePerm perm="creerDossier"><DossierCreate /></RequirePerm>}
        />
        <Route path="dossiers/:id" element={<DossierDetail />} />

        <Route path="audiences" element={<Audiences />} />
        <Route path="deliberes" element={<Deliberes />} />
        <Route path="intervenants" element={<Intervenants />} />
        <Route
          path="honoraires"
          element={<RequirePerm perm="gererHonoraires"><Honoraires /></RequirePerm>}
        />
        <Route path="juridictions" element={<Juridictions />} />
        <Route path="alertes" element={<Alertes />} />
        {/* Ancienne URL /reporting → fusionnée dans /rapports. */}
        <Route path="reporting" element={<Navigate to="/rapports" replace />} />
        <Route
          path="rapports"
          element={<RequirePerm perm="accesRapports"><Rapports /></RequirePerm>}
        />
        <Route path="jurisprudence" element={<Jurisprudence />} />
        <Route path="profil" element={<Profil />} />
        <Route
          path="utilisateurs"
          element={<RequirePerm perm="gererUtilisateurs"><Utilisateurs /></RequirePerm>}
        />
        <Route
          path="roles"
          element={<RequirePerm perm="gererUtilisateurs"><RolesPermissions /></RequirePerm>}
        />
        <Route
          path="audit"
          element={<RequirePerm perm="accesLogsAudit"><Audit /></RequirePerm>}
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
