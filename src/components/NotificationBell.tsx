/**
 * Cloche de notifications — panneau déroulant ouvert depuis la topbar.
 *
 * Donne un aperçu immédiat des alertes en attente (les plus prioritaires en
 * tête), avec actions rapides : marquer comme lue, écarter, ouvrir le dossier
 * rattaché, ou tout marquer comme lu. Le détail complet reste sur /alertes.
 *
 * Les alertes proviennent du même flux dérivé que la page Alertes (cf. store +
 * alertes-engine). Aucun état local de données ici : on lit/écrit via le store.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { formatDate, LBL_TYPE_ALERTE } from '../labels';
import type { Alerte, Severity, TypeAlerte } from '../models';
import {
  listNotifications, markNotificationRead, type Notification,
} from '../data/notifications';

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

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const SEVERITY_LABEL: Record<Severity, string> = { high: 'Haute', medium: 'Moyenne', low: 'Basse' };

/** Nombre max d'alertes affichées dans le panneau (le reste via « Voir tout »). */
const PREVIEW_LIMIT = 6;

export function NotificationBell() {
  const { alertes, unreadAlertesCount, markAlerteAsRead, dismissAlerte } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Notifications persistées (liste SharePoint) — chargées une fois.
  const [persisted, setPersisted] = useState<Notification[]>([]);
  useEffect(() => { void listNotifications().then(setPersisted); }, []);
  const unreadPersisted = useMemo(
    () => persisted.filter((n) => n.statut !== 'LUE').slice(0, PREVIEW_LIMIT),
    [persisted],
  );
  const unreadPersistedCount = useMemo(
    () => persisted.filter((n) => n.statut !== 'LUE').length,
    [persisted],
  );

  const markPersistedRead = (n: Notification) => {
    void markNotificationRead(n).then((u) =>
      setPersisted((prev) => prev.map((x) => (x.id === u.id ? u : x))));
  };

  // Alertes en attente, triées par sévérité puis par échéance la plus proche.
  const pending = useMemo(() => {
    return alertes
      .filter((a) => a.statut === 'EN_ATTENTE')
      .sort((a, b) => {
        const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (sev !== 0) return sev;
        return (a.due ?? '').localeCompare(b.due ?? '');
      });
  }, [alertes]);

  const preview = pending.slice(0, PREVIEW_LIMIT);
  const totalUnread = unreadAlertesCount + unreadPersistedCount;
  const totalCount = pending.length + unreadPersistedCount;

  // Ferme au clic extérieur et à la touche Échap.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openAlerte = (a: Alerte) => {
    markAlerteAsRead(a.id);
    setOpen(false);
    if (a.dossierId) navigate(`/dossiers/${a.dossierId}`);
    else navigate('/alertes');
  };

  const markAllRead = () => {
    pending.forEach((a) => markAlerteAsRead(a.id));
  };

  return (
    <div className="notif" ref={rootRef}>
      <button
        type="button"
        className="alerts-bell"
        title="Notifications"
        aria-label={totalUnread > 0 ? `Notifications (${totalUnread} non lues)` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>🔔</span>
        {totalUnread > 0 && (
          <span className="badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <div className="notif-head-title">
              Notifications
              {totalCount > 0 && <span className="notif-count">{totalCount}</span>}
            </div>
            {pending.length > 0 && (
              <button type="button" className="notif-link" onClick={markAllRead}>
                Tout marquer comme lu
              </button>
            )}
          </div>

          {preview.length === 0 && unreadPersisted.length === 0 ? (
            <div className="notif-empty">
              <div style={{ fontSize: 24 }}>✅</div>
              <div className="fw-700" style={{ fontSize: 13 }}>Aucune notification en attente</div>
              <div className="muted" style={{ fontSize: 11 }}>Tout est sous contrôle.</div>
            </div>
          ) : (
            <ul className="notif-list">
              {unreadPersisted.map((n) => (
                <li key={n.id} className={`notif-item sev-${n.severity}`}>
                  <button
                    type="button" className="notif-item-main"
                    onClick={() => {
                      markPersistedRead(n);
                      setOpen(false);
                      if (n.dossierId) navigate(`/dossiers/${n.dossierId}`);
                    }}
                  >
                    <span className="notif-icon">{n.canal === 'EMAIL' ? '📧' : '🔔'}</span>
                    <span className="notif-body">
                      <span className="notif-title">{n.titre}</span>
                      <span className="notif-desc">{n.message}</span>
                      <span className="notif-meta">
                        <span className={`notif-dot sev-${n.severity}`} />
                        {SEVERITY_LABEL[n.severity]}
                        {' · '}{n.canal}
                        {n.dateCreation ? ` · ${formatDate(n.dateCreation)}` : ''}
                      </span>
                    </span>
                  </button>
                  <div className="notif-actions">
                    <button
                      type="button" className="notif-act" title="Marquer comme lue"
                      onClick={() => markPersistedRead(n)}
                    >✓</button>
                  </div>
                </li>
              ))}
              {preview.map((a) => (
                <li key={a.id} className={`notif-item sev-${a.severity}`}>
                  <button type="button" className="notif-item-main" onClick={() => openAlerte(a)}>
                    <span className="notif-icon">{ICON_BY_TYPE[a.typeAlerte]}</span>
                    <span className="notif-body">
                      <span className="notif-title">{a.title}</span>
                      <span className="notif-desc">{a.desc}</span>
                      <span className="notif-meta">
                        <span className={`notif-dot sev-${a.severity}`} />
                        {SEVERITY_LABEL[a.severity]}
                        {' · '}{LBL_TYPE_ALERTE[a.typeAlerte]}
                        {a.due ? ` · échéance ${formatDate(a.due)}` : ''}
                      </span>
                    </span>
                  </button>
                  <div className="notif-actions">
                    <button
                      type="button" className="notif-act" title="Marquer comme lue"
                      onClick={() => markAlerteAsRead(a.id)}
                    >✓</button>
                    <button
                      type="button" className="notif-act danger" title="Écarter"
                      onClick={() => dismissAlerte(a.id)}
                    >✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="notif-foot"
            onClick={() => { setOpen(false); navigate('/alertes'); }}
          >
            Voir toutes les alertes
            {pending.length > preview.length && ` (+${pending.length - preview.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
