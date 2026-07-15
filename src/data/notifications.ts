/**
 * Notifications persistées — liste SharePoint `Notifications`.
 *
 * Distinctes des *alertes* (calculées à la volée par alertes-engine) : une
 * notification est un **enregistrement durable** (ex. envoi d'un e-mail de
 * rappel) avec un statut partagé (EN_ATTENTE / ENVOYEE / LUE). Accès direct au
 * service typé généré, sans passer par la DataSource (couche indépendante).
 *
 * Mapping (cf. .power/schemas/sharepointonline/notifications.Schema.json) :
 *   Title = id ; field_1 type ; field_2 severity ; field_3 titre ; field_4 message ;
 *   field_5 dossierId ; field_6 destinataireId ; field_7 destinataireEmail [PERSONNE] ;
 *   field_8 canal ; field_9 statut ; field_10 dateCreation ; field_11 dateEnvoi ;
 *   field_12 dateLecture.
 * `destinataireEmail` est une colonne SharePoint « Personne » → lue via .Email,
 * jamais écrite (on s'appuie sur destinataireId).
 */
import type { Severity } from '../models';
import { NotificationsService } from '../generated/services/NotificationsService';

export type StatutNotification = 'EN_ATTENTE' | 'ENVOYEE' | 'LUE';

export interface Notification {
  id: string;
  type: string;
  severity: Severity;
  titre: string;
  message: string;
  dossierId?: string;
  destinataireId?: string;
  destinataireEmail?: string;
  canal: string;
  statut: StatutNotification;
  dateCreation: string;
  dateEnvoi?: string;
  dateLecture?: string;
}

export type NotificationInput =
  Omit<Notification, 'id' | 'dateCreation' | 'statut'> & {
    statut?: StatutNotification;
    dateCreation?: string;
  };

type Rec = Record<string, unknown>;

// ── Coercions (colonne « Personne » incluse) ────────────────────────────────
const firstOf = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
const isPerson = (o: unknown): o is Rec =>
  !!o && typeof o === 'object' && ('Claims' in o || 'DisplayName' in o || 'Email' in o);
const str = (v: unknown): string => {
  const f = firstOf(v);
  if (isPerson(f)) return String(f.DisplayName ?? f.Email ?? '');
  return f == null ? '' : String(f);
};
const opt = (v: unknown): string | undefined => {
  const s = str(v).trim();
  return s === '' ? undefined : s;
};
const emailOf = (v: unknown): string | undefined => {
  const f = firstOf(v);
  if (isPerson(f)) {
    const claims = typeof f.Claims === 'string' ? f.Claims.split('|').pop() ?? '' : '';
    return String(f.Email || (claims.includes('@') ? claims : '') || f.DisplayName || '') || undefined;
  }
  return opt(v);
};
const nowIso = (): string => new Date().toISOString();
const newId = (): string =>
  `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** id métier → ID natif SharePoint (pour update du statut). */
const spIds = new Map<string, string>();

function fromSp(r: Rec): Notification {
  const id = str(r.Title);
  if (id) spIds.set(id, str(r.ID));
  return {
    id,
    type: str(r.field_1),
    severity: (opt(r.field_2) ?? 'medium') as Severity,
    titre: str(r.field_3),
    message: str(r.field_4),
    dossierId: opt(r.field_5),
    destinataireId: opt(r.field_6),
    destinataireEmail: emailOf(r.field_7),
    canal: opt(r.field_8) ?? 'EMAIL',
    statut: (opt(r.field_9) ?? 'EN_ATTENTE') as StatutNotification,
    dateCreation: opt(r.field_10) ?? str(r.Created),
    dateEnvoi: opt(r.field_11),
    dateLecture: opt(r.field_12),
  };
}

/** N'écrit PAS field_7 (colonne Personne, lecture seule annuaire). */
function toSp(n: Notification): Rec {
  return {
    Title: n.id,
    field_1: n.type, field_2: n.severity, field_3: n.titre, field_4: n.message,
    field_5: n.dossierId ?? '', field_6: n.destinataireId ?? '', field_8: n.canal,
    field_9: n.statut, field_10: n.dateCreation, field_11: n.dateEnvoi ?? '',
    field_12: n.dateLecture ?? '',
  };
}

/** Liste les notifications (plus récentes d'abord). [] si indisponible. */
export async function listNotifications(): Promise<Notification[]> {
  try {
    const res = await NotificationsService.getAll({ top: 500 });
    if (!res.success || !Array.isArray(res.data)) return [];
    return (res.data as Rec[])
      .map(fromSp)
      .sort((a, b) => (b.dateCreation ?? '').localeCompare(a.dateCreation ?? ''));
  } catch (e) {
    console.warn('[notifications] lecture échouée', e);
    return [];
  }
}

/** Crée une notification persistée. Renvoie l'objet créé, ou null si échec. */
export async function createNotification(input: NotificationInput): Promise<Notification | null> {
  const n: Notification = {
    ...input,
    id: newId(),
    statut: input.statut ?? 'ENVOYEE',
    dateCreation: input.dateCreation ?? nowIso(),
  };
  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const res = await NotificationsService.create(toSp(n) as any);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (res.success && res.data) spIds.set(n.id, String((res.data as Rec).ID ?? ''));
    return n;
  } catch (e) {
    console.warn('[notifications] création échouée', e);
    return null;
  }
}

/** Marque une notification comme lue (statut LUE + dateLecture). */
export async function markNotificationRead(n: Notification): Promise<Notification> {
  const updated: Notification = { ...n, statut: 'LUE', dateLecture: nowIso() };
  const spId = spIds.get(n.id);
  if (!spId) return updated;
  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    await NotificationsService.update(spId, { field_9: 'LUE', field_12: updated.dateLecture } as any);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch (e) {
    console.warn('[notifications] mise à jour statut échouée', e);
  }
  return updated;
}
