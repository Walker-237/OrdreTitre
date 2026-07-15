/**
 * Shell — topbar + sidebar + zone de contenu (router-outlet).
 * Porté depuis Audience/src/app/app.component.html.
 */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useStore } from '../data/store';
import { LBL_ROLE } from '../labels';
import { Logo } from '../components/Logo';
import { GlobalSearch } from '../components/GlobalSearch';
import { NotificationBell } from '../components/NotificationBell';

const SIDEBAR_LS_KEY = 'afb_sidebar_collapsed';
function loadSidebarCollapsed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(SIDEBAR_LS_KEY) === '1';
}

interface NavEntry {
  to: string;
  label: string;
  show?: (perms: ReturnType<typeof useAuth>['permissions']) => boolean;
}

const NAV: NavEntry[] = [
  { to: '/dashboard', label: 'Tableau de bord' },
  { to: '/dossiers', label: 'Dossiers' },
  { to: '/audiences', label: 'Audiences' },
  { to: '/deliberes', label: 'Délibérés' },
  { to: '/intervenants', label: 'Intervenants' },
  { to: '/honoraires', label: 'Honoraires', show: (p) => p.gererHonoraires },
  { to: '/juridictions', label: 'Juridictions' },
  { to: '/alertes', label: 'Alertes', show: (p) => p.configurerAlertes || p.consulterDossier },
  { to: '/rapports', label: 'Rapports & analyses', show: (p) => p.accesRapports },
  { to: '/jurisprudence', label: 'Jurisprudence' },
  { to: '/utilisateurs', label: 'Utilisateurs', show: (p) => p.gererUtilisateurs },
  { to: '/roles', label: 'Rôles & permissions', show: (p) => p.gererUtilisateurs },
  { to: '/audit', label: "Journal d'audit", show: (p) => p.accesLogsAudit },
];

export function Shell() {
  const { user, permissions, initials, logout } = useAuth();
  const { unreadAlertesCount } = useStore();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  /**
   * Sidebar cachée sur desktop (>900px) — persistée localStorage.
   * Sur mobile (≤900px), la sidebar bascule en mode drawer (`mobileNavOpen`)
   * indépendamment de cet état.
   */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_LS_KEY, sidebarCollapsed ? '1' : '0'); }
    catch { /* ignore */ }
  }, [sidebarCollapsed]);

  /** Le bouton menu-toggle a deux comportements selon la largeur d'écran. */
  const onToggleMenu = () => {
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
    if (isMobile) setMobileNavOpen((v) => !v);
    else          setSidebarCollapsed((v) => !v);
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'active' : '';

  const closeNav = () => setMobileNavOpen(false);

  const onSignOut = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/login');
  };

  const entries = NAV.filter((n) => !n.show || n.show(permissions));

  return (
    <>
      <header className="topbar">
        <button
          type="button"
          className="menu-toggle"
          onClick={onToggleMenu}
          aria-label={sidebarCollapsed ? 'Afficher le menu latéral' : 'Cacher le menu latéral'}
          aria-expanded={mobileNavOpen || !sidebarCollapsed}
          title={sidebarCollapsed ? 'Afficher le menu latéral' : 'Cacher le menu latéral'}
        >
          ☰
        </button>

        <div className="brand">
          <div className="brand-mark">
            <Logo />
          </div>
          <div className="brand-text">
            <div className="brand-title">Afriland First Bank</div>
            <div className="brand-sub">Suivi des Audiences &amp; Délibérés — DAJ</div>
          </div>
        </div>

        <GlobalSearch />

        <div className="topbar-right">
          <NotificationBell />
          <div
            className="user-chip"
            onClick={() => setUserMenuOpen((v) => !v)}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            <div className="avatar">{initials}</div>
            <div className="user-meta">
              <div className="user-name">{user.nomAffichage}</div>
              <div className="user-role">{LBL_ROLE[user.role]}</div>
            </div>

            {userMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 8,
                  background: '#fff', border: '1px solid var(--gray-200)',
                  borderRadius: 10, padding: 12, minWidth: 240,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 10,
                }}
              >
                <div style={{ padding: '4px 2px 8px' }}>
                  <div className="fw-700" style={{ fontSize: 13 }}>{user.nomAffichage}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{user.email}</div>
                  <span className="pill" style={{ fontSize: 10, marginTop: 4, display: 'inline-block' }}>
                    {LBL_ROLE[user.role]}
                  </span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--gray-200)', margin: '8px 0' }} />
                <NavLink
                  to="/profil"
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'center', marginBottom: 6 }}
                  onClick={() => setUserMenuOpen(false)}
                >
                  Mon profil
                </NavLink>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={onSignOut}
                >
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onSignOut}
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <span aria-hidden>⎋</span>
            <span className="logout-label">Se déconnecter</span>
          </button>
        </div>
      </header>

      <div className={`layout${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`}>
          <nav>
            {entries.map((n) => (
              <NavLink key={n.to} to={n.to} className={navLinkClass} onClick={closeNav}>
                {n.label}
                {n.to === '/alertes' && unreadAlertesCount > 0 && (
                  <span
                    style={{
                      marginLeft: 'auto', background: 'var(--red)', color: '#fff',
                      padding: '2px 6px', borderRadius: 8, fontSize: 10,
                    }}
                  >
                    {unreadAlertesCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="env-tag">v1.0 · Démo · {LBL_ROLE[user.role]}</div>
          </div>
        </aside>

        <main className="content">
          <div className="view-container">
            <Outlet />
          </div>
        </main>
      </div>

      <div
        className={`nav-overlay${mobileNavOpen ? ' open' : ''}`}
        onClick={closeNav}
        aria-hidden
      />
    </>
  );
}
