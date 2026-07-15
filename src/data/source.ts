/**
 * Couche d'accès aux données — interface unique consommée par le store.
 *
 * Trois implémentations :
 *   - SeedDataSource       (src/data/sources/seed.ts)        → données locales (dev / démo)
 *   - SharepointDataSource (src/data/sources/sharepoint.ts)  → SharePoint Lists via SDK Power Apps
 *   - DataverseDataSource  (src/data/sources/dataverse.ts)   → Tables Dataverse via SDK Power Apps
 *
 * Le store (src/data/store.tsx) choisit l'implémentation au démarrage via
 * la fonction `getDataSource()` ci-dessous (basculement piloté par `DATA_SOURCE`).
 */
import type {
  Agent, Audience, Avocat, Delibere, Dossier, Honoraire,
  Juridiction, JurisprudenceEntry, JournalAuditEntry, Piece,
  PieceParentType, Utilisateur,
} from '../models';
import { SeedDataSource } from './sources/seed';
import { SharepointDataSource } from './sources/sharepoint';
import { SharepointAudiencesDataSource } from './sources/sharepointAudiences';
import { DataverseDataSource } from './sources/dataverse';

/**
 * Snapshot complet des entités persistées — chargé une fois au démarrage.
 *
 * Notes :
 *   - `alertes` n'est pas listé ici (dérivé en continu — cf. src/alertes-engine.ts).
 *   - `audit` n'est plus listé non plus : le journal d'audit est **append-only**.
 *     Il est exposé par `DataSource.getAudit()` qui renvoie toujours l'état
 *     courant ; le store le mémoise via `useMemo` à chaque changement
 *     d'entité (puisque toute mutation génère automatiquement une entrée).
 */
export interface BootstrapData {
  dossiers: Dossier[];
  audiences: Audience[];
  deliberes: Delibere[];
  avocats: Avocat[];
  agents: Agent[];
  juridictions: Juridiction[];
  honoraires: Honoraire[];
  jurisprudence: JurisprudenceEntry[];
  utilisateurs: Utilisateur[];
}

/** Helper de typage : entrée de création (sans id ni champs auto-générés). */
export type DossierInput = Omit<Dossier, 'id' | 'reference' | 'createdAt'> & { reference?: string };
export type AudienceInput = Omit<Audience, 'id' | 'createdAt' | 'updatedAt'>;
export type DelibereInput = Omit<Delibere, 'id' | 'createdAt' | 'updatedAt'>;
export type AvocatInput = Omit<Avocat, 'id' | 'createdAt' | 'updatedAt'>;
export type AgentInput = Omit<Agent, 'id' | 'createdAt'>;
export type JuridictionInput = Omit<Juridiction, 'id'>;
export type HonoraireInput = Omit<Honoraire, 'id' | 'createdAt'>;
export type JurisprudenceInput = Omit<JurisprudenceEntry, 'id' | 'createdAt'>;
export type UtilisateurInput = Omit<Utilisateur, 'id' | 'createdAt'>;

/** Contrat complet — CRUD pour toutes les entités modifiables + mark-as-read alertes. */
export interface DataSource {
  bootstrap: () => Promise<BootstrapData>;

  // Dossiers
  createDossier: (input: DossierInput) => Promise<Dossier>;
  updateDossier: (id: string, patch: Partial<Dossier>) => Promise<Dossier>;
  deleteDossier: (id: string) => Promise<void>;
  /** Attache une pièce à un dossier existant. Renvoie le dossier mis à jour. */
  addPiece: (dossierId: string, piece: Omit<Piece, 'id' | 'createdAt'>) => Promise<Dossier>;
  /** Retire une pièce d'un dossier. Renvoie le dossier mis à jour. */
  removePiece: (dossierId: string, pieceId: string) => Promise<Dossier>;

  /**
   * Mutation générique d'ajout d'une pièce à n'importe quelle entité supportée
   * (audience, délibéré, honoraire, jurisprudence, avocat, ou dossier).
   * Renvoie l'entité parente mise à jour (cast par l'appelant).
   */
  addEntityPiece: (
    parentType: PieceParentType,
    parentId: string,
    piece: Omit<Piece, 'id' | 'createdAt'>,
  ) => Promise<unknown>;
  /** Pendant de `addEntityPiece` — retire une pièce. */
  removeEntityPiece: (
    parentType: PieceParentType,
    parentId: string,
    pieceId: string,
  ) => Promise<unknown>;

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
  toggleUtilisateurActive: (id: string) => Promise<Utilisateur>;

  /**
   * Définit l'acteur courant pour les entrées du journal d'audit générées
   * automatiquement par chaque mutation. À appeler au démarrage et à chaque
   * changement d'utilisateur connecté (cf. store.tsx).
   */
  setCurrentActor: (actor: { id: string; login: string } | null) => void;

  /**
   * Renvoie l'état courant du journal d'audit (immuable, append-only).
   * L'interface ne propose volontairement **aucune** méthode `updateAudit`
   * ni `deleteAudit` : la traçabilité est verrouillée par contrat.
   * Le store appelle cette méthode via `useMemo` après chaque mutation pour
   * rafraîchir l'affichage.
   */
  getAudit: () => JournalAuditEntry[];
}

/** Backends supportés. */
export type DataSourceKind = 'seed' | 'sharepoint' | 'sharepoint-audiences' | 'dataverse';

/**
 * Sélection du backend à utiliser. Pour basculer :
 *
 *   - `'seed'`              → données locales en mémoire (mode démo).
 *   - `'sharepoint'`        → toutes les entités sur SharePoint Lists (cf. SHAREPOINT.md).
 *   - `'sharepoint-audiences'` → **hybride** : audiences depuis la liste SharePoint
 *                               « Audiences », reste depuis le seed (étape de
 *                               validation avant bascule complète).
 *   - `'dataverse'`         → Tables Dataverse. Cf. DATAVERSE.md à la racine.
 */
export const DATA_SOURCE: DataSourceKind = 'seed';

/** Singleton paresseux — créé au premier appel. */
let _instance: DataSource | null = null;
export function getDataSource(): DataSource {
  if (_instance) return _instance;
  switch (DATA_SOURCE) {
    case 'sharepoint':
      _instance = new SharepointDataSource();
      break;
    case 'sharepoint-audiences':
      _instance = new SharepointAudiencesDataSource();
      break;
    case 'dataverse':
      _instance = new DataverseDataSource();
      break;
    case 'seed':
    default:
      _instance = new SeedDataSource();
      break;
  }
  return _instance;
}
