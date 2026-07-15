/**
 * RBAC éditable — matrice rôles × permissions.
 *
 * Les permissions par rôle étaient figées dans le code. Ce module les rend
 * **configurables** (page « Rôles & permissions », réservée aux admins) et
 * **persistées** dans localStorage. `AuthProvider` consomme la matrice courante
 * via {@link useRbac} pour calculer les droits de l'utilisateur connecté.
 *
 * Doit envelopper `AuthProvider` dans l'arbre React (cf. main.tsx).
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { Role } from './models';
import { Roles_permissionsService } from './generated/services/Roles_permissionsService';

export interface Permission {
  creerDossier: boolean;
  modifierDossier: boolean;
  modifierProprement: boolean;
  archiverDossier: boolean;
  planifierAudience: boolean;
  enregistrerDelibere: boolean;
  consulterDossier: boolean;
  consulterUniquementSes: boolean;
  gererHonoraires: boolean;
  validerHonoraires: boolean;
  accesRapports: boolean;
  accesRapportsLimite: boolean;
  gererUtilisateurs: boolean;
  configurerAlertes: boolean;
  exporterDonnees: boolean;
  accesLogsAudit: boolean;
}

export type PermissionKey = keyof Permission;
export type PermsByRole = Record<Role, Permission>;

/** Ordre d'affichage des permissions + libellés FR pour la page de config. */
export const PERMISSION_LABELS: Array<{ key: PermissionKey; label: string }> = [
  { key: 'consulterDossier', label: 'Consulter les dossiers' },
  { key: 'consulterUniquementSes', label: 'Consulter uniquement ses dossiers' },
  { key: 'creerDossier', label: 'Créer un dossier' },
  { key: 'modifierDossier', label: 'Modifier un dossier' },
  { key: 'modifierProprement', label: 'Modifier ses propres saisies' },
  { key: 'archiverDossier', label: 'Archiver un dossier' },
  { key: 'planifierAudience', label: 'Planifier une audience' },
  { key: 'enregistrerDelibere', label: 'Enregistrer un délibéré' },
  { key: 'gererHonoraires', label: 'Gérer les honoraires' },
  { key: 'validerHonoraires', label: 'Valider les honoraires' },
  { key: 'accesRapports', label: 'Accès aux rapports' },
  { key: 'accesRapportsLimite', label: 'Rapports en accès limité' },
  { key: 'configurerAlertes', label: 'Configurer les alertes' },
  { key: 'exporterDonnees', label: 'Exporter les données' },
  { key: 'gererUtilisateurs', label: 'Gérer les utilisateurs & rôles' },
  { key: 'accesLogsAudit', label: "Accès au journal d'audit" },
];

export const ALL_PERMISSION_KEYS = PERMISSION_LABELS.map((p) => p.key);

/** Rôles dans l'ordre d'affichage (colonnes de la matrice). */
export const ROLES_ORDER: Role[] = ['ADMIN', 'SUPERVISEUR', 'JURISTE', 'LECTEUR', 'AVOCAT_EXTERNE'];

/** Matrice par défaut — référence figée, restaurée par « Réinitialiser ». */
export const DEFAULT_PERMS_BY_ROLE: PermsByRole = {
  ADMIN: {
    creerDossier: true, modifierDossier: true, modifierProprement: true,
    archiverDossier: true, planifierAudience: true, enregistrerDelibere: true,
    consulterDossier: true, consulterUniquementSes: false,
    gererHonoraires: true, validerHonoraires: true,
    accesRapports: true, accesRapportsLimite: false,
    gererUtilisateurs: true, configurerAlertes: true,
    exporterDonnees: true, accesLogsAudit: true,
  },
  SUPERVISEUR: {
    creerDossier: true, modifierDossier: true, modifierProprement: true,
    archiverDossier: true, planifierAudience: true, enregistrerDelibere: true,
    consulterDossier: true, consulterUniquementSes: false,
    gererHonoraires: true, validerHonoraires: true,
    accesRapports: true, accesRapportsLimite: false,
    gererUtilisateurs: false, configurerAlertes: true,
    exporterDonnees: true, accesLogsAudit: false,
  },
  JURISTE: {
    creerDossier: true, modifierDossier: true, modifierProprement: true,
    archiverDossier: false, planifierAudience: true, enregistrerDelibere: true,
    consulterDossier: true, consulterUniquementSes: false,
    gererHonoraires: true, validerHonoraires: false,
    accesRapports: true, accesRapportsLimite: true,
    gererUtilisateurs: false, configurerAlertes: false,
    exporterDonnees: true, accesLogsAudit: false,
  },
  LECTEUR: {
    creerDossier: false, modifierDossier: false, modifierProprement: false,
    archiverDossier: false, planifierAudience: false, enregistrerDelibere: false,
    consulterDossier: true, consulterUniquementSes: false,
    gererHonoraires: false, validerHonoraires: false,
    accesRapports: true, accesRapportsLimite: true,
    gererUtilisateurs: false, configurerAlertes: false,
    exporterDonnees: false, accesLogsAudit: false,
  },
  AVOCAT_EXTERNE: {
    creerDossier: false, modifierDossier: false, modifierProprement: false,
    archiverDossier: false, planifierAudience: false, enregistrerDelibere: false,
    consulterDossier: true, consulterUniquementSes: true,
    gererHonoraires: false, validerHonoraires: false,
    accesRapports: false, accesRapportsLimite: false,
    gererUtilisateurs: false, configurerAlertes: false,
    exporterDonnees: false, accesLogsAudit: false,
  },
};

const RBAC_LS_KEY = 'afb_rbac_v1';

/** Fusionne les overrides persistés avec les défauts (nouvelles clés incluses). */
function loadPerms(): PermsByRole {
  const base: PermsByRole = structuredCloneSafe(DEFAULT_PERMS_BY_ROLE);
  if (typeof localStorage === 'undefined') return base;
  try {
    const raw = localStorage.getItem(RBAC_LS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<PermsByRole>;
    for (const role of ROLES_ORDER) {
      const o = parsed[role];
      if (o) for (const k of ALL_PERMISSION_KEYS) {
        if (typeof o[k] === 'boolean') base[role][k] = o[k] as boolean;
      }
    }
  } catch { /* ignore — on garde les défauts */ }
  return base;
}

function savePerms(p: PermsByRole): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(RBAC_LS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

/** Clone profond sans dépendre de structuredClone (compat large). */
function structuredCloneSafe(p: PermsByRole): PermsByRole {
  return JSON.parse(JSON.stringify(p)) as PermsByRole;
}

// ─── Persistance partagée : liste SharePoint `roles_permissions` ─────────────
//
// Mapping (cf. .power/schemas/sharepointonline/roles_permissions.Schema.json) :
//   Title = id (= nom du rôle) ; field_1..16 = les 16 droits, dans cet ordre.
const PERM_FIELD_ORDER: PermissionKey[] = [
  'creerDossier', 'modifierDossier', 'modifierProprement', 'archiverDossier',
  'planifierAudience', 'enregistrerDelibere', 'consulterDossier', 'consulterUniquementSes',
  'gererHonoraires', 'validerHonoraires', 'accesRapports', 'accesRapportsLimite',
  'gererUtilisateurs', 'configurerAlertes', 'exporterDonnees', 'accesLogsAudit',
];
const toBool = (v: unknown): boolean =>
  typeof v === 'boolean' ? v : /^(true|1|oui|yes)$/i.test(String(v ?? '').trim());

/** Lit la matrice partagée + la table rôle→IDSharePoint. Null si indisponible/vide. */
async function loadRemotePerms(): Promise<{ perms: PermsByRole; ids: Record<string, string> } | null> {
  try {
    const res = await Roles_permissionsService.getAll({ top: 100 });
    if (!res.success || !Array.isArray(res.data) || res.data.length === 0) return null;
    const perms = structuredCloneSafe(DEFAULT_PERMS_BY_ROLE);
    const ids: Record<string, string> = {};
    for (const row of res.data as Array<Record<string, unknown>>) {
      const role = String(row.Title ?? '') as Role;
      if (!ROLES_ORDER.includes(role)) continue;
      ids[role] = String(row.ID ?? '');
      PERM_FIELD_ORDER.forEach((k, i) => {
        const v = row[`field_${i + 1}`];
        if (v !== undefined && v !== null && v !== '') perms[role][k] = toBool(v);
      });
    }
    return { perms, ids };
  } catch (e) {
    console.warn('[rbac] lecture distante échouée — matrice locale conservée', e);
    return null;
  }
}

/** Écrit (update si IDSharePoint connu, sinon create) la ligne d'un rôle. */
async function saveRemoteRole(role: Role, perms: Permission, spId?: string): Promise<void> {
  const rec: Record<string, unknown> = { Title: role };
  PERM_FIELD_ORDER.forEach((k, i) => { rec[`field_${i + 1}`] = String(perms[k]); });
  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    if (spId) await Roles_permissionsService.update(spId, rec as any);
    else await Roles_permissionsService.create(rec as any);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch (e) {
    console.warn(`[rbac] écriture distante échouée pour ${role} (conservé en local)`, e);
  }
}

interface RbacValue {
  permsByRole: PermsByRole;
  permsFor: (role: Role) => Permission;
  setPerm: (role: Role, key: PermissionKey, value: boolean) => void;
  resetRole: (role: Role) => void;
  resetAll: () => void;
  /** true si la matrice diffère des défauts (overrides actifs). */
  isCustomized: boolean;
}

const RbacContext = createContext<RbacValue | null>(null);

export function RbacProvider({ children }: { children: ReactNode }) {
  // Démarrage : cache localStorage (instantané), puis écrasé par la liste
  // SharePoint partagée dès qu'elle répond.
  const [permsByRole, setPermsByRole] = useState<PermsByRole>(() => loadPerms());
  const permsRef = useRef(permsByRole);
  const spIds = useRef<Record<string, string>>({});
  useEffect(() => { permsRef.current = permsByRole; savePerms(permsByRole); }, [permsByRole]);

  // Chargement de la matrice partagée (source de vérité si disponible).
  useEffect(() => {
    let cancelled = false;
    void loadRemotePerms().then((res) => {
      if (cancelled || !res) return;
      spIds.current = res.ids;
      setPermsByRole(res.perms);
    });
    return () => { cancelled = true; };
  }, []);

  /** Applique localement + écrit la ligne du rôle dans SharePoint (best-effort). */
  const applyAndSave = useCallback((role: Role, nextRole: Permission) => {
    setPermsByRole((prev) => ({ ...prev, [role]: nextRole }));
    void saveRemoteRole(role, nextRole, spIds.current[role]);
  }, []);

  const setPerm = useCallback((role: Role, key: PermissionKey, value: boolean) => {
    applyAndSave(role, { ...permsRef.current[role], [key]: value });
  }, [applyAndSave]);
  const resetRole = useCallback((role: Role) => {
    applyAndSave(role, { ...DEFAULT_PERMS_BY_ROLE[role] });
  }, [applyAndSave]);
  const resetAll = useCallback(() => {
    setPermsByRole(structuredCloneSafe(DEFAULT_PERMS_BY_ROLE));
    for (const role of ROLES_ORDER) {
      void saveRemoteRole(role, DEFAULT_PERMS_BY_ROLE[role], spIds.current[role]);
    }
  }, []);
  const permsFor = useCallback(
    (role: Role) => permsByRole[role] ?? DEFAULT_PERMS_BY_ROLE[role],
    [permsByRole],
  );
  const isCustomized = useMemo(
    () => JSON.stringify(permsByRole) !== JSON.stringify(DEFAULT_PERMS_BY_ROLE),
    [permsByRole],
  );

  const value = useMemo<RbacValue>(
    () => ({ permsByRole, permsFor, setPerm, resetRole, resetAll, isCustomized }),
    [permsByRole, permsFor, setPerm, resetRole, resetAll, isCustomized],
  );
  return <RbacContext.Provider value={value}>{children}</RbacContext.Provider>;
}

export function useRbac(): RbacValue {
  const ctx = useContext(RbacContext);
  if (!ctx) throw new Error('useRbac doit être utilisé à l\'intérieur de <RbacProvider>');
  return ctx;
}
