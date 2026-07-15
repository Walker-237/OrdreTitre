/**
 * Authentification + matrice RBAC.
 *
 * En production, l'app tourne dans le **player Power Apps** : l'utilisateur est
 * déjà authentifié avec son **compte Microsoft (Entra ID)** avant le chargement.
 * On ne gère donc PAS de mot de passe ici — on lit l'identité déjà authentifiée
 * via `getContext()` du SDK Power Apps, puis on la mappe (par e-mail / UPN) à un
 * enregistrement `Utilisateur` pour en déduire le rôle RBAC.
 *
 * En dev local (Vite, hors player), `getContext()` ne répond jamais : on bascule
 * après un court timeout vers un formulaire de démonstration (seed, tout mot de
 * passe accepté).
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { getContext } from '@microsoft/power-apps/app';
import type { Utilisateur } from './models';
import { getDataSource } from './data/source';
import { SEED_UTILISATEURS } from './data/seed';
import { Office365UsersService } from './generated/services/Office365UsersService';
import { useRbac } from './rbac';
// Permission est désormais défini dans rbac.tsx ; ré-exporté pour les imports
// existants (`import type { Permission } from './auth'`).
import type { Permission } from './rbac';
export type { Permission };

/**
 * Étapes du cycle d'authentification :
 *   - `initializing` : on interroge le player Power Apps (getContext).
 *   - `authenticated`: identité Microsoft résolue ET autorisée (présente + active).
 *   - `denied`       : identité Microsoft résolue mais NON autorisée (absente/inactive).
 *   - `localLogin`   : pas de player (dev local) → formulaire de démonstration.
 */
export type AuthStatus = 'initializing' | 'authenticated' | 'denied' | 'localLogin';

/** Délai max d'attente du player avant de basculer en mode dev local (ms). */
const CONTEXT_TIMEOUT_MS = 2500;

const GUEST_USER: Utilisateur = {
  id: 'guest', login: 'guest', nomAffichage: '—',
  email: '', role: 'LECTEUR', isActive: false, sourceAuth: 'LOCAL',
};
const GUEST_PERMISSIONS: Permission = {
  creerDossier: false, modifierDossier: false, modifierProprement: false,
  archiverDossier: false, planifierAudience: false, enregistrerDelibere: false,
  consulterDossier: false, consulterUniquementSes: false,
  gererHonoraires: false, validerHonoraires: false,
  accesRapports: false, accesRapportsLimite: false,
  gererUtilisateurs: false, configurerAlertes: false,
  exporterDonnees: false, accesLogsAudit: false,
};

interface AuthValue {
  user: Utilisateur;
  isAuthenticated: boolean;
  /** Étape courante du cycle d'authentification (cf. AuthStatus). */
  status: AuthStatus;
  /** Message d'erreur d'autorisation (rempli quand status === 'denied'). */
  authError: string | null;
  /** true si l'app tourne dans le player Power Apps (auth Microsoft active). */
  microsoftMode: boolean;
  permissions: Permission;
  initials: string;
  can: (perm: keyof Permission) => boolean;
  /** Connexion de démonstration — utilisée uniquement en dev local. */
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function initialsFor(name: string): string {
  if (!name || name === '—') return '?';
  const parts = name.replace(/\s+/g, ' ').trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
}

/** Course entre une promesse et un timeout — null si dépassé (player muet). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([p.catch(() => null), timeout]).finally(() => clearTimeout(timer!));
}

/** Course entre getContext() et un timeout — null si le player ne répond pas (dev). */
function getContextOrNull() {
  return withTimeout(getContext(), CONTEXT_TIMEOUT_MS);
}

/**
 * Identité via le **connecteur Office 365 Users** — source d'identité fiable dans
 * le player : renvoie l'e-mail SMTP réel + l'UPN (là où `getContext` peut ne
 * fournir que le nom d'affichage selon le tenant). Renvoie null hors player ou si
 * le connecteur ne répond pas.
 */
async function getOffice365Identity(): Promise<{ email?: string; upn?: string; displayName?: string } | null> {
  try {
    const res = await Office365UsersService.MyProfile();
    if (res.success && res.data) {
      return { email: res.data.Mail, upn: res.data.UserPrincipalName, displayName: res.data.DisplayName };
    }
  } catch (e) {
    console.warn('[auth] Office365 MyProfile indisponible', e);
  }
  return null;
}

/**
 * Charge le roster d'utilisateurs (rôles RBAC) en **fusionnant** le backend actif
 * avec le seed.
 *
 * Résilience : l'authentification ne doit JAMAIS être verrouillée par une liste
 * distante faillible. Une liste SharePoint *présente mais incomplète* (email mal
 * mappé, lignes partielles) ne déclenche pas un simple « repli si vide » — d'où
 * la fusion : on prend le backend, puis on **ajoute** les comptes seed dont
 * l'e-mail OU le login n'est pas déjà couvert. Les comptes connus (dont l'admin)
 * restent ainsi toujours authentifiables. Le backend reste prioritaire (rôle à
 * jour) pour les comptes qu'il porte réellement.
 */
async function loadUtilisateurs(): Promise<Utilisateur[]> {
  let backend: Utilisateur[] = [];
  try {
    backend = (await getDataSource().bootstrap()).utilisateurs ?? [];
  } catch (e) {
    console.warn('[auth] Bootstrap backend échoué — roster seed seul.', e);
  }
  const covered = new Set<string>();
  for (const u of backend) {
    if (u.email) covered.add(normalizeKey(u.email));
    if (u.login) covered.add(normalizeKey(u.login));
  }
  const fallback = SEED_UTILISATEURS.filter(
    (s) => !covered.has(normalizeKey(s.email)) && !covered.has(normalizeKey(s.login)),
  );
  if (backend.length === 0) {
    console.warn('[auth] Roster backend vide — repli intégral sur le seed.');
  } else if (fallback.length > 0) {
    console.warn(`[auth] Roster backend incomplet — ${fallback.length} compte(s) seed ajouté(s) en secours.`);
  }
  return [...backend, ...fallback];
}

/**
 * Normalise une chaîne pour comparaison : minuscules, accents retirés, espaces
 * multiples réduits. Permet de matcher « Émerick  KEMMEGNE » ≈ « emerick kemmegne ».
 */
function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Mappe une identité Microsoft à un Utilisateur. Le player Power Apps peut renvoyer
 * dans `userPrincipalName` soit l'e-mail/UPN, soit le **nom d'affichage** selon le
 * tenant — on compare donc contre l'e-mail, le login ET le nom d'affichage.
 */
function matchUtilisateur(identity: string, utilisateurs: Utilisateur[]): Utilisateur | undefined {
  const key = normalizeKey(identity);
  return utilisateurs.find(
    (u) =>
      normalizeKey(u.email) === key ||
      normalizeKey(u.login) === key ||
      normalizeKey(u.nomAffichage) === key,
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { permsFor } = useRbac();
  const [user, setUser] = useState<Utilisateur>(GUEST_USER);
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [authError, setAuthError] = useState<string | null>(null);
  const [microsoftMode, setMicrosoftMode] = useState(false);
  // Liste des utilisateurs (rôles) — chargée une fois, réutilisée par le login démo.
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);

  const isAuthenticated = status === 'authenticated' && user.id !== 'guest';
  // Permissions effectives : matrice RBAC éditable (cf. rbac.tsx), live.
  const permissions = useMemo(
    () => (isAuthenticated ? permsFor(user.role) : GUEST_PERMISSIONS),
    [isAuthenticated, user.role, permsFor],
  );
  const initials = useMemo(() => initialsFor(user.nomAffichage), [user.nomAffichage]);

  const can = useCallback(
    (perm: keyof Permission) => !!permissions[perm],
    [permissions],
  );

  /**
   * Initialise l'auth. Source d'identité prioritaire : le **connecteur Office 365
   * Users** (e-mail SMTP fiable), complété par `getContext()` du player. On essaie
   * de matcher l'utilisateur sur n'importe lequel des identifiants disponibles
   * (e-mail, UPN, nom d'affichage). Aucune identité → dev local (formulaire démo).
   */
  const initialize = useCallback(async () => {
    setStatus('initializing');
    setAuthError(null);

    let users: Utilisateur[] = [];
    try {
      users = await loadUtilisateurs();
      setUtilisateurs(users);
    } catch {
      // Backend injoignable : on continue, le mapping échouera proprement plus bas.
    }

    // Identité via Office 365 (prioritaire) + player en complément.
    const [o365, ctx] = await Promise.all([
      withTimeout(getOffice365Identity(), CONTEXT_TIMEOUT_MS),
      getContextOrNull(),
    ]);

    // Candidats d'identité, par ordre de fiabilité.
    const candidates = [
      o365?.email, o365?.upn, o365?.displayName,
      ctx?.user?.userPrincipalName, ctx?.user?.fullName,
    ]
      .map((s) => s?.trim())
      .filter((s): s is string => !!s);

    // Aucune identité (ni Office 365 ni player) → dev local : formulaire démo.
    if (candidates.length === 0) {
      setMicrosoftMode(false);
      setUser(GUEST_USER);
      setStatus('localLogin');
      return;
    }

    // Identité Microsoft présente : on tourne dans le player.
    setMicrosoftMode(true);
    let match: Utilisateur | undefined;
    for (const c of candidates) {
      match = matchUtilisateur(c, users);
      if (match) break;
    }

    const displayName = o365?.displayName || ctx?.user?.fullName || candidates[0];
    const identifier = o365?.email || ctx?.user?.userPrincipalName || candidates[0];

    if (!match) {
      setUser(GUEST_USER);
      setAuthError(
        `Compte non autorisé : ${displayName} (${identifier}). ` +
        'Communiquez cet identifiant à l\'administrateur pour obtenir un accès.',
      );
      setStatus('denied');
      return;
    }
    if (!match.isActive) {
      setUser(GUEST_USER);
      setAuthError(
        `Le compte « ${match.nomAffichage} » est désactivé. Contactez l'administrateur.`,
      );
      setStatus('denied');
      return;
    }

    // Autorisé : on enrichit l'affichage avec le nom Microsoft si dispo.
    setUser({ ...match, nomAffichage: match.nomAffichage || displayName || match.login });
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  /**
   * Connexion de démonstration (dev local uniquement) : tout mot de passe accepté,
   * le login est associé à un utilisateur du backend. Inopérant dans le player.
   */
  const login = useCallback(async (loginValue: string, _password: string) => {
    void _password;
    const match = matchUtilisateur(loginValue, utilisateurs);
    if (!match) {
      throw new Error('Identifiant inconnu pour cette base de démonstration.');
    }
    setUser(match);
    setStatus('authenticated');
  }, [utilisateurs]);

  const logout = useCallback(() => {
    setUser(GUEST_USER);
    // Dans le player, on ne peut pas révoquer la session Microsoft : on re-résout
    // l'identité (l'utilisateur reste connecté). En local, retour au formulaire.
    if (microsoftMode) {
      void initialize();
    } else {
      setStatus('localLogin');
    }
  }, [microsoftMode, initialize]);

  const value = useMemo<AuthValue>(
    () => ({
      user, isAuthenticated, status, authError, microsoftMode,
      permissions, initials, can, login, logout,
    }),
    [user, isAuthenticated, status, authError, microsoftMode,
     permissions, initials, can, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>');
  return ctx;
}
