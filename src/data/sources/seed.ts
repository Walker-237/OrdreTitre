/**
 * Implémentation locale en mémoire de DataSource, **persistée dans localStorage**,
 * avec **journal d'audit append-only auto-alimenté** sur chaque mutation.
 *
 * Démarrage :
 *   - lit `STORAGE_KEY` ; si présent et `v === STORAGE_VERSION`, hydrate l'état
 *     (entités + audit) depuis localStorage,
 *   - sinon, repart des graines (`SEED_*`).
 *
 * Toute mutation (create/update/delete/toggle) :
 *   1. capture l'état "avant" si pertinent,
 *   2. applique la mutation,
 *   3. **ajoute** une entrée d'audit (CREATE/UPDATE/DELETE + acteur + avant/après),
 *   4. appelle `persist()` qui réécrit l'intégralité de l'état (entités + audit).
 *
 * Aucune méthode ne supprime ou ne modifie une entrée d'audit existante. Le
 * journal est verrouillé par contrat (cf. DataSource).
 *
 * Reset manuel : `SeedDataSource.resetStorage()` — supprime l'état persisté
 * (entités ET journal) et force le prochain démarrage à repartir des graines.
 */
import type {
  Agent, Audience, Avocat, AuditAction, Delibere, Dossier, Honoraire,
  Juridiction, JournalAuditEntry, JurisprudenceEntry, Piece,
  PieceParentType, Utilisateur,
} from '../../models';
import type {
  AgentInput, AudienceInput, AvocatInput, BootstrapData, DataSource,
  DelibereInput, DossierInput, HonoraireInput, JuridictionInput,
  JurisprudenceInput, UtilisateurInput,
} from '../source';
import {
  SEED_AGENTS, SEED_AUDIENCES, SEED_AUDIT, SEED_AVOCATS,
  SEED_DELIBERES, SEED_DOSSIERS, SEED_HONORAIRES, SEED_JURIDICTIONS,
  SEED_JURISPRUDENCE, SEED_UTILISATEURS,
} from '../seed';

const STORAGE_KEY = 'afb_data_v1';
const STORAGE_VERSION = 1;

interface PersistedState {
  v: number;
  dossiers: Dossier[];
  audiences: Audience[];
  deliberes: Delibere[];
  avocats: Avocat[];
  agents: Agent[];
  juridictions: Juridiction[];
  honoraires: Honoraire[];
  jurisprudence: JurisprudenceEntry[];
  utilisateurs: Utilisateur[];
  audit?: JournalAuditEntry[];
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Pour chaque type parent, le nom du champ FK à renseigner dans la Piece
 * (mutuellement exclusifs sur le modèle, cf. models.ts).
 */
const ENTITY_PIECE_FOREIGN_KEY: Record<PieceParentType, keyof Piece> = {
  DOSSIER: 'dossierId',
  AUDIENCE: 'audienceId',
  DELIBERE: 'delibereId',
  HONORAIRE: 'honoraireId',
  JURISPRUDENCE: 'jurisprudenceId',
  AVOCAT: 'avocatId',
};

function nextDossierReference(existing: Dossier[]): string {
  const year = new Date().getFullYear();
  const same = existing.filter((d) => d.reference.startsWith(`AFB-${year}-`));
  const lastSeq = same.reduce((max, d) => {
    const n = parseInt(d.reference.split('-').pop() ?? '0', 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `AFB-${year}-${String(lastSeq + 1).padStart(5, '0')}`;
}

export class SeedDataSource implements DataSource {
  private dossiers: Dossier[];
  private audiences: Audience[];
  private deliberes: Delibere[];
  private avocats: Avocat[];
  private agents: Agent[];
  private juridictions: Juridiction[];
  private honoraires: Honoraire[];
  private jurisprudence: JurisprudenceEntry[];
  private utilisateurs: Utilisateur[];
  private audit: JournalAuditEntry[];
  private currentActor: { id: string; login: string } | null = null;

  constructor() {
    const loaded = SeedDataSource.loadStorage();
    if (loaded) {
      this.dossiers = loaded.dossiers;
      this.audiences = loaded.audiences;
      this.deliberes = loaded.deliberes;
      this.avocats = loaded.avocats;
      this.agents = loaded.agents;
      this.juridictions = loaded.juridictions;
      this.honoraires = loaded.honoraires;
      this.jurisprudence = loaded.jurisprudence;
      this.utilisateurs = loaded.utilisateurs;
      this.audit = loaded.audit ?? [...SEED_AUDIT];
    } else {
      this.dossiers = [...SEED_DOSSIERS];
      this.audiences = [...SEED_AUDIENCES];
      this.deliberes = [...SEED_DELIBERES];
      this.avocats = [...SEED_AVOCATS];
      this.agents = [...SEED_AGENTS];
      this.juridictions = [...SEED_JURIDICTIONS];
      this.honoraires = [...SEED_HONORAIRES];
      this.jurisprudence = [...SEED_JURISPRUDENCE];
      this.utilisateurs = [...SEED_UTILISATEURS];
      this.audit = [...SEED_AUDIT];
      this.persist();
    }
  }

  async bootstrap(): Promise<BootstrapData> {
    return {
      dossiers: this.dossiers,
      audiences: this.audiences,
      deliberes: this.deliberes,
      avocats: this.avocats,
      agents: this.agents,
      juridictions: this.juridictions,
      honoraires: this.honoraires,
      jurisprudence: this.jurisprudence,
      utilisateurs: this.utilisateurs,
    };
  }

  setCurrentActor(actor: { id: string; login: string } | null): void {
    this.currentActor = actor;
  }

  getAudit(): JournalAuditEntry[] {
    return this.audit;
  }

  // ── Dossiers ───────────────────────────────────────────────────────────────
  async createDossier(input: DossierInput): Promise<Dossier> {
    const now = new Date();
    const dossierId = newId('d');
    // Normalisation des pièces jointes : id + dossierId + createdAt par défaut.
    const pieces: Piece[] = (input.pieces ?? []).map((p) => ({
      ...p,
      id: p.id ?? newId('p'),
      dossierId,
      createdAt: p.createdAt ?? now.toISOString(),
      uploadedBy: p.uploadedBy ?? this.currentActor?.login,
    }));
    const dossier: Dossier = {
      ...input,
      id: dossierId,
      reference: input.reference ?? nextDossierReference(this.dossiers),
      createdAt: now.toISOString(),
      pieces,
    };
    this.dossiers = [dossier, ...this.dossiers];
    // Le contenu binaire des pièces (fichierUrl base64) est exclu du log d'audit.
    const summary = {
      ...dossier,
      pieces: pieces.map((p) => ({ ...p, fichierUrl: '<binary omitted>' })),
    };
    this.appendAudit('CREATE', 'DOSSIER_JUDICIAIRE', dossier.id, undefined, summary);
    this.persist();
    return dossier;
  }
  async updateDossier(id: string, patch: Partial<Dossier>): Promise<Dossier> {
    const before = this.find(this.dossiers, id);
    const updated = { ...before, ...patch, id, updatedAt: new Date().toISOString() } as Dossier;
    this.dossiers = this.dossiers.map((d) => (d.id === id ? updated : d));
    this.appendAudit('UPDATE', 'DOSSIER_JUDICIAIRE', id, before, updated);
    this.persist();
    return updated;
  }
  async deleteDossier(id: string): Promise<void> {
    const before = this.dossiers.find((d) => d.id === id);
    this.dossiers = this.dossiers.filter((d) => d.id !== id);
    this.audiences = this.audiences.filter((a) => a.dossierId !== id);
    this.deliberes = this.deliberes.filter((de) => de.dossierId !== id);
    this.honoraires = this.honoraires.filter((h) => h.dossierId !== id);
    if (before) this.appendAudit('DELETE', 'DOSSIER_JUDICIAIRE', id, before, undefined);
    this.persist();
  }

  // ── Pièces jointes (relations 1-N côté Dossier) ────────────────────────────
  async addPiece(dossierId: string, piece: Omit<Piece, 'id' | 'createdAt'>): Promise<Dossier> {
    const dossier = this.find(this.dossiers, dossierId);
    const now = new Date().toISOString();
    const newPiece: Piece = {
      ...piece,
      id: newId('p'),
      dossierId,
      uploadedBy: this.currentActor?.login ?? piece.uploadedBy,
      createdAt: now,
    };
    const updated = {
      ...dossier,
      pieces: [...dossier.pieces, newPiece],
      updatedAt: now,
    };
    this.dossiers = this.dossiers.map((d) => (d.id === dossierId ? updated : d));
    // On exclut le contenu binaire du log d'audit (peut peser plusieurs Mo).
    const summary = { ...newPiece, fichierUrl: '<binary omitted>' };
    this.appendAudit('CREATE', 'PIECE', newPiece.id!, undefined, summary);
    this.persist();
    return updated;
  }

  async removePiece(dossierId: string, pieceId: string): Promise<Dossier> {
    const dossier = this.find(this.dossiers, dossierId);
    const piece = dossier.pieces.find((p) => p.id === pieceId);
    const updated = {
      ...dossier,
      pieces: dossier.pieces.filter((p) => p.id !== pieceId),
      updatedAt: new Date().toISOString(),
    };
    this.dossiers = this.dossiers.map((d) => (d.id === dossierId ? updated : d));
    if (piece) {
      const summary = { ...piece, fichierUrl: '<binary omitted>' };
      this.appendAudit('DELETE', 'PIECE', pieceId, summary, undefined);
    }
    this.persist();
    return updated;
  }

  // ── Pièces génériques (audiences, délibérés, honoraires, jurisprudence, avocats) ─
  async addEntityPiece(
    parentType: PieceParentType,
    parentId: string,
    piece: Omit<Piece, 'id' | 'createdAt'>,
  ): Promise<unknown> {
    if (parentType === 'DOSSIER') return this.addPiece(parentId, piece);
    const now = new Date().toISOString();
    const idKey = ENTITY_PIECE_FOREIGN_KEY[parentType];
    const newPiece: Piece = {
      ...piece,
      id: newId('p'),
      [idKey]: parentId,
      uploadedBy: this.currentActor?.login ?? piece.uploadedBy,
      createdAt: now,
    };
    const collection = this.collectionFor(parentType);
    const before = this.findInCollection(collection, parentId);
    const nextPieces = [...(before.pieces ?? []), newPiece];
    const updated = { ...before, pieces: nextPieces, updatedAt: now } as typeof before;
    this.replaceInCollection(parentType, updated);
    const summary = { ...newPiece, fichierUrl: '<binary omitted>' };
    this.appendAudit('CREATE', 'PIECE', newPiece.id!, undefined, summary);
    this.persist();
    return updated;
  }

  async removeEntityPiece(
    parentType: PieceParentType,
    parentId: string,
    pieceId: string,
  ): Promise<unknown> {
    if (parentType === 'DOSSIER') return this.removePiece(parentId, pieceId);
    const collection = this.collectionFor(parentType);
    const before = this.findInCollection(collection, parentId);
    const piece = (before.pieces ?? []).find((p) => p.id === pieceId);
    const nextPieces = (before.pieces ?? []).filter((p) => p.id !== pieceId);
    const updated = {
      ...before, pieces: nextPieces, updatedAt: new Date().toISOString(),
    } as typeof before;
    this.replaceInCollection(parentType, updated);
    if (piece) {
      const summary = { ...piece, fichierUrl: '<binary omitted>' };
      this.appendAudit('DELETE', 'PIECE', pieceId, summary, undefined);
    }
    this.persist();
    return updated;
  }

  // Helpers — résout la collection en mémoire en fonction du type parent.
  private collectionFor(t: PieceParentType): Array<{ id: string; pieces?: Piece[]; updatedAt?: string }> {
    switch (t) {
      case 'AUDIENCE':       return this.audiences as unknown as Array<{ id: string; pieces?: Piece[]; updatedAt?: string }>;
      case 'DELIBERE':       return this.deliberes as unknown as Array<{ id: string; pieces?: Piece[]; updatedAt?: string }>;
      case 'HONORAIRE':      return this.honoraires as unknown as Array<{ id: string; pieces?: Piece[]; updatedAt?: string }>;
      case 'JURISPRUDENCE':  return this.jurisprudence as unknown as Array<{ id: string; pieces?: Piece[]; updatedAt?: string }>;
      case 'AVOCAT':         return this.avocats as unknown as Array<{ id: string; pieces?: Piece[]; updatedAt?: string }>;
      // 'DOSSIER' est exclu — court-circuité par addEntityPiece avant d'arriver ici.
      default: throw new Error(`Type parent inconnu : ${t}`);
    }
  }
  private findInCollection<T extends { id: string }>(coll: T[], id: string): T {
    const found = coll.find((x) => x.id === id);
    if (!found) throw new Error(`Entité ${id} introuvable dans la collection`);
    return found;
  }
  private replaceInCollection(t: PieceParentType, item: { id: string }): void {
    const replacer = <T extends { id: string }>(arr: T[]) =>
      arr.map((x) => (x.id === item.id ? (item as unknown as T) : x));
    switch (t) {
      case 'AUDIENCE':      this.audiences = replacer(this.audiences); break;
      case 'DELIBERE':      this.deliberes = replacer(this.deliberes); break;
      case 'HONORAIRE':     this.honoraires = replacer(this.honoraires); break;
      case 'JURISPRUDENCE': this.jurisprudence = replacer(this.jurisprudence); break;
      case 'AVOCAT':        this.avocats = replacer(this.avocats); break;
    }
  }

  // ── Audiences ──────────────────────────────────────────────────────────────
  async createAudience(input: AudienceInput): Promise<Audience> {
    const audience: Audience = { ...input, id: newId('a'), createdAt: new Date().toISOString() };
    this.audiences = [audience, ...this.audiences];
    this.appendAudit('CREATE', 'AUDIENCE', audience.id, undefined, audience);
    this.persist();
    return audience;
  }
  async updateAudience(id: string, patch: Partial<Audience>): Promise<Audience> {
    const before = this.find(this.audiences, id);
    const updated = { ...before, ...patch, id, updatedAt: new Date().toISOString() } as Audience;
    this.audiences = this.audiences.map((a) => (a.id === id ? updated : a));
    this.appendAudit('UPDATE', 'AUDIENCE', id, before, updated);
    this.persist();
    return updated;
  }
  async deleteAudience(id: string): Promise<void> {
    const before = this.audiences.find((a) => a.id === id);
    this.audiences = this.audiences.filter((a) => a.id !== id);
    if (before) this.appendAudit('DELETE', 'AUDIENCE', id, before, undefined);
    this.persist();
  }

  // ── Délibérés ──────────────────────────────────────────────────────────────
  async createDelibere(input: DelibereInput): Promise<Delibere> {
    const delibere: Delibere = { ...input, id: newId('de'), createdAt: new Date().toISOString() };
    this.deliberes = [delibere, ...this.deliberes];
    this.appendAudit('CREATE', 'DELIBERE', delibere.id, undefined, delibere);
    this.persist();
    return delibere;
  }
  async updateDelibere(id: string, patch: Partial<Delibere>): Promise<Delibere> {
    const before = this.find(this.deliberes, id);
    const updated = { ...before, ...patch, id, updatedAt: new Date().toISOString() } as Delibere;
    this.deliberes = this.deliberes.map((d) => (d.id === id ? updated : d));
    this.appendAudit('UPDATE', 'DELIBERE', id, before, updated);
    this.persist();
    return updated;
  }
  async deleteDelibere(id: string): Promise<void> {
    const before = this.deliberes.find((d) => d.id === id);
    this.deliberes = this.deliberes.filter((d) => d.id !== id);
    if (before) this.appendAudit('DELETE', 'DELIBERE', id, before, undefined);
    this.persist();
  }

  // ── Avocats ────────────────────────────────────────────────────────────────
  async createAvocat(input: AvocatInput): Promise<Avocat> {
    const avocat: Avocat = { ...input, id: newId('av'), createdAt: new Date().toISOString() };
    this.avocats = [avocat, ...this.avocats];
    this.appendAudit('CREATE', 'AVOCAT', avocat.id, undefined, avocat);
    this.persist();
    return avocat;
  }
  async updateAvocat(id: string, patch: Partial<Avocat>): Promise<Avocat> {
    const before = this.find(this.avocats, id);
    const updated = { ...before, ...patch, id, updatedAt: new Date().toISOString() } as Avocat;
    this.avocats = this.avocats.map((a) => (a.id === id ? updated : a));
    this.appendAudit('UPDATE', 'AVOCAT', id, before, updated);
    this.persist();
    return updated;
  }
  async deleteAvocat(id: string): Promise<void> {
    const before = this.avocats.find((a) => a.id === id);
    this.avocats = this.avocats.filter((a) => a.id !== id);
    if (before) this.appendAudit('DELETE', 'AVOCAT', id, before, undefined);
    this.persist();
  }

  // ── Agents ─────────────────────────────────────────────────────────────────
  async createAgent(input: AgentInput): Promise<Agent> {
    const agent: Agent = { ...input, id: newId('ag'), createdAt: new Date().toISOString() };
    this.agents = [agent, ...this.agents];
    this.appendAudit('CREATE', 'AGENT', agent.id, undefined, agent);
    this.persist();
    return agent;
  }
  async updateAgent(id: string, patch: Partial<Agent>): Promise<Agent> {
    const before = this.find(this.agents, id);
    const updated = { ...before, ...patch, id } as Agent;
    this.agents = this.agents.map((a) => (a.id === id ? updated : a));
    this.appendAudit('UPDATE', 'AGENT', id, before, updated);
    this.persist();
    return updated;
  }
  async deleteAgent(id: string): Promise<void> {
    const before = this.agents.find((a) => a.id === id);
    this.agents = this.agents.filter((a) => a.id !== id);
    if (before) this.appendAudit('DELETE', 'AGENT', id, before, undefined);
    this.persist();
  }

  // ── Juridictions ───────────────────────────────────────────────────────────
  async createJuridiction(input: JuridictionInput): Promise<Juridiction> {
    const juridiction: Juridiction = { ...input, id: newId('jur') };
    this.juridictions = [juridiction, ...this.juridictions];
    this.appendAudit('CREATE', 'JURIDICTION', juridiction.id, undefined, juridiction);
    this.persist();
    return juridiction;
  }
  async updateJuridiction(id: string, patch: Partial<Juridiction>): Promise<Juridiction> {
    const before = this.find(this.juridictions, id);
    const updated = { ...before, ...patch, id } as Juridiction;
    this.juridictions = this.juridictions.map((j) => (j.id === id ? updated : j));
    this.appendAudit('UPDATE', 'JURIDICTION', id, before, updated);
    this.persist();
    return updated;
  }
  async deleteJuridiction(id: string): Promise<void> {
    const before = this.juridictions.find((j) => j.id === id);
    this.juridictions = this.juridictions.filter((j) => j.id !== id);
    if (before) this.appendAudit('DELETE', 'JURIDICTION', id, before, undefined);
    this.persist();
  }

  // ── Honoraires ─────────────────────────────────────────────────────────────
  async createHonoraire(input: HonoraireInput): Promise<Honoraire> {
    const honoraire: Honoraire = { ...input, id: newId('h'), createdAt: new Date().toISOString() };
    this.honoraires = [honoraire, ...this.honoraires];
    this.appendAudit('CREATE', 'HONORAIRE', honoraire.id, undefined, honoraire);
    this.persist();
    return honoraire;
  }
  async updateHonoraire(id: string, patch: Partial<Honoraire>): Promise<Honoraire> {
    const before = this.find(this.honoraires, id);
    const updated = { ...before, ...patch, id } as Honoraire;
    this.honoraires = this.honoraires.map((h) => (h.id === id ? updated : h));
    this.appendAudit('UPDATE', 'HONORAIRE', id, before, updated);
    this.persist();
    return updated;
  }
  async deleteHonoraire(id: string): Promise<void> {
    const before = this.honoraires.find((h) => h.id === id);
    this.honoraires = this.honoraires.filter((h) => h.id !== id);
    if (before) this.appendAudit('DELETE', 'HONORAIRE', id, before, undefined);
    this.persist();
  }

  // ── Jurisprudence ──────────────────────────────────────────────────────────
  async createJurisprudence(input: JurisprudenceInput): Promise<JurisprudenceEntry> {
    const entry: JurisprudenceEntry = { ...input, id: newId('jp'), createdAt: new Date().toISOString() };
    this.jurisprudence = [entry, ...this.jurisprudence];
    this.appendAudit('CREATE', 'JURISPRUDENCE', entry.id, undefined, entry);
    this.persist();
    return entry;
  }
  async updateJurisprudence(id: string, patch: Partial<JurisprudenceEntry>): Promise<JurisprudenceEntry> {
    const before = this.find(this.jurisprudence, id);
    const updated = { ...before, ...patch, id } as JurisprudenceEntry;
    this.jurisprudence = this.jurisprudence.map((j) => (j.id === id ? updated : j));
    this.appendAudit('UPDATE', 'JURISPRUDENCE', id, before, updated);
    this.persist();
    return updated;
  }
  async deleteJurisprudence(id: string): Promise<void> {
    const before = this.jurisprudence.find((j) => j.id === id);
    this.jurisprudence = this.jurisprudence.filter((j) => j.id !== id);
    if (before) this.appendAudit('DELETE', 'JURISPRUDENCE', id, before, undefined);
    this.persist();
  }

  // ── Utilisateurs ───────────────────────────────────────────────────────────
  async createUtilisateur(input: UtilisateurInput): Promise<Utilisateur> {
    const utilisateur: Utilisateur = { ...input, id: newId('u'), createdAt: new Date().toISOString() };
    this.utilisateurs = [utilisateur, ...this.utilisateurs];
    this.appendAudit('CREATE', 'UTILISATEUR', utilisateur.id, undefined, utilisateur);
    this.persist();
    return utilisateur;
  }
  async updateUtilisateur(id: string, patch: Partial<Utilisateur>): Promise<Utilisateur> {
    const before = this.find(this.utilisateurs, id);
    const updated = { ...before, ...patch, id } as Utilisateur;
    this.utilisateurs = this.utilisateurs.map((u) => (u.id === id ? updated : u));
    this.appendAudit('UPDATE', 'UTILISATEUR', id, before, updated);
    this.persist();
    return updated;
  }
  async deleteUtilisateur(id: string): Promise<void> {
    const before = this.utilisateurs.find((u) => u.id === id);
    this.utilisateurs = this.utilisateurs.filter((u) => u.id !== id);
    if (before) this.appendAudit('DELETE', 'UTILISATEUR', id, before, undefined);
    this.persist();
  }
  async toggleUtilisateurActive(id: string): Promise<Utilisateur> {
    const u = this.find(this.utilisateurs, id);
    return this.updateUtilisateur(id, { isActive: !u.isActive });
  }

  // ── Journal d'audit (append-only) ──────────────────────────────────────────
  private appendAudit(
    action: AuditAction,
    entiteCible: string,
    idEntiteCible: string,
    valeurAvant: object | undefined,
    valeurApres: object | undefined,
  ): void {
    const nextId = this.audit.length > 0 ? Math.max(...this.audit.map((a) => a.id)) + 1 : 1;
    const entry: JournalAuditEntry = {
      id: nextId,
      utilisateurId: this.currentActor?.id ?? 'system',
      utilisateurLogin: this.currentActor?.login ?? 'system',
      action,
      entiteCible,
      idEntiteCible,
      valeurAvant: valeurAvant ? serializeForAudit(valeurAvant) : undefined,
      valeurApres: valeurApres ? serializeForAudit(valeurApres) : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      timestamp: new Date().toISOString(),
    };
    this.audit = [...this.audit, entry];
  }

  // ── Persistance localStorage ──────────────────────────────────────────────
  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const state: PersistedState = {
        v: STORAGE_VERSION,
        dossiers: this.dossiers,
        audiences: this.audiences,
        deliberes: this.deliberes,
        avocats: this.avocats,
        agents: this.agents,
        juridictions: this.juridictions,
        honoraires: this.honoraires,
        jurisprudence: this.jurisprudence,
        utilisateurs: this.utilisateurs,
        audit: this.audit,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[SeedDataSource] persist failed', e);
    }
  }

  private static loadStorage(): PersistedState | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedState;
      if (!parsed || parsed.v !== STORAGE_VERSION) return null;
      const required: Array<keyof PersistedState> = [
        'dossiers', 'audiences', 'deliberes', 'avocats', 'agents',
        'juridictions', 'honoraires', 'jurisprudence', 'utilisateurs',
      ];
      for (const k of required) {
        if (!Array.isArray(parsed[k])) return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  static resetStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  // ── Util interne ──────────────────────────────────────────────────────────
  private find<T extends { id: string }>(arr: T[], id: string): T {
    const found = arr.find((x) => x.id === id);
    if (!found) throw new Error(`Entité ${id} introuvable`);
    return found;
  }
}

/** Sérialise un objet pour l'audit, tronqué à 500 caractères. */
function serializeForAudit(obj: object): string {
  try {
    const s = JSON.stringify(obj);
    return s.length > 500 ? s.slice(0, 497) + '…' : s;
  } catch {
    return '<serialization error>';
  }
}
