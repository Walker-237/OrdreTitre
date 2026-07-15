/**
 * Store applicatif — données + mutations CRUD complètes, alimenté par une
 * `DataSource` (cf. src/data/source.ts). Aujourd'hui Seed, demain SharePoint
 * ou Dataverse.
 *
 * Les **alertes** font exception : elles ne sont jamais persistées en backend.
 * Le store les calcule via `recomputeAlertes()` (cf. src/alertes-engine.ts) à
 * partir des autres entités, et applique deux marqueurs locaux (readKeys,
 * dismissedKeys) + une config de règles, tous trois persistés dans
 * `localStorage` pour survivre aux rechargements.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type {
  Agent, Audience, Avocat, Alerte, Delibere, Dossier, Honoraire,
  Juridiction, JurisprudenceEntry, JournalAuditEntry, Piece,
  PieceParentType, TypeAlerte, Utilisateur,
} from '../models';
import {
  getDataSource,
  type AgentInput, type AudienceInput, type AvocatInput,
  type DelibereInput, type DossierInput, type HonoraireInput,
  type JuridictionInput, type JurisprudenceInput, type UtilisateurInput,
} from './source';
import {
  REGLES_DEFAUT, derivedKey, recomputeAlertes, type RegleConfig,
} from '../alertes-engine';
import { useAuth } from '../auth';

const ALERTES_LS_KEY = 'afb_alertes_v1';
const SETTINGS_LS_KEY = 'afb_settings_v1';

interface AppSettings {
  /** Seuil par défaut de dossiers actifs par avocat (applique lors d'une création). */
  defaultSeuilAvocat: number;
}
const DEFAULT_SETTINGS: AppSettings = { defaultSeuilAvocat: 20 };

function loadSettings(): AppSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_LS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      defaultSeuilAvocat: typeof parsed.defaultSeuilAvocat === 'number' && parsed.defaultSeuilAvocat > 0
        ? parsed.defaultSeuilAvocat
        : DEFAULT_SETTINGS.defaultSeuilAvocat,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
function saveSettings(s: AppSettings): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
interface AlertesPersisted {
  readKeys: string[];
  dismissedKeys: string[];
  reglesInactives: TypeAlerte[];
}

function loadAlertesPersisted(): AlertesPersisted {
  if (typeof localStorage === 'undefined') return { readKeys: [], dismissedKeys: [], reglesInactives: [] };
  try {
    const raw = localStorage.getItem(ALERTES_LS_KEY);
    if (!raw) return { readKeys: [], dismissedKeys: [], reglesInactives: [] };
    const parsed = JSON.parse(raw) as Partial<AlertesPersisted>;
    return {
      readKeys: Array.isArray(parsed.readKeys) ? parsed.readKeys : [],
      dismissedKeys: Array.isArray(parsed.dismissedKeys) ? parsed.dismissedKeys : [],
      reglesInactives: Array.isArray(parsed.reglesInactives) ? parsed.reglesInactives : [],
    };
  } catch {
    return { readKeys: [], dismissedKeys: [], reglesInactives: [] };
  }
}

function saveAlertesPersisted(state: AlertesPersisted): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(ALERTES_LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

interface StoreValue {
  loading: boolean;
  error: string | null;
  dossiers: Dossier[];
  audiences: Audience[];
  deliberes: Delibere[];
  avocats: Avocat[];
  agents: Agent[];
  juridictions: Juridiction[];
  honoraires: Honoraire[];
  jurisprudence: JurisprudenceEntry[];
  alertes: Alerte[];
  audit: JournalAuditEntry[];
  utilisateurs: Utilisateur[];
  getDossier: (id: string) => Dossier | undefined;
  audiencesOfDossier: (id: string) => Audience[];
  deliberesOfDossier: (id: string) => Delibere[];
  honorairesOfDossier: (id: string) => Honoraire[];
  unreadAlertesCount: number;

  // Dossiers
  createDossier: (input: DossierInput) => Promise<Dossier>;
  updateDossier: (id: string, patch: Partial<Dossier>) => Promise<Dossier>;
  deleteDossier: (id: string) => Promise<void>;
  addPiece: (dossierId: string, piece: Omit<Piece, 'id' | 'createdAt'>) => Promise<Dossier>;
  removePiece: (dossierId: string, pieceId: string) => Promise<Dossier>;
  /** Pièces sur audiences/délibérés/honoraires/jurisprudence/avocats. */
  addEntityPiece: (parentType: PieceParentType, parentId: string, piece: Omit<Piece, 'id' | 'createdAt'>) => Promise<void>;
  removeEntityPiece: (parentType: PieceParentType, parentId: string, pieceId: string) => Promise<void>;

  // Audiences
  createAudience: (input: AudienceInput) => Promise<Audience>;
  updateAudience: (id: string, patch: Partial<Audience>) => Promise<Audience>;
  deleteAudience: (id: string) => Promise<void>;

  // Délibérés
  createDelibere: (input: DelibereInput) => Promise<Delibere>;
  updateDelibere: (id: string, patch: Partial<Delibere>) => Promise<Delibere>;
  deleteDelibere: (id: string) => Promise<void>;

  // Avocats
  createAvocat: (input: AvocatInput) => Promise<Avocat>;
  updateAvocat: (id: string, patch: Partial<Avocat>) => Promise<Avocat>;
  deleteAvocat: (id: string) => Promise<void>;

  // Agents
  createAgent: (input: AgentInput) => Promise<Agent>;
  updateAgent: (id: string, patch: Partial<Agent>) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;

  // Juridictions
  createJuridiction: (input: JuridictionInput) => Promise<Juridiction>;
  updateJuridiction: (id: string, patch: Partial<Juridiction>) => Promise<Juridiction>;
  deleteJuridiction: (id: string) => Promise<void>;

  // Honoraires
  createHonoraire: (input: HonoraireInput) => Promise<Honoraire>;
  updateHonoraire: (id: string, patch: Partial<Honoraire>) => Promise<Honoraire>;
  deleteHonoraire: (id: string) => Promise<void>;

  // Jurisprudence
  createJurisprudence: (input: JurisprudenceInput) => Promise<JurisprudenceEntry>;
  updateJurisprudence: (id: string, patch: Partial<JurisprudenceEntry>) => Promise<JurisprudenceEntry>;
  deleteJurisprudence: (id: string) => Promise<void>;

  // Utilisateurs
  createUtilisateur: (input: UtilisateurInput) => Promise<Utilisateur>;
  updateUtilisateur: (id: string, patch: Partial<Utilisateur>) => Promise<Utilisateur>;
  deleteUtilisateur: (id: string) => Promise<void>;
  toggleUtilisateurActive: (id: string) => Promise<void>;

  // Alertes (purement client — dérivées + marqueurs locaux)
  regles: RegleConfig[];
  markAlerteAsRead: (id: number) => void;
  dismissAlerte: (id: number) => void;
  toggleRegle: (type: TypeAlerte) => void;
  resetAlertes: () => void;

  // Paramètres applicatifs (persistés localStorage)
  settings: AppSettings;
  setDefaultSeuilAvocat: (n: number) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [deliberes, setDeliberes] = useState<Delibere[]>([]);
  const [avocats, setAvocats] = useState<Avocat[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [juridictions, setJuridictions] = useState<Juridiction[]>([]);
  const [honoraires, setHonoraires] = useState<Honoraire[]>([]);
  const [jurisprudence, setJurisprudence] = useState<JurisprudenceEntry[]>([]);
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);

  // ── Marqueurs alertes (persistés localStorage) ─────────────────────────────
  const initialPersist = useRef(loadAlertesPersisted());
  const [readKeys, setReadKeys] = useState<Set<string>>(() => new Set(initialPersist.current.readKeys));
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set(initialPersist.current.dismissedKeys));
  const [regles, setRegles] = useState<RegleConfig[]>(() => {
    const inactives = new Set(initialPersist.current.reglesInactives);
    return REGLES_DEFAUT.map((r) => ({ ...r, actif: inactives.has(r.type) ? false : r.actif }));
  });

  // Persiste à chaque changement
  useEffect(() => {
    saveAlertesPersisted({
      readKeys: Array.from(readKeys),
      dismissedKeys: Array.from(dismissedKeys),
      reglesInactives: regles.filter((r) => !r.actif).map((r) => r.type),
    });
  }, [readKeys, dismissedKeys, regles]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDataSource()
      .bootstrap()
      .then((data) => {
        if (cancelled) return;
        setDossiers(data.dossiers);
        setAudiences(data.audiences);
        setDeliberes(data.deliberes);
        setAvocats(data.avocats);
        setAgents(data.agents);
        setJuridictions(data.juridictions);
        setHonoraires(data.honoraires);
        setJurisprudence(data.jurisprudence);
        setUtilisateurs(data.utilisateurs);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const getDossier = useCallback(
    (id: string) => dossiers.find((d) => d.id === id),
    [dossiers],
  );
  const audiencesOfDossier = useCallback(
    (id: string) => audiences.filter((a) => a.dossierId === id),
    [audiences],
  );
  const deliberesOfDossier = useCallback(
    (id: string) => deliberes.filter((de) => de.dossierId === id),
    [deliberes],
  );
  const honorairesOfDossier = useCallback(
    (id: string) => honoraires.filter((h) => h.dossierId === id),
    [honoraires],
  );

  // ── Acteur courant pour l'audit ────────────────────────────────────────────
  const { user } = useAuth();
  useEffect(() => {
    const actor = user.id === 'guest' ? null : { id: user.id, login: user.login };
    getDataSource().setCurrentActor(actor);
  }, [user.id, user.login]);

  // ── Journal d'audit (append-only, lu depuis la DataSource après chaque
  //    mutation — déduit du changement de référence d'une entité) ─────────────
  const audit = useMemo<JournalAuditEntry[]>(
    () => getDataSource().getAudit(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, dossiers, audiences, deliberes, avocats, agents, juridictions, honoraires, jurisprudence, utilisateurs],
  );

  // ── Alertes dérivées ───────────────────────────────────────────────────────
  const alertes = useMemo<Alerte[]>(() => {
    if (loading) return [];
    return recomputeAlertes({
      dossiers, audiences, deliberes, avocats, honoraires,
      reglesActives: new Set(regles.filter((r) => r.actif).map((r) => r.type)),
      readKeys, dismissedKeys,
    });
  }, [loading, dossiers, audiences, deliberes, avocats, honoraires, regles, readKeys, dismissedKeys]);

  const unreadAlertesCount = useMemo(
    () => alertes.filter((a) => a.statut === 'EN_ATTENTE').length,
    [alertes],
  );

  const markAlerteAsRead = useCallback((id: number) => {
    const a = alertes.find((x) => x.id === id);
    if (!a) return;
    const key = a.key ?? derivedKey(a);
    setReadKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev); next.add(key); return next;
    });
  }, [alertes]);

  const dismissAlerte = useCallback((id: number) => {
    const a = alertes.find((x) => x.id === id);
    if (!a) return;
    const key = a.key ?? derivedKey(a);
    setDismissedKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev); next.add(key); return next;
    });
  }, [alertes]);

  const toggleRegle = useCallback((type: TypeAlerte) => {
    setRegles((prev) => prev.map((r) => (r.type === type ? { ...r, actif: !r.actif } : r)));
  }, []);

  const resetAlertes = useCallback(() => {
    setReadKeys(new Set());
    setDismissedKeys(new Set());
    setRegles(REGLES_DEFAUT.map((r) => ({ ...r })));
  }, []);

  // ── Paramètres applicatifs (settings) ──────────────────────────────────────
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  useEffect(() => { saveSettings(settings); }, [settings]);
  const setDefaultSeuilAvocat = useCallback((n: number) => {
    setSettings((s) => ({ ...s, defaultSeuilAvocat: Math.max(1, Math.floor(n)) }));
  }, []);

  // ── Mutations CRUD via DataSource ──────────────────────────────────────────
  const ds = () => getDataSource();

  const createDossier = useCallback(async (input: DossierInput) => {
    const r = await ds().createDossier(input);
    setDossiers((p) => [r, ...p]);
    return r;
  }, []);
  const updateDossier = useCallback(async (id: string, patch: Partial<Dossier>) => {
    const r = await ds().updateDossier(id, patch);
    setDossiers((p) => p.map((d) => (d.id === id ? r : d)));
    return r;
  }, []);
  const deleteDossier = useCallback(async (id: string) => {
    await ds().deleteDossier(id);
    setDossiers((p) => p.filter((d) => d.id !== id));
    setAudiences((p) => p.filter((a) => a.dossierId !== id));
    setDeliberes((p) => p.filter((de) => de.dossierId !== id));
    setHonoraires((p) => p.filter((h) => h.dossierId !== id));
  }, []);
  const addPiece = useCallback(async (dossierId: string, piece: Omit<Piece, 'id' | 'createdAt'>) => {
    const updated = await ds().addPiece(dossierId, piece);
    setDossiers((p) => p.map((d) => (d.id === dossierId ? updated : d)));
    return updated;
  }, []);
  const removePiece = useCallback(async (dossierId: string, pieceId: string) => {
    const updated = await ds().removePiece(dossierId, pieceId);
    setDossiers((p) => p.map((d) => (d.id === dossierId ? updated : d)));
    return updated;
  }, []);

  /**
   * Pièce générique : on délègue à la DataSource puis on réapplique la mise à jour
   * sur la bonne collection en mémoire. Le `updated` retourné par la DataSource
   * est l'entité parente fraîchement modifiée.
   */
  const addEntityPiece = useCallback(async (
    parentType: PieceParentType, parentId: string,
    piece: Omit<Piece, 'id' | 'createdAt'>,
  ) => {
    const updated = await ds().addEntityPiece(parentType, parentId, piece);
    applyParentUpdate(parentType, updated);
  }, []);
  const removeEntityPiece = useCallback(async (
    parentType: PieceParentType, parentId: string, pieceId: string,
  ) => {
    const updated = await ds().removeEntityPiece(parentType, parentId, pieceId);
    applyParentUpdate(parentType, updated);
  }, []);
  // Helper local : pousse l'entité parent dans le bon setter.
  function applyParentUpdate(parentType: PieceParentType, updated: unknown) {
    if (!updated || typeof updated !== 'object') return;
    const u = updated as { id: string };
    switch (parentType) {
      case 'DOSSIER':       setDossiers((p) => p.map((d) => (d.id === u.id ? (u as Dossier) : d))); break;
      case 'AUDIENCE':      setAudiences((p) => p.map((a) => (a.id === u.id ? (u as Audience) : a))); break;
      case 'DELIBERE':      setDeliberes((p) => p.map((d) => (d.id === u.id ? (u as Delibere) : d))); break;
      case 'HONORAIRE':     setHonoraires((p) => p.map((h) => (h.id === u.id ? (u as Honoraire) : h))); break;
      case 'JURISPRUDENCE': setJurisprudence((p) => p.map((j) => (j.id === u.id ? (u as JurisprudenceEntry) : j))); break;
      case 'AVOCAT':        setAvocats((p) => p.map((a) => (a.id === u.id ? (u as Avocat) : a))); break;
    }
  }

  const createAudience = useCallback(async (input: AudienceInput) => {
    const r = await ds().createAudience(input);
    setAudiences((p) => [r, ...p]);
    return r;
  }, []);
  const updateAudience = useCallback(async (id: string, patch: Partial<Audience>) => {
    const r = await ds().updateAudience(id, patch);
    setAudiences((p) => p.map((a) => (a.id === id ? r : a)));
    return r;
  }, []);
  const deleteAudience = useCallback(async (id: string) => {
    await ds().deleteAudience(id);
    setAudiences((p) => p.filter((a) => a.id !== id));
  }, []);

  const createDelibere = useCallback(async (input: DelibereInput) => {
    const r = await ds().createDelibere(input);
    setDeliberes((p) => [r, ...p]);
    return r;
  }, []);
  const updateDelibere = useCallback(async (id: string, patch: Partial<Delibere>) => {
    const r = await ds().updateDelibere(id, patch);
    setDeliberes((p) => p.map((d) => (d.id === id ? r : d)));
    return r;
  }, []);
  const deleteDelibere = useCallback(async (id: string) => {
    await ds().deleteDelibere(id);
    setDeliberes((p) => p.filter((d) => d.id !== id));
  }, []);

  const createAvocat = useCallback(async (input: AvocatInput) => {
    const r = await ds().createAvocat(input);
    setAvocats((p) => [r, ...p]);
    return r;
  }, []);
  const updateAvocat = useCallback(async (id: string, patch: Partial<Avocat>) => {
    const r = await ds().updateAvocat(id, patch);
    setAvocats((p) => p.map((a) => (a.id === id ? r : a)));
    return r;
  }, []);
  const deleteAvocat = useCallback(async (id: string) => {
    await ds().deleteAvocat(id);
    setAvocats((p) => p.filter((a) => a.id !== id));
  }, []);

  const createAgent = useCallback(async (input: AgentInput) => {
    const r = await ds().createAgent(input);
    setAgents((p) => [r, ...p]);
    return r;
  }, []);
  const updateAgent = useCallback(async (id: string, patch: Partial<Agent>) => {
    const r = await ds().updateAgent(id, patch);
    setAgents((p) => p.map((a) => (a.id === id ? r : a)));
    return r;
  }, []);
  const deleteAgent = useCallback(async (id: string) => {
    await ds().deleteAgent(id);
    setAgents((p) => p.filter((a) => a.id !== id));
  }, []);

  const createJuridiction = useCallback(async (input: JuridictionInput) => {
    const r = await ds().createJuridiction(input);
    setJuridictions((p) => [r, ...p]);
    return r;
  }, []);
  const updateJuridiction = useCallback(async (id: string, patch: Partial<Juridiction>) => {
    const r = await ds().updateJuridiction(id, patch);
    setJuridictions((p) => p.map((j) => (j.id === id ? r : j)));
    return r;
  }, []);
  const deleteJuridiction = useCallback(async (id: string) => {
    await ds().deleteJuridiction(id);
    setJuridictions((p) => p.filter((j) => j.id !== id));
  }, []);

  const createHonoraire = useCallback(async (input: HonoraireInput) => {
    const r = await ds().createHonoraire(input);
    setHonoraires((p) => [r, ...p]);
    return r;
  }, []);
  const updateHonoraire = useCallback(async (id: string, patch: Partial<Honoraire>) => {
    const r = await ds().updateHonoraire(id, patch);
    setHonoraires((p) => p.map((h) => (h.id === id ? r : h)));
    return r;
  }, []);
  const deleteHonoraire = useCallback(async (id: string) => {
    await ds().deleteHonoraire(id);
    setHonoraires((p) => p.filter((h) => h.id !== id));
  }, []);

  const createJurisprudence = useCallback(async (input: JurisprudenceInput) => {
    const r = await ds().createJurisprudence(input);
    setJurisprudence((p) => [r, ...p]);
    return r;
  }, []);
  const updateJurisprudence = useCallback(async (id: string, patch: Partial<JurisprudenceEntry>) => {
    const r = await ds().updateJurisprudence(id, patch);
    setJurisprudence((p) => p.map((j) => (j.id === id ? r : j)));
    return r;
  }, []);
  const deleteJurisprudence = useCallback(async (id: string) => {
    await ds().deleteJurisprudence(id);
    setJurisprudence((p) => p.filter((j) => j.id !== id));
  }, []);

  const createUtilisateur = useCallback(async (input: UtilisateurInput) => {
    const r = await ds().createUtilisateur(input);
    setUtilisateurs((p) => [r, ...p]);
    return r;
  }, []);
  const updateUtilisateur = useCallback(async (id: string, patch: Partial<Utilisateur>) => {
    const r = await ds().updateUtilisateur(id, patch);
    setUtilisateurs((p) => p.map((u) => (u.id === id ? r : u)));
    return r;
  }, []);
  const deleteUtilisateur = useCallback(async (id: string) => {
    await ds().deleteUtilisateur(id);
    setUtilisateurs((p) => p.filter((u) => u.id !== id));
  }, []);
  const toggleUtilisateurActive = useCallback(async (id: string) => {
    const r = await ds().toggleUtilisateurActive(id);
    setUtilisateurs((p) => p.map((u) => (u.id === id ? r : u)));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      loading, error,
      dossiers, audiences, deliberes, avocats, agents, juridictions,
      honoraires, jurisprudence, alertes, audit, utilisateurs,
      getDossier, audiencesOfDossier, deliberesOfDossier, honorairesOfDossier,
      unreadAlertesCount,
      createDossier, updateDossier, deleteDossier, addPiece, removePiece,
      addEntityPiece, removeEntityPiece,
      createAudience, updateAudience, deleteAudience,
      createDelibere, updateDelibere, deleteDelibere,
      createAvocat, updateAvocat, deleteAvocat,
      createAgent, updateAgent, deleteAgent,
      createJuridiction, updateJuridiction, deleteJuridiction,
      createHonoraire, updateHonoraire, deleteHonoraire,
      createJurisprudence, updateJurisprudence, deleteJurisprudence,
      createUtilisateur, updateUtilisateur, deleteUtilisateur, toggleUtilisateurActive,
      regles, markAlerteAsRead, dismissAlerte, toggleRegle, resetAlertes,
      settings, setDefaultSeuilAvocat,
    }),
    [
      loading, error, dossiers, audiences, deliberes, avocats, agents, juridictions,
      honoraires, jurisprudence, alertes, audit, utilisateurs,
      getDossier, audiencesOfDossier, deliberesOfDossier, honorairesOfDossier,
      unreadAlertesCount,
      createDossier, updateDossier, deleteDossier, addPiece, removePiece,
      addEntityPiece, removeEntityPiece,
      createAudience, updateAudience, deleteAudience,
      createDelibere, updateDelibere, deleteDelibere,
      createAvocat, updateAvocat, deleteAvocat,
      createAgent, updateAgent, deleteAgent,
      createJuridiction, updateJuridiction, deleteJuridiction,
      createHonoraire, updateHonoraire, deleteHonoraire,
      createJurisprudence, updateJurisprudence, deleteJurisprudence,
      createUtilisateur, updateUtilisateur, deleteUtilisateur, toggleUtilisateurActive,
      regles, markAlerteAsRead, dismissAlerte, toggleRegle, resetAlertes,
      settings, setDefaultSeuilAvocat,
    ],
  );

  if (loading) {
    return (
      <div className="login-shell">
        <div className="login-card text-center">
          <div className="login-title">Chargement…</div>
          <div className="login-sub mt-8">Connexion à la source de données</div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-title" style={{ color: 'var(--red)' }}>Erreur de chargement</div>
          <p className="muted mt-8" style={{ fontSize: 13 }}>{error}</p>
          <p className="hint mt-16">
            Vérifie la configuration de la source de données (cf. <code>src/data/source.ts</code>
            et <code>DATAVERSE.md</code> / <code>SHAREPOINT.md</code>).
          </p>
        </div>
      </div>
    );
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore doit être utilisé à l\'intérieur de <StoreProvider>');
  return ctx;
}
